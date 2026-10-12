import "server-only";
import type {
  RepositorioDeConexoes,
  RepositorioDeContas,
  RepositorioDeImportacoes,
  RepositorioDeTransacoes,
} from "@/acesso-a-dados/contratos";
import { exigirLimite, LIMITES, type ConsumirLimite } from "../acesso";
import { hojeISO } from "@/ferramentas-internas/formatar-data";
import { registrarFalha } from "../erros";
import type {
  ContextoDoUsuario,
  DataISO,
  Id,
  ImportacaoDeExtrato,
} from "../tipos";
import { arquivoInvalido, type LeitorDeExtrato } from "./leitor-ofx";

export interface ResultadoDaImportacao {
  importacaoId: Id;
  novas: number;
  atualizadas: number;
  periodo: { de: DataISO; ate: DataISO };
  comprovantesConciliados: number;
}

export interface SituacaoDoExtrato {
  ultimaImportacaoEm: Date | null;
  diasDesdeAUltima: number | null; // dias de calendário no fuso America/Araguaina
  desatualizado: boolean; // >= 7 dias (P-33); false sem nenhuma importação (a interface trata o null)
}

export const DIAS_PARA_DESATUALIZADO = 7;

/** RF-34 (puro). */
export function situacaoDoExtrato(
  ultimaImportacaoEm: Date | null,
  agora: Date,
): SituacaoDoExtrato {
  if (!ultimaImportacaoEm)
    return {
      ultimaImportacaoEm: null,
      diasDesdeAUltima: null,
      desatualizado: false,
    };
  const dias = Math.round(
    (Date.parse(hojeISO(agora)) - Date.parse(hojeISO(ultimaImportacaoEm))) /
      86_400_000,
  );
  return {
    ultimaImportacaoEm,
    diasDesdeAUltima: dias,
    desatualizado: dias >= DIAS_PARA_DESATUALIZADO,
  };
}

export interface ServicoDeImportacao {
  /**
   * OFX de até 5 MB. Rate limit 20/h. Reimportar é idempotente e nunca toca a categoria.
   *
   * Atomicidade (RF-32): as transações vão em lotes de upsert por (empresa_id, id_externo), sem
   * transação de banco envolvendo o arquivo todo. Se a importação cair no meio, parte dos lançamentos
   * fica gravada, mas NENHUM registro em importacoes_de_extrato é criado (ele só é gravado depois de
   * todas as transações). Como o upsert é idempotente, reenviar o mesmo arquivo completa a importação
   * sem duplicar nada.
   */
  importar(
    ctx: ContextoDoUsuario,
    arquivo: File,
  ): Promise<ResultadoDaImportacao>;
  listarImportacoes(ctx: ContextoDoUsuario): Promise<ImportacaoDeExtrato[]>;
  /** RF-34: "Última importação há X dias", desatualizado a partir de 7. */
  situacao(ctx: ContextoDoUsuario): Promise<SituacaoDoExtrato>;
}

export const TAMANHO_MAXIMO_DO_EXTRATO = 5 * 1024 * 1024;
const LOTE = 500;
/** Tipos que navegadores e bancos usam para .ofx (muitos mandam vazio ou octet-stream). */
const TIPOS_ACEITOS = new Set([
  "",
  "application/x-ofx",
  "application/ofx",
  "application/vnd.intu.qfx",
  "application/octet-stream",
  "application/xml",
  "text/xml",
  "text/plain",
  "text/ofx",
]);

const MENSAGEM_DE_TIPO = "Envie o extrato em OFX (.ofx) de até 5 MB.";

/** Nome exibido: sem caminho nem caracteres de controle, até 255. */
const limparNome = (nome: string) =>
  nome
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255) || "extrato.ofx";

export function criarServicoDeImportacao(deps: {
  leitor: LeitorDeExtrato;
  // Service role (as tabelas não aceitam insert pela sessão); tudo filtrado por ctx.empresaId.
  conexoes: RepositorioDeConexoes;
  contas: RepositorioDeContas;
  transacoes: RepositorioDeTransacoes;
  importacoes: RepositorioDeImportacoes;
  categorizacao: { categorizarPendentes(empresaId: Id): Promise<unknown> };
  comprovantes: { reconciliarPendentes(empresaId: Id): Promise<number> };
  consumirLimite: ConsumirLimite;
  agora?: () => Date;
}): ServicoDeImportacao {
  const agora = deps.agora ?? (() => new Date());

  async function semQuebrar<T>(
    contexto: string,
    f: () => Promise<T>,
    padrao: T,
  ) {
    try {
      return await f();
    } catch (erro) {
      // Categorizar e conciliar nunca derrubam a importação: ficam para a próxima.
      registrarFalha(contexto, erro);
      return padrao;
    }
  }

  return {
    async importar(ctx, arquivo) {
      if (
        !(arquivo instanceof Blob) ||
        arquivo.size < 1 ||
        arquivo.size > TAMANHO_MAXIMO_DO_EXTRATO ||
        !TIPOS_ACEITOS.has(arquivo.type.split(";")[0].trim().toLowerCase())
      )
        throw arquivoInvalido(MENSAGEM_DE_TIPO);
      const nome = limparNome((arquivo as File).name ?? "");
      if (!/\.(ofx|qfx)$/i.test(nome)) throw arquivoInvalido(MENSAGEM_DE_TIPO);
      await exigirLimite(
        deps.consumirLimite,
        `importacao:usuario:${ctx.usuarioId}`,
        LIMITES.importacao,
      );

      const extrato = deps.leitor.ler(
        new Uint8Array(await arquivo.arrayBuffer()),
      );
      const empresaId = ctx.empresaId;

      // Uma conexão 'arquivo' por empresa, com id_externo = empresa_id (convenção da migração).
      const conexao = await deps.conexoes.salvar(
        empresaId,
        {
          idExterno: empresaId,
          provedor: "arquivo",
          banco: extrato.banco,
          status: "atualizada",
          erro: null,
          consentimentoExpiraEm: null,
        },
        ctx.usuarioId,
      );

      // Arquivo mais antigo que o último importado não pode regredir o saldo.
      const salvas = await deps.contas.listar(empresaId);
      const existente = salvas.find(
        (c) =>
          c.conexaoId === conexao.id && c.idExterno === extrato.conta.idExterno,
      );
      const ultimoFim = existente
        ? await deps.importacoes.ultimoFimDePeriodo(empresaId, existente.id)
        : null;
      const [conta] = await deps.contas.salvarVarias(empresaId, conexao.id, [
        existente && ultimoFim && ultimoFim > extrato.periodo.ate
          ? { ...extrato.conta, saldoCentavos: existente.saldoCentavos }
          : extrato.conta,
      ]);

      const ids = extrato.transacoes.map((t) => t.idExterno);
      let atualizadas = 0;
      for (let i = 0; i < ids.length; i += LOTE)
        atualizadas += (
          await deps.transacoes.listarIdsExternosExistentes(
            empresaId,
            ids.slice(i, i + LOTE),
          )
        ).length;
      const linhas = extrato.transacoes.map((t) => ({
        ...t,
        contaId: conta.id,
      }));
      for (let i = 0; i < linhas.length; i += LOTE)
        await deps.transacoes.salvarDoProvedor(
          empresaId,
          conexao.id,
          linhas.slice(i, i + LOTE),
        );
      await deps.conexoes.marcarSincronizada(empresaId, conexao.id, agora());

      const importacao = await deps.importacoes.criar(empresaId, {
        conexaoId: conexao.id,
        contaId: conta.id,
        nomeDoArquivo: nome,
        periodo: extrato.periodo,
        novas: linhas.length - atualizadas,
        atualizadas,
      });

      await semQuebrar(
        "categorização após importar",
        () => deps.categorizacao.categorizarPendentes(empresaId),
        null,
      );
      const comprovantesConciliados = await semQuebrar(
        "conciliação após importar",
        () => deps.comprovantes.reconciliarPendentes(empresaId),
        0,
      );
      // Só contagens no log, nunca conteúdo.
      console.info(
        `[rastro] importação: ${importacao.novas} novas, ${atualizadas} atualizadas`,
      );
      return {
        importacaoId: importacao.id,
        novas: importacao.novas,
        atualizadas,
        periodo: extrato.periodo,
        comprovantesConciliados,
      };
    },

    listarImportacoes: (ctx) => deps.importacoes.listar(ctx.empresaId),

    async situacao(ctx) {
      const [ultima] = await deps.importacoes.listar(ctx.empresaId);
      return situacaoDoExtrato(ultima?.criadaEm ?? null, agora());
    },
  };
}
