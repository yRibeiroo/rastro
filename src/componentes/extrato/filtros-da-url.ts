import type { DataISO, FiltrosDoExtrato } from "@/regras-de-negocio";
import { hojeISO, somarDias } from "@/ferramentas-internas/formatar-data";

/**
 * Filtros do extrato na URL (RF-18), para link e recarregamento preservarem a visão:
 *   ?periodo=mes|mes-passado|90d|tudo  ou  ?de=AAAA-MM-DD&ate=AAAA-MM-DD
 *   &categoria=<id>|nenhuma  &centro=<id>|nenhum  &sentido=entrada|saida  &busca=texto
 */
export const PERIODOS_DO_EXTRATO = {
  mes: "Este mês",
  "mes-passado": "Mês passado",
  "90d": "Últimos 90 dias",
  tudo: "Tudo",
  personalizado: "Escolher datas",
} as const;
export type PeriodoDoExtrato = keyof typeof PERIODOS_DO_EXTRATO;

export type ParametrosDaUrl = Record<string, string | string[] | undefined>;

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const ehData = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function intervaloDoPeriodo(periodo: Exclude<PeriodoDoExtrato, "personalizado">, hoje: DataISO): { de?: DataISO; ate?: DataISO } {
  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  if (periodo === "mes") return { de: inicioDoMes, ate: hoje };
  if (periodo === "mes-passado") {
    const fimDoAnterior = somarDias(inicioDoMes, -1);
    return { de: `${fimDoAnterior.slice(0, 7)}-01`, ate: fimDoAnterior };
  }
  if (periodo === "90d") return { de: somarDias(hoje, -89), ate: hoje };
  return {};
}

export function lerFiltros(sp: ParametrosDaUrl, hoje: DataISO = hojeISO()) {
  const de = texto(sp.de);
  const ate = texto(sp.ate);
  const pedido = texto(sp.periodo);
  const personalizado = ehData(de) || ehData(ate);
  const periodo: PeriodoDoExtrato = personalizado
    ? "personalizado"
    : pedido in PERIODOS_DO_EXTRATO && pedido !== "personalizado"
      ? (pedido as PeriodoDoExtrato)
      : "mes";
  const intervalo = personalizado
    ? { de: ehData(de) ? de : undefined, ate: ehData(ate) ? ate : undefined }
    : intervaloDoPeriodo(periodo as Exclude<PeriodoDoExtrato, "personalizado">, hoje);

  const categoria = texto(sp.categoria);
  const centro = texto(sp.centro);
  const sentido = texto(sp.sentido);
  const busca = texto(sp.busca).slice(0, 100);

  const filtros: FiltrosDoExtrato = {
    dataDe: intervalo.de,
    dataAte: intervalo.ate,
    categoriaId: categoria === "nenhuma" ? "sem_categoria" : categoria || undefined,
    centroDeCustoId: centro === "nenhum" ? "sem_centro" : centro || undefined,
    sentido: sentido === "entrada" || sentido === "saida" ? sentido : undefined,
    busca: busca || undefined,
  };
  // Quantos filtros além do período padrão (para o rótulo "Filtros (2)" no celular).
  const ativos = [periodo !== "mes", categoria, centro, filtros.sentido, busca].filter(Boolean).length;
  return { filtros, periodo, valores: { de: intervalo.de ?? "", ate: intervalo.ate ?? "", categoria, centro, sentido: filtros.sentido ?? "", busca }, ativos };
}
