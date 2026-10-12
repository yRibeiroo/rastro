"use server";
import "server-only";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  enviarLinkMagico as enviarLink,
  sair as sairDaSessao,
} from "../acesso";
import type { NovaRegra, SugestaoDeRegra } from "../categorizacao";
import type { ResultadoDaImportacao } from "../importacao-de-extrato";
import { ErroDeNegocio, type ResultadoDaAcao } from "../erros";
import { servicosDoUsuario } from "../montagem";
import type {
  Anexo,
  Categoria,
  CentroDeCusto,
  Comprovante,
  Conexao,
  DadosDoComprovante,
  Id,
  Regra,
  TipoDeCategoria,
  Transacao,
} from "../tipos";
import { executarAcao, ipDaRequisicao } from "./resultado";

// Server Actions do Rastro. Sem ctx (a sessão e a allowlist são conferidas aqui, em toda chamada) e retorno ResultadoDaAcao<T>.

/** Executa com sessão + allowlist e atualiza a tela depois de uma mutação bem-sucedida. */
async function mutacao<T>(
  nome: string,
  operacao: (s: Awaited<ReturnType<typeof servicosDoUsuario>>) => Promise<T>,
): Promise<ResultadoDaAcao<T>> {
  const resultado = await executarAcao(nome, async () =>
    operacao(await servicosDoUsuario()),
  );
  if (resultado.ok) refresh();
  return resultado;
}

// ── Entrada ─────────────────────────────────────────────────────────────────

/** Resposta neutra: e-mail fora da allowlist recebe o mesmo { ok: true }. Rate limit por IP e e-mail. */
export async function enviarLinkMagico(
  email: string,
): Promise<ResultadoDaAcao<null>> {
  return executarAcao("enviarLinkMagico", async () => {
    if (typeof email !== "string")
      throw new ErroDeNegocio("entrada_invalida", "Digite um e-mail válido.");
    await enviarLink(email, ipDaRequisicao(await headers()));
    return null;
  });
}

/** Encerra a sessão e volta para /entrar. */
export async function sair(): Promise<void> {
  try {
    await sairDaSessao();
  } finally {
    redirect("/entrar");
  }
}

// ── Conexões bancárias ──────────────────────────────────────────────────────

/** Token curto para o widget. Com conexaoIdParaReconectar, reconecta/renova o consentimento. */
export async function iniciarConexao(opcoes?: {
  conexaoIdParaReconectar?: Id;
}): Promise<ResultadoDaAcao<{ token: string }>> {
  return executarAcao("iniciarConexao", async () => {
    const s = await servicosDoUsuario();
    return s.conexoes.iniciarConexao(s.ctx, opcoes);
  });
}

/** itemId devolvido pelo widget: validado na Pluggy (404 ou outra empresa => conexao_nao_encontrada). */
export async function registrarConexao(
  idExterno: string,
): Promise<ResultadoDaAcao<Conexao>> {
  return mutacao("registrarConexao", (s) =>
    s.conexoes.registrarConexao(s.ctx, idExterno),
  );
}

export async function sincronizarAgora(
  conexaoId: Id,
): Promise<ResultadoDaAcao<{ transacoesGravadas: number }>> {
  return mutacao("sincronizarAgora", (s) =>
    s.sincronizacao.sincronizarAgora(s.ctx, conexaoId),
  );
}

// ── Extrato e categorização ─────────────────────────────────────────────────

export async function corrigirCategoria(
  transacaoId: Id,
  dados: { categoriaId: Id | null; centroDeCustoId: Id | null },
): Promise<
  ResultadoDaAcao<{
    transacao: Transacao;
    sugestaoDeRegra: SugestaoDeRegra | null;
  }>
> {
  return mutacao("corrigirCategoria", (s) =>
    s.categorizacao.corrigirCategoria(s.ctx, transacaoId, dados),
  );
}

export async function criarRegra(
  dados: NovaRegra,
): Promise<ResultadoDaAcao<{ regra: Regra; transacoesAlteradas: number }>> {
  return mutacao("criarRegra", (s) => s.categorizacao.criarRegra(s.ctx, dados));
}

export async function atualizarRegra(
  regraId: Id,
  dados: Partial<
    Pick<
      Regra,
      | "padrao"
      | "campo"
      | "prioridade"
      | "categoriaId"
      | "centroDeCustoId"
      | "ativa"
    >
  >,
): Promise<ResultadoDaAcao<Regra>> {
  return mutacao("atualizarRegra", (s) =>
    s.categorizacao.atualizarRegra(s.ctx, regraId, dados),
  );
}

export async function removerRegra(
  regraId: Id,
): Promise<ResultadoDaAcao<null>> {
  return mutacao("removerRegra", async (s) => {
    await s.categorizacao.removerRegra(s.ctx, regraId);
    return null;
  });
}

export async function criarCategoria(dados: {
  nome: string;
  tipo: TipoDeCategoria;
  entraNoResultado?: boolean;
}): Promise<ResultadoDaAcao<Categoria>> {
  return mutacao("criarCategoria", (s) =>
    s.categorizacao.criarCategoria(s.ctx, dados),
  );
}

export async function atualizarCategoria(
  categoriaId: Id,
  dados: Partial<
    Pick<Categoria, "nome" | "tipo" | "entraNoResultado" | "arquivada">
  >,
): Promise<ResultadoDaAcao<Categoria>> {
  return mutacao("atualizarCategoria", (s) =>
    s.categorizacao.atualizarCategoria(s.ctx, categoriaId, dados),
  );
}

// ── Centros de custo ────────────────────────────────────────────────────────

export async function criarCentroDeCusto(dados: {
  nome: string;
}): Promise<ResultadoDaAcao<CentroDeCusto>> {
  return mutacao("criarCentroDeCusto", (s) =>
    s.centrosDeCusto.criar(s.ctx, dados),
  );
}

export async function atualizarCentroDeCusto(
  centroDeCustoId: Id,
  dados: Partial<Pick<CentroDeCusto, "nome" | "arquivado">>,
): Promise<ResultadoDaAcao<CentroDeCusto>> {
  return mutacao("atualizarCentroDeCusto", (s) =>
    s.centrosDeCusto.atualizar(s.ctx, centroDeCustoId, dados),
  );
}

// ── Anexos ──────────────────────────────────────────────────────────────────

/** FormData com o campo "arquivo" (File). */
export async function anexar(
  transacaoId: Id,
  formulario: FormData,
): Promise<ResultadoDaAcao<Anexo>> {
  return mutacao("anexar", (s) => {
    const arquivo =
      formulario instanceof FormData ? formulario.get("arquivo") : null;
    if (!(arquivo instanceof File))
      throw new ErroDeNegocio(
        "anexo_invalido",
        "Arquivo não permitido (PDF, JPG, PNG ou WEBP de até 4 MB).",
      );
    return s.anexos.anexar(s.ctx, transacaoId, arquivo);
  });
}

/** URL assinada válida por 60 s. */
export async function gerarLinkTemporario(
  anexoId: Id,
): Promise<ResultadoDaAcao<{ url: string; expiraEm: Date }>> {
  return executarAcao("gerarLinkTemporario", async () => {
    const s = await servicosDoUsuario();
    return s.anexos.gerarLinkTemporario(s.ctx, anexoId);
  });
}

export async function removerAnexo(
  anexoId: Id,
): Promise<ResultadoDaAcao<null>> {
  return mutacao("removerAnexo", async (s) => {
    await s.anexos.remover(s.ctx, anexoId);
    return null;
  });
}

// ── Importar extrato e comprovantes (ADR 0016) ─────────────────────────────

/** Arquivo do FormData (campo "arquivo") ou null. */
const arquivoDo = (formulario: unknown) => {
  const arquivo =
    formulario instanceof FormData ? formulario.get("arquivo") : null;
  return arquivo instanceof File ? arquivo : null;
};

/** FormData com "arquivo" (.ofx até 5 MB). Rate limit 20/h. Reimportar não duplica. */
export async function importarExtrato(
  formulario: FormData,
): Promise<ResultadoDaAcao<ResultadoDaImportacao>> {
  return mutacao("importarExtrato", (s) => {
    const arquivo = arquivoDo(formulario);
    if (!arquivo)
      throw new ErroDeNegocio(
        "arquivo_invalido",
        "Envie o extrato em OFX (.ofx) de até 5 MB.",
      );
    return s.importacao.importar(s.ctx, arquivo);
  });
}

/** FormData com "arquivo" (JPG/PNG/WEBP/PDF até 4 MB) e, opcional, "chaveDeAcesso" (conteúdo do QR). Rate limit 30/h. */
export async function enviarComprovante(
  formulario: FormData,
): Promise<ResultadoDaAcao<Comprovante>> {
  return mutacao("enviarComprovante", (s) => {
    const arquivo = arquivoDo(formulario);
    if (!arquivo)
      throw new ErroDeNegocio(
        "arquivo_invalido",
        "Envie uma foto (JPG, PNG ou WEBP) ou um PDF de até 4 MB.",
      );
    const chave = (formulario as FormData).get("chaveDeAcesso");
    return s.comprovantes.enviar(
      s.ctx,
      arquivo,
      typeof chave === "string" && chave.trim()
        ? { chaveDeAcesso: chave.slice(0, 1000) }
        : undefined,
    );
  });
}

export async function conciliarComprovante(
  comprovanteId: Id,
  transacaoId: Id,
): Promise<ResultadoDaAcao<Comprovante>> {
  return mutacao("conciliarComprovante", (s) =>
    s.comprovantes.conciliarManualmente(s.ctx, comprovanteId, transacaoId),
  );
}

/** RF-40: volta o comprovante a 'pendente' (o arquivo continua). */
export async function desfazerConciliacao(
  comprovanteId: Id,
): Promise<ResultadoDaAcao<Comprovante>> {
  return mutacao("desfazerConciliacao", (s) =>
    s.comprovantes.desfazerConciliacao(s.ctx, comprovanteId),
  );
}

export async function corrigirComprovante(
  comprovanteId: Id,
  dados: Partial<DadosDoComprovante>,
): Promise<ResultadoDaAcao<Comprovante>> {
  return mutacao("corrigirComprovante", (s) =>
    s.comprovantes.corrigirDados(s.ctx, comprovanteId, dados),
  );
}

export async function removerComprovante(
  comprovanteId: Id,
): Promise<ResultadoDaAcao<null>> {
  return mutacao("removerComprovante", async (s) => {
    await s.comprovantes.remover(s.ctx, comprovanteId);
    return null;
  });
}

/** RF-41 "Tentar ler de novo": conta para o teto mensal e o rate limit (30/h); campos corrigidos à mão ficam. */
export async function lerComprovanteDeNovo(
  comprovanteId: Id,
): Promise<ResultadoDaAcao<Comprovante>> {
  return mutacao("lerComprovanteDeNovo", (s) =>
    s.comprovantes.lerDeNovo(s.ctx, comprovanteId),
  );
}
