import "server-only";
import { z } from "zod";
import type {
  RepositorioDeCategorias,
  RepositorioDeCentrosDeCusto,
  RepositorioDeRegras,
  RepositorioDeTransacoes,
} from "@/acesso-a-dados/contratos";
import { ErroDeNegocio, entradaInvalida, registrarFalha } from "../erros";
import type {
  CampoDaRegra,
  Categoria,
  ContextoDoUsuario,
  Id,
  OrigemDaRegra,
  Regra,
  TipoDeCategoria,
  Transacao,
} from "../tipos";
import type {
  EstrategiaDeCategorizacao,
  ResultadoDeCategorizacao,
} from "./estrategias/estrategia";
import { normalizarTexto, padraoSugerido } from "./normalizar-texto";

export interface SugestaoDeRegra {
  padrao: string; // normalizado; contraparte se existir, senão a descrição sem dígitos
  campo: CampoDaRegra;
  categoriaId: Id;
  centroDeCustoId: Id | null;
  transacoesAfetadas: number; // quantas outras não definidas pelo usuário seriam alteradas
}

export interface NovaRegra {
  padrao: string; // será normalizado
  campo: CampoDaRegra;
  categoriaId: Id;
  centroDeCustoId?: Id | null;
  prioridade?: number; // padrão 50 para origem 'usuario'/'correcao'
  origem: Exclude<OrigemDaRegra, "padrao">;
  aplicarNasExistentes: boolean; // reaplica em transações com categoria_definida_pelo_usuario = false
}

type DadosDaRegra = Partial<
  Pick<
    Regra,
    "padrao" | "campo" | "prioridade" | "categoriaId" | "centroDeCustoId" | "ativa"
  >
>;
type DadosDaCategoria = Partial<
  Pick<Categoria, "nome" | "tipo" | "entraNoResultado" | "arquivada">
>;

export interface ServicoDeCategorizacao {
  /** Pendentes = categoria_id null, categorizacao_automatica_em null, não definidas pelo usuário.
   *  Corrente: regras -> provedor -> IA (se RECURSO_CATEGORIZACAO_IA). Marca categorizacao_automatica_em em todas as processadas.
   *  Nunca lança por falha da IA: as transações ficam pendentes para a próxima vez (sem marcar). */
  categorizarPendentes(
    empresaId: Id,
    opcoes?: { limite?: number },
  ): Promise<{ categorizadas: number; semSugestao: number }>;

  /** Define categoria e/ou centro de custo como usuário (categoria_origem = 'usuario', categoria_definida_pelo_usuario = true). */
  corrigirCategoria(
    ctx: ContextoDoUsuario,
    transacaoId: Id,
    dados: { categoriaId: Id | null; centroDeCustoId: Id | null },
  ): Promise<{ transacao: Transacao; sugestaoDeRegra: SugestaoDeRegra | null }>;

  criarRegra(
    ctx: ContextoDoUsuario,
    dados: NovaRegra,
  ): Promise<{ regra: Regra; transacoesAlteradas: number }>;
  atualizarRegra(
    ctx: ContextoDoUsuario,
    regraId: Id,
    dados: DadosDaRegra,
  ): Promise<Regra>;
  removerRegra(ctx: ContextoDoUsuario, regraId: Id): Promise<void>;
  listarRegras(ctx: ContextoDoUsuario): Promise<Regra[]>;

  listarCategorias(
    ctx: ContextoDoUsuario,
    opcoes?: { incluirArquivadas?: boolean },
  ): Promise<Categoria[]>;
  criarCategoria(
    ctx: ContextoDoUsuario,
    dados: { nome: string; tipo: TipoDeCategoria; entraNoResultado?: boolean },
  ): Promise<Categoria>;
  atualizarCategoria(
    ctx: ContextoDoUsuario,
    categoriaId: Id,
    dados: DadosDaCategoria,
  ): Promise<Categoria>;
}

export const LIMITE_PADRAO_DE_PENDENTES = 200;
export const PRIORIDADE_DO_USUARIO = 50;
/** Teto de transações reavaliadas ao sugerir/aplicar uma regra. */
export const LIMITE_DE_CORRESPONDENTES = 5000;

// ── Validação (Zod) ──────────────────────────────────────────────────────────

const MENOS_DE_DUAS_LETRAS = "A condição precisa de pelo menos 2 letras.";
const id = z.uuid();
const padraoDaRegra = z
  .string()
  .max(200)
  .transform(normalizarTexto)
  .pipe(z.string().min(2, MENOS_DE_DUAS_LETRAS).max(100));
const campo = z.enum(["descricao", "contraparte"]);
const prioridade = z.number().int().min(0).max(1000);
const nomeDaCategoria = z.string().trim().min(1).max(60);
const tipoDaCategoria = z.enum(["entrada", "saida", "ambos"]);

const esquemaNovaRegra = z.object({
  padrao: padraoDaRegra,
  campo,
  categoriaId: id,
  centroDeCustoId: id.nullish(),
  prioridade: prioridade.optional(),
  origem: z.enum(["usuario", "correcao"]),
  aplicarNasExistentes: z.boolean(),
});
const esquemaAtualizacaoDaRegra = z
  .object({
    padrao: padraoDaRegra,
    campo,
    prioridade,
    categoriaId: id,
    centroDeCustoId: id.nullable(),
    ativa: z.boolean(),
  })
  .partial();
const esquemaCorrecao = z.object({
  categoriaId: id.nullable(),
  centroDeCustoId: id.nullable(),
});
const esquemaNovaCategoria = z.object({
  nome: nomeDaCategoria,
  tipo: tipoDaCategoria,
  entraNoResultado: z.boolean().default(true),
});
const esquemaAtualizacaoDaCategoria = z
  .object({
    nome: nomeDaCategoria,
    tipo: tipoDaCategoria,
    entraNoResultado: z.boolean(),
    arquivada: z.boolean(),
  })
  .partial();

function validar<T>(esquema: z.ZodType<T>, dados: unknown): T {
  const r = esquema.safeParse(dados);
  if (!r.success)
    throw entradaInvalida(
      r.error.issues.some((i) => i.message === MENOS_DE_DUAS_LETRAS)
        ? MENOS_DE_DUAS_LETRAS
        : undefined,
    );
  return r.data;
}

function validarId(valor: unknown, mensagem: string): Id {
  if (!id.safeParse(valor).success)
    throw new ErroDeNegocio("nao_encontrado", mensagem);
  return valor as Id;
}

// ── Serviço ──────────────────────────────────────────────────────────────────

export function criarServicoDeCategorizacao(deps: {
  transacoes: RepositorioDeTransacoes;
  regras: RepositorioDeRegras;
  categorias: RepositorioDeCategorias;
  centrosDeCusto: RepositorioDeCentrosDeCusto;
  /** Em ordem: regras -> provedor -> IA. */
  estrategias: readonly EstrategiaDeCategorizacao[];
  /** RECURSO_CATEGORIZACAO_IA */
  iaLigada: () => boolean;
}): ServicoDeCategorizacao {
  async function sugerirRegra(
    empresaId: Id,
    transacao: Transacao,
    categoriaId: Id,
    centroDeCustoId: Id | null,
  ): Promise<SugestaoDeRegra | null> {
    const { padrao, campo } = padraoSugerido(transacao);
    if (padrao.length < 2) return null;
    const correspondentes = await deps.transacoes.listarCorrespondentesARegra(
      empresaId,
      { padrao, campo },
      { excluirId: transacao.id, limite: LIMITE_DE_CORRESPONDENTES },
    );
    return {
      padrao: padrao.slice(0, 100),
      campo,
      categoriaId,
      centroDeCustoId,
      transacoesAfetadas: correspondentes.length,
    };
  }

  return {
    async categorizarPendentes(empresaId, opcoes) {
      const pendentes = await deps.transacoes.listarPendentesDeCategorizacao(
        empresaId,
        opcoes?.limite ?? LIMITE_PADRAO_DE_PENDENTES,
      );
      if (!pendentes.length) return { categorizadas: 0, semSugestao: 0 };

      const [regras, categorias, centrosDeCusto] = await Promise.all([
        deps.regras.listarAtivas(empresaId),
        deps.categorias.listar(empresaId),
        deps.centrosDeCusto.listar(empresaId),
      ]);
      const contexto = { empresaId, regras, categorias, centrosDeCusto };
      const iaLigada = deps.iaLigada();

      let restantes: readonly Transacao[] = pendentes;
      const resultados: ResultadoDeCategorizacao[] = [];
      let iaConcluida = false;
      for (const estrategia of deps.estrategias) {
        if (!restantes.length) break;
        if (estrategia.nome === "ia" && !iaLigada) continue;
        let obtidos: ResultadoDeCategorizacao[];
        try {
          obtidos = await estrategia.categorizar(restantes, contexto);
        } catch (erro) {
          // Falha da IA nunca quebra: as que sobraram ficam pendentes (sem marcar).
          if (estrategia.nome !== "ia") throw erro;
          registrarFalha("categorização por IA", erro);
          continue;
        }
        if (estrategia.nome === "ia") iaConcluida = true;
        const resolvidas = new Set(obtidos.map((r) => r.transacaoId));
        resultados.push(...obtidos);
        restantes = restantes.filter((t) => !resolvidas.has(t.id));
      }

      const categorizadas = resultados.length
        ? await deps.transacoes.aplicarCategorizacaoAutomatica(
            empresaId,
            resultados,
          )
        : 0;
      // Marca as sem sugestão só se a IA rodou de fato: com a IA desligada ou fora do ar,
      // elas voltam na próxima vez.
      if (restantes.length && iaConcluida)
        await deps.transacoes.marcarCategorizacaoTentada(
          empresaId,
          restantes.map((t) => t.id),
        );
      return { categorizadas, semSugestao: restantes.length };
    },

    async corrigirCategoria(ctx, transacaoId, dados) {
      validarId(transacaoId, "Transação não encontrada.");
      const correcao = validar(esquemaCorrecao, dados);
      const anterior = await deps.transacoes.buscarPorId(
        ctx.empresaId,
        transacaoId,
      );
      if (!anterior)
        throw new ErroDeNegocio("nao_encontrado", "Transação não encontrada.");
      const transacao = await deps.transacoes.definirCategoriaPeloUsuario(
        ctx.empresaId,
        transacaoId,
        correcao,
      );
      const sugestaoDeRegra =
        correcao.categoriaId && correcao.categoriaId !== anterior.categoriaId
          ? await sugerirRegra(
              ctx.empresaId,
              anterior,
              correcao.categoriaId,
              correcao.centroDeCustoId,
            )
          : null;
      return { transacao, sugestaoDeRegra };
    },

    async criarRegra(ctx, dados) {
      const nova = validar(esquemaNovaRegra, dados);
      const regra = await deps.regras.criar(ctx.empresaId, {
        padrao: nova.padrao,
        campo: nova.campo,
        prioridade: nova.prioridade ?? PRIORIDADE_DO_USUARIO,
        categoriaId: nova.categoriaId,
        centroDeCustoId: nova.centroDeCustoId ?? null,
        origem: nova.origem,
      });
      if (!nova.aplicarNasExistentes) return { regra, transacoesAlteradas: 0 };
      // P-14: sobrescreve 'ia'/'regra'/'pluggy', nunca 'usuario' (filtro também no SQL).
      const alvo = await deps.transacoes.listarCorrespondentesARegra(
        ctx.empresaId,
        regra,
        { limite: LIMITE_DE_CORRESPONDENTES },
      );
      const transacoesAlteradas = alvo.length
        ? await deps.transacoes.aplicarCategorizacaoAutomatica(
            ctx.empresaId,
            alvo.map((t) => ({
              transacaoId: t.id,
              categoriaId: regra.categoriaId,
              centroDeCustoId: regra.centroDeCustoId ?? t.centroDeCustoId,
              origem: "regra" as const,
              regraId: regra.id,
              confianca: null,
            })),
          )
        : 0;
      return { regra, transacoesAlteradas };
    },

    async atualizarRegra(ctx, regraId, dados) {
      validarId(regraId, "Regra não encontrada.");
      return deps.regras.atualizar(
        ctx.empresaId,
        regraId,
        validar(esquemaAtualizacaoDaRegra, dados),
      );
    },

    async removerRegra(ctx, regraId) {
      validarId(regraId, "Regra não encontrada.");
      await deps.regras.remover(ctx.empresaId, regraId);
    },

    listarRegras: (ctx) => deps.regras.listar(ctx.empresaId),

    listarCategorias: (ctx, opcoes) =>
      deps.categorias.listar(ctx.empresaId, opcoes),

    async criarCategoria(ctx, dados) {
      return deps.categorias.criar(
        ctx.empresaId,
        validar(esquemaNovaCategoria, dados),
      );
    },

    async atualizarCategoria(ctx, categoriaId, dados) {
      validarId(categoriaId, "Categoria não encontrada.");
      return deps.categorias.atualizar(
        ctx.empresaId,
        categoriaId,
        validar(esquemaAtualizacaoDaCategoria, dados),
      );
    },
  };
}
