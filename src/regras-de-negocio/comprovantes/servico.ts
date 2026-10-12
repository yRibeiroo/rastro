import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  ArmazenamentoDeArquivos,
  DadosDoComprovanteNoBanco,
  RepositorioDeAnexos,
  RepositorioDeComprovantes,
  RepositorioDeImportacoes,
  RepositorioDeTransacoes,
} from "@/acesso-a-dados/contratos";
import {
  chaveDeAcessoValida,
  extrairChaveDeAcessoDoQr,
} from "@/ferramentas-internas/chave-de-acesso";
import { exigirLimite, LIMITES, type ConsumirLimite } from "../acesso";
import { detectarTipo, limparNomeDoArquivo } from "../anexos/servico";
import { formatarData, hojeISO } from "@/ferramentas-internas/formatar-data";
import { ErroDeNegocio, entradaInvalida, registrarFalha } from "../erros";
import type {
  AlertaDoComprovante,
  CampoCorrigivel,
  Comprovante,
  ContextoDoUsuario,
  DadosDoComprovante,
  Id,
  ImportacaoDeExtrato,
  SituacaoDoComprovante,
} from "../tipos";
import {
  conciliar,
  TOLERANCIA_EM_DIAS,
  type CandidatoAConciliacao,
} from "./conciliacao";
import {
  ErroDeLeitura,
  type LeitorDeComprovantes,
} from "./leitor-de-comprovantes-claude";

export interface ServicoDeComprovantes {
  /** Requer RECURSO_COMPROVANTES_IA. JPG/PNG/WEBP/PDF (≤ 5 páginas) até 4 MB. Rate limit 30/h.
   *  Salva o arquivo, lê com a IA (teto mensal, RNF-26), deduplica pela chave e tenta conciliar. */
  enviar(
    ctx: ContextoDoUsuario,
    arquivo: File,
    dica?: { chaveDeAcesso?: string },
  ): Promise<Comprovante>;
  /** Cada um vem com `alerta` (RF-42); `comAlerta: true` devolve só os alertados. */
  listar(
    ctx: ContextoDoUsuario,
    filtros?: { situacao?: SituacaoDoComprovante; comAlerta?: boolean },
  ): Promise<Comprovante[]>;
  /** RF-42: quantos estão "sem transação no extrato". */
  contarAlertas(
    ctx: ContextoDoUsuario,
  ): Promise<{ comprovantesSemTransacao: number }>;
  /** RF-41 "Tentar ler de novo": conta para o teto mensal e o rate limit; não sobrescreve campos corrigidos. */
  lerDeNovo(ctx: ContextoDoUsuario, comprovanteId: Id): Promise<Comprovante>;
  /** Transações com o mesmo valor absoluto em ±10 dias, para o usuário escolher. */
  listarCandidatos(
    ctx: ContextoDoUsuario,
    comprovanteId: Id,
  ): Promise<CandidatoAConciliacao[]>;
  conciliarManualmente(
    ctx: ContextoDoUsuario,
    comprovanteId: Id,
    transacaoId: Id,
  ): Promise<Comprovante>;
  /** RF-40: volta a 'pendente'; o arquivo continua. */
  desfazerConciliacao(
    ctx: ContextoDoUsuario,
    comprovanteId: Id,
  ): Promise<Comprovante>;
  corrigirDados(
    ctx: ContextoDoUsuario,
    comprovanteId: Id,
    dados: Partial<DadosDoComprovante>,
  ): Promise<Comprovante>;
  /** Chamado após cada importação. Devolve quantos passaram a 'conciliado'. */
  reconciliarPendentes(empresaId: Id): Promise<number>;
  /** Cron (service role): reconcilia os pendentes de todas as empresas. */
  reconciliarTodas(): Promise<{ empresas: number; conciliados: number }>;
  remover(ctx: ContextoDoUsuario, comprovanteId: Id): Promise<void>;
}

export const TAMANHO_MAXIMO_DO_COMPROVANTE = 4 * 1024 * 1024; // limite da Vercel: 4,5 MB por requisição
export const MAXIMO_DE_PAGINAS_DO_PDF = 5;
export const TOLERANCIA_DA_ESCOLHA_MANUAL = 10;

const EXTENSOES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const arquivoInvalido = () =>
  new ErroDeNegocio(
    "arquivo_invalido",
    "Envie uma foto (JPG, PNG ou WEBP) ou um PDF de até 4 MB.",
  );
export const comprovanteDuplicado = (enviadoEm: Date) =>
  new ErroDeNegocio(
    "comprovante_duplicado",
    `Esta nota já foi enviada em ${formatarData(enviadoEm)}.`,
  );

/**
 * Páginas de um PDF contando os objetos "/Type /Page" (barato, sem biblioteca).
 * ponytail: PDFs com object streams comprimidos escondem a contagem → 0 = "não deu para checar" e passa.
 */
export function contarPaginasDoPdf(bytes: Uint8Array): number {
  const texto = new TextDecoder("latin1").decode(bytes);
  return texto.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
}

/** Início do mês corrente no fuso America/Araguaina (UTC−3, sem horário de verão). */
export const inicioDoMes = (agora: Date) =>
  new Date(`${hojeISO(agora).slice(0, 7)}-01T00:00:00-03:00`);
export const DIAS_PARA_ALERTA = 10;
const CAMPOS_CORRIGIVEIS: readonly CampoCorrigivel[] = [
  "tipo",
  "valorCentavos",
  "data",
  "emissor",
  "documentoEmissor",
  "chaveDeAcesso",
  "itens",
];

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);

/**
 * RF-42 (puro): pendente cuja data já está coberta por uma importação (data <= periodo.ate) há mais
 * de 10 dias, contados da data da primeira importação que a cobriu (fuso America/Araguaina).
 */
export function alertaDoComprovante(
  c: Pick<Comprovante, "situacao" | "data">,
  importacoes: readonly Pick<ImportacaoDeExtrato, "periodo" | "criadaEm">[],
  agora: Date,
): AlertaDoComprovante | null {
  if (c.situacao !== "pendente" || !c.data) return null;
  const data = c.data;
  const cobertaEm = importacoes
    .filter((i) => i.periodo.ate >= data)
    .map((i) => hojeISO(i.criadaEm))
    .sort()[0];
  return cobertaEm && diasEntre(cobertaEm, hojeISO(agora)) > DIAS_PARA_ALERTA
    ? "sem_transacao_no_extrato"
    : null;
}

const naoEncontrado = (o = "Comprovante") =>
  new ErroDeNegocio("nao_encontrado", `${o} não encontrado.`);

const id = z.uuid();
const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().startsWith(d));
const centavos = z.number().int().positive().max(1e13);
const esquemaDaCorrecao = z
  .object({
    tipo: z.enum(["pix", "boleto", "nfce", "nfe", "recibo", "outro"]),
    valorCentavos: centavos,
    data: dataISO.nullable(),
    emissor: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .transform((v) => v || null),
    documentoEmissor: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{11}(\d{3})?$/))
      .nullable(),
    chaveDeAcesso: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine(chaveDeAcessoValida)
      .nullable(),
    itens: z
      .array(
        z.object({
          descricao: z.string().trim().min(1).max(200),
          quantidade: z.number().positive().nullable(),
          valorCentavos: z.number().int().min(0).max(1e13).nullable(),
        }),
      )
      .max(200),
  })
  .partial();
const esquemaDosFiltros = z
  .object({
    situacao: z
      .enum(["lendo", "conciliado", "pendente", "ambiguo", "erro_de_leitura"])
      .optional(),
    comAlerta: z.boolean().optional(),
  })
  .optional();

export function criarServicoDeComprovantes(deps: {
  leitor: LeitorDeComprovantes;
  comprovantes: RepositorioDeComprovantes;
  anexos: Pick<RepositorioDeAnexos, "criar" | "buscarPorComprovante">;
  importacoes: Pick<RepositorioDeImportacoes, "listar">;
  armazenamento: ArmazenamentoDeArquivos;
  transacoes: Pick<
    RepositorioDeTransacoes,
    "buscarPorId" | "candidatosParaConciliacao"
  >;
  categorizacao: {
    categorizarComDica(
      empresaId: Id,
      transacaoId: Id,
      dica: string,
    ): Promise<boolean>;
  };
  consumirLimite: ConsumirLimite;
  /** RECURSO_COMPROVANTES_IA */
  ligado: () => boolean;
  /** IA_LIMITE_COMPROVANTES_MES */
  limiteMensal: () => number;
  agora?: () => Date;
}): ServicoDeComprovantes {
  const agora = deps.agora ?? (() => new Date());
  async function exigir(ctx: ContextoDoUsuario, comprovanteId: Id) {
    const c = id.safeParse(comprovanteId).success
      ? await deps.comprovantes.buscarPorId(ctx.empresaId, comprovanteId)
      : null;
    if (!c) throw naoEncontrado();
    return c;
  }

  /** Itens e emissor sugerem a categoria; a corrente nunca sobrescreve a do usuário. */
  async function sugerirCategoria(empresaId: Id, c: Comprovante) {
    if (!c.transacaoId) return;
    const itens = c.itens
      .slice(0, 20)
      .map((i) => i.descricao)
      .join(", ");
    const dica = [c.emissor, itens].filter(Boolean).join(" | ");
    if (!dica) return;
    try {
      await deps.categorizacao.categorizarComDica(
        empresaId,
        c.transacaoId,
        dica,
      );
    } catch (erro) {
      registrarFalha("sugestão de categoria pelo comprovante", erro);
    }
  }

  async function tentarConciliar(
    empresaId: Id,
    c: Comprovante,
  ): Promise<Comprovante> {
    if (c.situacao === "conciliado" || !c.valorCentavos || !c.data) return c;
    const candidatos = await deps.transacoes.candidatosParaConciliacao(
      empresaId,
      {
        valorCentavos: c.valorCentavos,
        data: c.data,
        toleranciaDias: TOLERANCIA_EM_DIAS,
      },
    );
    // RF-39: transação que já tem comprovante conciliado não é candidata.
    const ocupadas = new Set(
      candidatos.length
        ? await deps.comprovantes.listarTransacoesConciliadas(
            empresaId,
            candidatos.map((t) => t.id),
          )
        : [],
    );
    const r = conciliar(
      c,
      candidatos.filter((t) => !ocupadas.has(t.id)),
    );
    if (r.situacao === c.situacao) return c;
    const atualizado = await deps.comprovantes.atualizar(empresaId, c.id, {
      situacao: r.situacao,
      transacaoId: r.situacao === "conciliado" ? r.transacaoId : null,
    });
    await sugerirCategoria(empresaId, atualizado);
    return atualizado;
  }

  /** Desfaz um envio que não chegou ao fim (linha + anexo em cascata + arquivo). */
  async function descartar(empresaId: Id, comprovanteId: Id, caminho?: string) {
    await deps.comprovantes
      .remover(empresaId, comprovanteId)
      .catch((e) => registrarFalha("descartar comprovante", e));
    if (caminho)
      await deps.armazenamento
        .remover([caminho])
        .catch((e) => registrarFalha("remover arquivo órfão", e));
  }

  const desligado = () =>
    new ErroDeNegocio(
      "recurso_desligado",
      "A leitura de comprovantes está desligada no momento.",
    );

  async function tetoAtingido(empresaId: Id) {
    const lidas = await deps.comprovantes.contarLeiturasDesde(
      empresaId,
      inicioDoMes(agora()),
    );
    return lidas >= deps.limiteMensal();
  }

  const motivoDaFalha = (erro: unknown) =>
    erro instanceof ErroDeLeitura ? erro.motivo : "falha_na_leitura";

  async function exigirChaveLivre(empresaId: Id, chave: string, proprio?: Id) {
    const existente = await deps.comprovantes.buscarPorChave(empresaId, chave);
    if (existente && existente.id !== proprio)
      throw comprovanteDuplicado(existente.criadoEm);
  }

  return {
    async enviar(ctx, arquivo, dica) {
      if (!deps.ligado()) throw desligado();
      if (
        !(arquivo instanceof Blob) ||
        arquivo.size < 1 ||
        arquivo.size > TAMANHO_MAXIMO_DO_COMPROVANTE
      )
        throw arquivoInvalido();
      await exigirLimite(
        deps.consumirLimite,
        `comprovante:usuario:${ctx.usuarioId}`,
        LIMITES.comprovante,
      );
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const tipoMime = detectarTipo(bytes.subarray(0, 16));
      // O MIME declarado, se veio, precisa bater com o conteúdo real.
      if (!tipoMime || (arquivo.type && arquivo.type !== tipoMime))
        throw arquivoInvalido();
      if (
        tipoMime === "application/pdf" &&
        contarPaginasDoPdf(bytes) > MAXIMO_DE_PAGINAS_DO_PDF
      )
        throw new ErroDeNegocio(
          "arquivo_invalido",
          `PDF com mais de ${MAXIMO_DE_PAGINAS_DO_PDF} páginas. Envie só a página do comprovante.`,
        );

      const empresaId = ctx.empresaId;
      const chaveDoQr =
        typeof dica?.chaveDeAcesso === "string"
          ? extrairChaveDeAcessoDoQr(dica.chaveDeAcesso)
          : null;
      // Antes de pagar a leitura: a nota do QR já foi lançada?
      if (chaveDoQr) await exigirChaveLivre(empresaId, chaveDoQr);

      // Conta antes de criar a linha deste envio.
      const noTeto = await tetoAtingido(empresaId);
      const comprovante = await deps.comprovantes.criar(
        empresaId,
        ctx.usuarioId,
      );
      const caminho = `${empresaId}/comprovantes/${comprovante.id}/${randomUUID()}.${EXTENSOES[tipoMime]}`;
      try {
        await deps.armazenamento.enviar(caminho, arquivo, tipoMime);
      } catch (erro) {
        await descartar(empresaId, comprovante.id);
        throw erro;
      }
      try {
        await deps.anexos.criar(
          empresaId,
          {
            transacaoId: null,
            comprovanteId: comprovante.id,
            caminho,
            nomeArquivo: limparNomeDoArquivo(
              (arquivo as File).name ?? "",
              tipoMime,
            ),
            tipoMime,
            tamanhoBytes: arquivo.size,
          },
          ctx.usuarioId,
        );
      } catch (erro) {
        await descartar(empresaId, comprovante.id, caminho);
        throw erro;
      }

      if (noTeto)
        // RNF-26: guardado, sem chamar a IA. Dá para corrigir à mão.
        return deps.comprovantes.atualizar(empresaId, comprovante.id, {
          situacao: "erro_de_leitura",
          erro: "limite",
        });

      let dados: DadosDoComprovante;
      try {
        await deps.comprovantes.registrarLeitura(
          empresaId,
          comprovante.id,
          agora(),
        );
        dados = await deps.leitor.ler(
          { bytes, tipoMime },
          chaveDoQr ? { chaveDeAcesso: chaveDoQr } : undefined,
        );
      } catch (erro) {
        registrarFalha("leitura do comprovante", erro);
        // O arquivo fica guardado: o usuário pode corrigir os dados à mão.
        return deps.comprovantes.atualizar(empresaId, comprovante.id, {
          situacao: "erro_de_leitura",
          erro: motivoDaFalha(erro),
        });
      }
      const chave = chaveDoQr ?? dados.chaveDeAcesso;

      let lido: Comprovante;
      try {
        if (chave) await exigirChaveLivre(empresaId, chave, comprovante.id);
        lido = await deps.comprovantes.atualizar(empresaId, comprovante.id, {
          ...dados,
          chaveDeAcesso: chave,
          situacao: "pendente",
          erro: null,
        });
      } catch (erro) {
        await descartar(empresaId, comprovante.id, caminho);
        throw erro;
      }
      return tentarConciliar(empresaId, lido);
    },

    async listar(ctx, filtros) {
      const valido = esquemaDosFiltros.safeParse(filtros);
      if (!valido.success) throw entradaInvalida();
      const lista = await deps.comprovantes.listar(ctx.empresaId, {
        situacao: valido.data?.situacao,
      });
      const importacoes = lista.some((c) => c.situacao === "pendente")
        ? await deps.importacoes.listar(ctx.empresaId)
        : [];
      const comAlerta = lista.map((c) => ({
        ...c,
        alerta: alertaDoComprovante(c, importacoes, agora()),
      }));
      return valido.data?.comAlerta
        ? comAlerta.filter((c) => c.alerta)
        : comAlerta;
    },

    async contarAlertas(ctx) {
      const alertados = await this.listar(ctx, {
        situacao: "pendente",
        comAlerta: true,
      });
      return { comprovantesSemTransacao: alertados.length };
    },

    async lerDeNovo(ctx, comprovanteId) {
      const c = await exigir(ctx, comprovanteId);
      if (!deps.ligado()) throw desligado();
      await exigirLimite(
        deps.consumirLimite,
        `comprovante:usuario:${ctx.usuarioId}`,
        LIMITES.comprovante,
      );
      const empresaId = ctx.empresaId;
      if (await tetoAtingido(empresaId))
        throw new ErroDeNegocio(
          "limite_excedido",
          "Limite mensal de leituras atingido. Corrija os dados à mão ou tente no mês que vem.",
        );
      const anexo = await deps.anexos.buscarPorComprovante(empresaId, c.id);
      if (!anexo) throw naoEncontrado("Arquivo do comprovante");
      const bytes = await deps.armazenamento.baixar(anexo.caminho);

      let dados: DadosDoComprovante;
      try {
        await deps.comprovantes.registrarLeitura(empresaId, c.id, agora());
        dados = await deps.leitor.ler(
          { bytes, tipoMime: anexo.tipoMime },
          c.chaveDeAcesso ? { chaveDeAcesso: c.chaveDeAcesso } : undefined,
        );
      } catch (erro) {
        registrarFalha("releitura do comprovante", erro);
        // Conciliado continua conciliado; o resto volta a erro de leitura. O arquivo fica.
        return deps.comprovantes.atualizar(empresaId, c.id, {
          erro: motivoDaFalha(erro),
          ...(c.situacao === "conciliado"
            ? {}
            : { situacao: "erro_de_leitura" as const }),
        });
      }

      // RF-41: o que o usuário corrigiu não é sobrescrito.
      const protegidos = new Set(c.camposCorrigidos);
      const novos = Object.fromEntries(
        CAMPOS_CORRIGIVEIS.filter((campo) => !protegidos.has(campo)).map(
          (campo) => [campo, dados[campo]],
        ),
      ) as DadosDoComprovanteNoBanco;
      if (novos.chaveDeAcesso && novos.chaveDeAcesso !== c.chaveDeAcesso) {
        const existente = await deps.comprovantes.buscarPorChave(
          empresaId,
          novos.chaveDeAcesso,
        );
        // Chave de outro comprovante: mantém a atual em vez de falhar a releitura.
        if (existente && existente.id !== c.id) delete novos.chaveDeAcesso;
      }
      const atualizado = await deps.comprovantes.atualizar(empresaId, c.id, {
        ...novos,
        confianca: dados.confianca,
        erro: null,
        ...(c.situacao === "conciliado"
          ? {}
          : { situacao: "pendente" as const }),
      });
      return tentarConciliar(empresaId, atualizado);
    },

    async listarCandidatos(ctx, comprovanteId) {
      const c = await exigir(ctx, comprovanteId);
      if (!c.valorCentavos || !c.data) return [];
      return deps.transacoes.candidatosParaConciliacao(ctx.empresaId, {
        valorCentavos: c.valorCentavos,
        data: c.data,
        toleranciaDias: TOLERANCIA_DA_ESCOLHA_MANUAL,
      });
    },

    async conciliarManualmente(ctx, comprovanteId, transacaoId) {
      const c = await exigir(ctx, comprovanteId);
      const transacao = id.safeParse(transacaoId).success
        ? await deps.transacoes.buscarPorId(ctx.empresaId, transacaoId)
        : null;
      if (!transacao) throw naoEncontrado("Transação");
      const atualizado = await deps.comprovantes.atualizar(
        ctx.empresaId,
        c.id,
        {
          situacao: "conciliado",
          transacaoId: transacao.id,
        },
      );
      await sugerirCategoria(ctx.empresaId, atualizado);
      return atualizado;
    },

    async desfazerConciliacao(ctx, comprovanteId) {
      const c = await exigir(ctx, comprovanteId);
      if (c.situacao !== "conciliado") return c;
      return deps.comprovantes.atualizar(ctx.empresaId, c.id, {
        situacao: "pendente",
        transacaoId: null,
      });
    },

    async corrigirDados(ctx, comprovanteId, dados) {
      const c = await exigir(ctx, comprovanteId);
      const valido = esquemaDaCorrecao.safeParse(dados);
      if (!valido.success) throw entradaInvalida();
      const corrigidos = Object.keys(valido.data) as CampoCorrigivel[];
      const correcao: DadosDoComprovanteNoBanco = {
        ...valido.data,
        camposCorrigidos: [...new Set([...c.camposCorrigidos, ...corrigidos])],
      };
      if (correcao.chaveDeAcesso)
        await exigirChaveLivre(ctx.empresaId, correcao.chaveDeAcesso, c.id);
      // Erro de leitura corrigido com valor vira pendente (e tenta conciliar).
      if (
        (c.situacao === "erro_de_leitura" || c.situacao === "lendo") &&
        (correcao.valorCentavos ?? c.valorCentavos)
      ) {
        correcao.situacao = "pendente";
        correcao.erro = null;
        correcao.tipo ??= c.tipo ?? "outro";
      }
      const atualizado = await deps.comprovantes.atualizar(
        ctx.empresaId,
        c.id,
        correcao,
      );
      return atualizado.situacao === "pendente" ||
        atualizado.situacao === "ambiguo"
        ? tentarConciliar(ctx.empresaId, atualizado)
        : atualizado;
    },

    async reconciliarPendentes(empresaId) {
      const pendentes = await deps.comprovantes.listar(empresaId, {
        situacao: "pendente",
      });
      let conciliados = 0;
      for (const c of pendentes) {
        try {
          if ((await tentarConciliar(empresaId, c)).situacao === "conciliado")
            conciliados++;
        } catch (erro) {
          registrarFalha("reconciliar comprovante", erro);
        }
      }
      return conciliados;
    },

    async reconciliarTodas() {
      const empresas = await deps.comprovantes.empresasComPendentes();
      let conciliados = 0;
      for (const empresaId of empresas)
        try {
          conciliados += await this.reconciliarPendentes(empresaId);
        } catch (erro) {
          registrarFalha("reconciliar comprovantes da empresa", erro);
        }
      return { empresas: empresas.length, conciliados };
    },

    async remover(ctx, comprovanteId) {
      const c = await exigir(ctx, comprovanteId);
      const anexo = await deps.anexos.buscarPorComprovante(ctx.empresaId, c.id);
      await deps.comprovantes.remover(ctx.empresaId, c.id);
      if (anexo)
        await deps.armazenamento
          .remover([anexo.caminho])
          .catch((e) => registrarFalha("remover arquivo do comprovante", e));
    },
  };
}
