/**
 * Fonte de dados do protótipo: as MESMAS assinaturas de leitura dos serviços de contratos.md,
 * sem o `ctx` (o backend o obtém em servicosDoUsuario()). Para ligar o backend, cada página troca
 *   import { listarTransacoes } from "@/componentes/prototipo/fonte-de-dados"
 * por
 *   const s = await servicosDoUsuario(); s.extrato.listar(s.ctx, filtros)
 */
import "server-only";
import { connection } from "next/server";
import { hojeISO } from "@/ferramentas-internas/formatar-data";
import { anexos, categorias, centrosDeCusto, conexoes, contas, regras, transacoes } from "./dados-de-exemplo";
import type {
  Anexo,
  Categoria,
  CentroDeCusto,
  Conexao,
  DataISO,
  FiltrosDoExtrato,
  PaginaDoExtrato,
  PeriodoDoPainel,
  Regra,
  ResumoDoPainel,
  Transacao,
} from "./tipos-provisorios";

/** Igual a normalizarTexto() do contrato §5.1: maiúsculas, sem acento, espaços colapsados. */
export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();
}

// Dados reais são por requisição: o protótipo também (nada de prerender com dados velhos).
const porRequisicao = () => connection();

export async function listarConexoes(): Promise<Conexao[]> {
  await porRequisicao();
  return conexoes.map((c) => ({ ...c }));
}

export async function listarCategorias(opcoes?: { incluirArquivadas?: boolean }): Promise<Categoria[]> {
  await porRequisicao();
  return categorias.filter((c) => opcoes?.incluirArquivadas || !c.arquivada).map((c) => ({ ...c }));
}

export async function listarCentrosDeCusto(opcoes?: { incluirArquivados?: boolean }): Promise<CentroDeCusto[]> {
  await porRequisicao();
  return centrosDeCusto.filter((c) => opcoes?.incluirArquivados || !c.arquivado).map((c) => ({ ...c }));
}

export async function listarRegras(): Promise<Regra[]> {
  await porRequisicao();
  return [...regras].sort((a, b) => a.prioridade - b.prioridade || a.criadaEm.getTime() - b.criadaEm.getTime()).map((r) => ({ ...r }));
}

export async function listarTransacoes(filtros: FiltrosDoExtrato): Promise<PaginaDoExtrato> {
  await porRequisicao();
  const busca = filtros.busca ? normalizarTexto(filtros.busca.slice(0, 100)) : "";
  const itens = transacoes.filter((t) => {
    if (filtros.dataDe && t.data < filtros.dataDe) return false;
    if (filtros.dataAte && t.data > filtros.dataAte) return false;
    if (filtros.sentido === "entrada" && t.valorCentavos <= 0) return false;
    if (filtros.sentido === "saida" && t.valorCentavos >= 0) return false;
    if (filtros.categoriaId === "sem_categoria" ? t.categoriaId !== null : filtros.categoriaId && t.categoriaId !== filtros.categoriaId) return false;
    if (filtros.centroDeCustoId === "sem_centro" ? t.centroDeCustoId !== null : filtros.centroDeCustoId && t.centroDeCustoId !== filtros.centroDeCustoId) return false;
    if (busca && !normalizarTexto(`${t.descricao} ${t.contraparte ?? ""}`).includes(busca)) return false;
    return true;
  });
  // ponytail: sem paginação no protótipo (≈ 110 itens); o backend devolve proximoCursor.
  return { itens: itens.map((t) => ({ ...t })), proximoCursor: null };
}

export async function obterTransacao(id: string): Promise<Transacao | null> {
  await porRequisicao();
  const t = transacoes.find((x) => x.id === id);
  return t ? { ...t } : null;
}

export async function listarAnexos(transacaoId: string): Promise<Anexo[]> {
  await porRequisicao();
  return anexos.filter((a) => a.transacaoId === transacaoId).map((a) => ({ ...a }));
}

/** Ids das transações com anexo (para o ícone no extrato). */
export async function idsComAnexo(): Promise<string[]> {
  await porRequisicao();
  return [...new Set(anexos.map((a) => a.transacaoId))];
}

// ── Painel ──────────────────────────────────────────────────────────────────
export type ChavePeriodo = "mes" | "3m" | "6m" | "12m";
export const PERIODOS: Record<ChavePeriodo, string> = {
  mes: "Este mês",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
};

export function periodoDe(chave: ChavePeriodo, hoje: DataISO = hojeISO()): PeriodoDoPainel {
  const meses = { mes: 1, "3m": 3, "6m": 6, "12m": 12 }[chave];
  const [a, m] = hoje.split("-").map(Number);
  const inicio = new Date(Date.UTC(a, m - meses, 1)).toISOString().slice(0, 10);
  return { de: inicio, ate: hoje };
}

export async function obterResumoDoPainel(periodo: PeriodoDoPainel): Promise<ResumoDoPainel> {
  await porRequisicao();
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const noPeriodo = transacoes.filter(
    (t) =>
      !t.pendente &&
      t.data >= periodo.de &&
      t.data <= periodo.ate &&
      (t.categoriaId === null || categoriaPorId.get(t.categoriaId)?.entraNoResultado !== false),
  );

  const meses: string[] = [];
  for (let d = periodo.de.slice(0, 7); d <= periodo.ate.slice(0, 7); ) {
    meses.push(d);
    const [a, m] = d.split("-").map(Number);
    d = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7);
  }
  const fluxoMensal = meses.map((mes) => {
    const doMes = noPeriodo.filter((t) => t.data.startsWith(mes));
    const entradas = doMes.filter((t) => t.valorCentavos > 0).reduce((s, t) => s + t.valorCentavos, 0);
    const saidas = doMes.filter((t) => t.valorCentavos < 0).reduce((s, t) => s - t.valorCentavos, 0);
    return { mes, entradasCentavos: entradas, saidasCentavos: saidas, resultadoCentavos: entradas - saidas };
  });

  const gastos = new Map<string | null, { total: number; quantidade: number }>();
  for (const t of noPeriodo.filter((x) => x.valorCentavos < 0)) {
    const g = gastos.get(t.categoriaId) ?? { total: 0, quantidade: 0 };
    g.total -= t.valorCentavos;
    g.quantidade++;
    gastos.set(t.categoriaId, g);
  }
  const gastosPorCategoria = [...gastos]
    .map(([categoriaId, g]) => ({
      categoriaId,
      nome: categoriaId ? (categoriaPorId.get(categoriaId)?.nome ?? "Categoria removida") : "Sem categoria",
      totalCentavos: g.total,
      quantidade: g.quantidade,
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos);

  const ids: (string | null)[] = [...centrosDeCusto.filter((c) => !c.arquivado).map((c) => c.id), null];
  const resultadoPorCentroDeCusto = ids
    .map((id) => {
      const doCentro = noPeriodo.filter((t) => t.centroDeCustoId === id);
      const entradas = doCentro.filter((t) => t.valorCentavos > 0).reduce((s, t) => s + t.valorCentavos, 0);
      const saidas = doCentro.filter((t) => t.valorCentavos < 0).reduce((s, t) => s - t.valorCentavos, 0);
      return {
        centroDeCustoId: id,
        nome: id ? centrosDeCusto.find((c) => c.id === id)!.nome : "Sem centro de custo",
        entradasCentavos: entradas,
        saidasCentavos: saidas,
        resultadoCentavos: entradas - saidas,
      };
    })
    .filter((c) => c.centroDeCustoId !== null || c.entradasCentavos + c.saidasCentavos > 0);

  const conta = contas[0];
  return {
    periodo,
    saldoAtualCentavos: conta.saldoCentavos,
    saldoAtualizadoEm: conta.saldoAtualizadoEm,
    fluxoMensal,
    gastosPorCategoria,
    resultadoPorCentroDeCusto,
    transacoesSemCategoria: noPeriodo.filter((t) => t.categoriaId === null).length,
  };
}

/** Atalho usado pelo extrato: começo do mês atual. */
export function inicioDoMes(hoje: DataISO = hojeISO()): DataISO {
  return `${hoje.slice(0, 7)}-01`;
}
