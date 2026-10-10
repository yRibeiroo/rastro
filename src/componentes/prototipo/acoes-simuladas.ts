"use server";

/**
 * Server Actions SIMULADAS do protótipo. Mesmas assinaturas que as `acoes.ts` reais terão
 * (contratos.md: todo retorno é ResultadoDaAcao<T>), sem o ctx. Para ligar o backend, troque o
 * import nos componentes/páginas por `./acoes` da rota e apague este arquivo.
 *
 * Gatilhos de teste: e-mail com "erro" falha, com "limite" estoura o rate limit;
 * nome de arquivo com "falha" falha no upload.
 */
import { redirect } from "next/navigation";
import { anexos, categorias, centrosDeCusto, conexoes, EMPRESA_ID, regras, transacoes } from "./dados-de-exemplo";
import { normalizarTexto } from "./fonte-de-dados";
import type {
  Anexo,
  CampoDaRegra,
  CodigoDeErro,
  Categoria,
  CentroDeCusto,
  Conexao,
  Id,
  NovaRegra,
  Regra,
  ResultadoDaAcao,
  SugestaoDeRegra,
  TipoDeCategoria,
  Transacao,
} from "./tipos-provisorios";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ok = <T,>(dados: T): ResultadoDaAcao<T> => ({ ok: true, dados });
const falha = (codigo: CodigoDeErro | "inesperado", mensagem: string) =>
  ({ ok: false, erro: { codigo, mensagem } }) as const;

// ── Entrada ─────────────────────────────────────────────────────────────────
export async function enviarLinkMagico(email: string): Promise<ResultadoDaAcao<null>> {
  await esperar(900);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return falha("entrada_invalida", "Digite um e-mail válido.");
  if (email.includes("limite")) return falha("limite_excedido", "Muitas tentativas. Tente de novo em alguns minutos.");
  if (email.includes("erro")) return falha("inesperado", "Não conseguimos enviar agora. Tente de novo em instantes.");
  // E-mail fora da allowlist recebe a MESMA resposta (contratos §9): nada é revelado.
  return ok(null);
}

/** Encerra a sessão e volta para /entrar (RF-03). O real chama acesso.sair() antes do redirect. */
export async function sair(): Promise<void> {
  redirect("/entrar");
}

// ── Extrato e categorização ─────────────────────────────────────────────────
const SUFIXOS = / (LTDA|EIRELI|ME|SA|S\/A)$/;

function sugerirRegra(t: Transacao, categoriaId: Id, centroDeCustoId: Id | null): SugestaoDeRegra {
  const campo: CampoDaRegra = t.contraparte ? "contraparte" : "descricao";
  const padrao = t.contraparte
    ? normalizarTexto(t.contraparte).replace(SUFIXOS, "")
    : normalizarTexto(t.descricao.replace(/\d+/g, " "));
  const transacoesAfetadas = transacoes.filter(
    (x) => x.id !== t.id && !x.categoriaDefinidaPeloUsuario && normalizarTexto((campo === "contraparte" ? x.contraparte : x.descricao) ?? "").includes(padrao),
  ).length;
  return { padrao, campo, categoriaId, centroDeCustoId, transacoesAfetadas };
}

export async function corrigirCategoria(
  transacaoId: Id,
  dados: { categoriaId: Id | null; centroDeCustoId: Id | null },
): Promise<ResultadoDaAcao<{ transacao: Transacao; sugestaoDeRegra: SugestaoDeRegra | null }>> {
  await esperar(350);
  const t = transacoes.find((x) => x.id === transacaoId);
  if (!t) return falha("nao_encontrado", "Transação não encontrada.");
  const mudouCategoria = t.categoriaId !== dados.categoriaId;
  Object.assign(t, {
    categoriaId: dados.categoriaId,
    centroDeCustoId: dados.centroDeCustoId,
    categoriaOrigem: dados.categoriaId ? "usuario" : null,
    categoriaDefinidaPeloUsuario: true,
    regraId: null,
    confiancaIa: null,
    atualizadaEm: new Date(),
  } satisfies Partial<Transacao>);
  const sugestaoDeRegra = mudouCategoria && dados.categoriaId ? sugerirRegra(t, dados.categoriaId, dados.centroDeCustoId) : null;
  return ok({ transacao: { ...t }, sugestaoDeRegra });
}

export async function criarRegra(dados: NovaRegra): Promise<ResultadoDaAcao<{ regra: Regra; transacoesAlteradas: number }>> {
  await esperar(500);
  const padrao = normalizarTexto(dados.padrao);
  if (padrao.length < 2) return falha("entrada_invalida", "A condição precisa de pelo menos 2 letras.");
  const regra: Regra = {
    id: crypto.randomUUID(),
    empresaId: EMPRESA_ID,
    padrao,
    campo: dados.campo,
    prioridade: dados.prioridade ?? 50,
    categoriaId: dados.categoriaId,
    centroDeCustoId: dados.centroDeCustoId ?? null,
    origem: dados.origem,
    ativa: true,
    criadaEm: new Date(),
  };
  regras.push(regra);
  let transacoesAlteradas = 0;
  if (dados.aplicarNasExistentes) {
    for (const t of transacoes) {
      if (t.categoriaDefinidaPeloUsuario) continue;
      if (!normalizarTexto((dados.campo === "contraparte" ? t.contraparte : t.descricao) ?? "").includes(padrao)) continue;
      Object.assign(t, { categoriaId: regra.categoriaId, centroDeCustoId: regra.centroDeCustoId ?? t.centroDeCustoId, categoriaOrigem: "regra", regraId: regra.id });
      transacoesAlteradas++;
    }
  }
  return ok({ regra: { ...regra }, transacoesAlteradas });
}

export async function atualizarRegra(
  regraId: Id,
  dados: Partial<Pick<Regra, "padrao" | "campo" | "prioridade" | "categoriaId" | "centroDeCustoId" | "ativa">>,
): Promise<ResultadoDaAcao<Regra>> {
  await esperar(250);
  const r = regras.find((x) => x.id === regraId);
  if (!r) return falha("nao_encontrado", "Regra não encontrada.");
  Object.assign(r, dados, dados.padrao !== undefined ? { padrao: normalizarTexto(dados.padrao) } : {});
  return ok({ ...r });
}

export async function removerRegra(regraId: Id): Promise<ResultadoDaAcao<null>> {
  await esperar(250);
  const i = regras.findIndex((x) => x.id === regraId);
  if (i < 0) return falha("nao_encontrado", "Regra não encontrada.");
  regras.splice(i, 1);
  return ok(null);
}

export async function criarCategoria(dados: { nome: string; tipo: TipoDeCategoria }): Promise<ResultadoDaAcao<Categoria>> {
  await esperar(400);
  const nome = dados.nome.trim();
  if (!nome) return falha("entrada_invalida", "Dê um nome para a categoria.");
  if (categorias.some((c) => normalizarTexto(c.nome) === normalizarTexto(nome)))
    return falha("entrada_invalida", `Já existe uma categoria com esse nome.`);
  const nova: Categoria = { id: crypto.randomUUID(), empresaId: EMPRESA_ID, nome, tipo: dados.tipo, entraNoResultado: true, padrao: false, arquivada: false };
  categorias.push(nova);
  return ok({ ...nova });
}

export async function atualizarCategoria(
  categoriaId: Id,
  dados: Partial<Pick<Categoria, "nome" | "tipo" | "entraNoResultado" | "arquivada">>,
): Promise<ResultadoDaAcao<Categoria>> {
  await esperar(300);
  const c = categorias.find((x) => x.id === categoriaId);
  if (!c) return falha("nao_encontrado", "Categoria não encontrada.");
  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();
    if (!nome) return falha("entrada_invalida", "Dê um nome para a categoria.");
    if (categorias.some((x) => x.id !== c.id && normalizarTexto(x.nome) === normalizarTexto(nome)))
      return falha("entrada_invalida", "Já existe uma categoria com esse nome.");
    dados = { ...dados, nome };
  }
  Object.assign(c, dados);
  return ok({ ...c });
}

// ── Centros de custo ────────────────────────────────────────────────────────
export async function criarCentroDeCusto(dados: { nome: string }): Promise<ResultadoDaAcao<CentroDeCusto>> {
  await esperar(400);
  const nome = dados.nome.trim();
  if (!nome) return falha("entrada_invalida", "Dê um nome para o centro de custo.");
  if (centrosDeCusto.some((c) => normalizarTexto(c.nome) === normalizarTexto(nome)))
    return falha("entrada_invalida", "Já existe um centro de custo com esse nome.");
  const novo: CentroDeCusto = { id: crypto.randomUUID(), empresaId: EMPRESA_ID, nome, padrao: false, arquivado: false };
  centrosDeCusto.push(novo);
  return ok({ ...novo });
}

export async function atualizarCentroDeCusto(
  centroDeCustoId: Id,
  dados: Partial<Pick<CentroDeCusto, "nome" | "arquivado">>,
): Promise<ResultadoDaAcao<CentroDeCusto>> {
  await esperar(300);
  const c = centrosDeCusto.find((x) => x.id === centroDeCustoId);
  if (!c) return falha("nao_encontrado", "Centro de custo não encontrado.");
  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();
    if (!nome) return falha("entrada_invalida", "Dê um nome para o centro de custo.");
    if (centrosDeCusto.some((x) => x.id !== c.id && normalizarTexto(x.nome) === normalizarTexto(nome)))
      return falha("entrada_invalida", "Já existe um centro de custo com esse nome.");
    dados = { ...dados, nome };
  }
  Object.assign(c, dados);
  return ok({ ...c });
}

// ── Sincronização e conexão ─────────────────────────────────────────────────
let ultimaSincronizacaoManual = 0;

export async function sincronizarAgora(conexaoId: Id): Promise<ResultadoDaAcao<{ transacoesGravadas: number }>> {
  await esperar(1800);
  const c = conexoes.find((x) => x.id === conexaoId);
  if (!c) return falha("conexao_nao_encontrada", "Conexão não encontrada.");
  if (Date.now() - ultimaSincronizacaoManual < 2 * 60_000)
    return falha("limite_excedido", "Aguarde alguns minutos para sincronizar de novo.");
  ultimaSincronizacaoManual = Date.now();
  c.ultimaSincronizacaoEm = new Date();
  return ok({ transacoesGravadas: 3 });
}

export async function iniciarConexao(opcoes?: { conexaoIdParaReconectar?: Id }): Promise<ResultadoDaAcao<{ token: string }>> {
  await esperar(700);
  if (opcoes?.conexaoIdParaReconectar && !conexoes.some((c) => c.id === opcoes.conexaoIdParaReconectar))
    return falha("conexao_nao_encontrada", "Conexão não encontrada.");
  return ok({ token: `token-simulado-${Date.now()}` });
}

export async function registrarConexao(idExterno: string): Promise<ResultadoDaAcao<Conexao>> {
  await esperar(900);
  const existente = conexoes.find((c) => c.idExterno === idExterno);
  const agora = new Date();
  const dados = {
    status: "atualizando" as const,
    erro: null,
    consentimentoExpiraEm: new Date(agora.getTime() + 365 * 86_400_000),
    ultimaSincronizacaoEm: agora,
    atualizadaEm: agora,
  };
  if (existente) {
    Object.assign(existente, dados);
    return ok({ ...existente });
  }
  const nova: Conexao = { id: crypto.randomUUID(), empresaId: EMPRESA_ID, provedor: "pluggy", idExterno, banco: "Sicredi Empresas", criadaEm: agora, ...dados };
  conexoes.push(nova);
  return ok({ ...nova });
}

// ── Anexos ──────────────────────────────────────────────────────────────────
const TIPOS: Anexo["tipoMime"][] = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function anexar(transacaoId: Id, formulario: FormData): Promise<ResultadoDaAcao<Anexo>> {
  await esperar(1200);
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File) || !TIPOS.includes(arquivo.type as Anexo["tipoMime"]) || arquivo.size > 10 * 1024 * 1024)
    return falha("anexo_invalido", "Arquivo não permitido (PDF, JPG, PNG ou WEBP de até 10 MB).");
  if (arquivo.name.includes("falha")) return falha("inesperado", "Não foi possível enviar o arquivo. Tente de novo.");
  const anexo: Anexo = {
    id: crypto.randomUUID(),
    empresaId: EMPRESA_ID,
    transacaoId,
    caminho: `anexos/${EMPRESA_ID}/${transacaoId}/${arquivo.name}`,
    nomeArquivo: arquivo.name,
    tipoMime: arquivo.type as Anexo["tipoMime"],
    tamanhoBytes: arquivo.size,
    criadoEm: new Date(),
  };
  anexos.push(anexo);
  return ok({ ...anexo });
}

export async function gerarLinkTemporario(anexoId: Id): Promise<ResultadoDaAcao<{ url: string; expiraEm: Date }>> {
  await esperar(300);
  if (!anexos.some((a) => a.id === anexoId)) return falha("nao_encontrado", "Anexo não encontrado.");
  // Protótipo: sempre o mesmo PDF de exemplo. O real é uma URL assinada do Storage (60 s).
  return ok({ url: "/prototipo/comprovante-de-exemplo.pdf", expiraEm: new Date(Date.now() + 60_000) });
}

export async function removerAnexo(anexoId: Id): Promise<ResultadoDaAcao<null>> {
  await esperar(400);
  const i = anexos.findIndex((a) => a.id === anexoId);
  if (i < 0) return falha("nao_encontrado", "Anexo não encontrado.");
  anexos.splice(i, 1);
  return ok(null);
}
