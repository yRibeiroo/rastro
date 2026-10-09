/**
 * Datas do Rastro sempre no fuso America/Araguaina (UTC−3, sem horário de verão).
 * DataISO ('YYYY-MM-DD') é data contábil: nunca passa por conversão de fuso.
 */

export const FUSO = "America/Araguaina";

type DataISO = string;

const isoDoFuso = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const curta = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const diaDaSemana = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "numeric", month: "long" });
const mesCurto = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, month: "short" });
const mesLongo = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, month: "long", year: "numeric" });
const relativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** 'YYYY-MM-DD' → instante ao meio-dia em Araguaína (longe da virada do dia em qualquer fuso). */
function meioDia(data: DataISO): Date {
  return new Date(`${data}T12:00:00-03:00`);
}

/** Data de hoje (ou de `agora`) no fuso do Rastro. */
export function hojeISO(agora: Date = new Date()): DataISO {
  return isoDoFuso.format(agora);
}

/** Soma dias a uma DataISO. */
export function somarDias(data: DataISO, dias: number): DataISO {
  const d = meioDia(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return isoDoFuso.format(d);
}

/** "08/10/2026" */
export function formatarData(data: DataISO | Date): string {
  return curta.format(typeof data === "string" ? meioDia(data) : data);
}

/** "08/10/2026 às 14:12" */
export function formatarDataHora(instante: Date): string {
  return `${curta.format(instante)} às ${hora.format(instante)}`;
}

/** "Hoje", "Ontem" ou "quarta-feira, 8 de outubro" (cabeçalho de dia no extrato). */
export function formatarDia(data: DataISO, agora: Date = new Date()): string {
  const hoje = hojeISO(agora);
  if (data === hoje) return "Hoje";
  if (data === somarDias(hoje, -1)) return "Ontem";
  return diaDaSemana.format(meioDia(data));
}

/** "agora", "há 4 minutos", "há 2 horas", "ontem às 14:12", "08/10/2026 às 14:12". */
export function formatarTempoRelativo(instante: Date, agora: Date = new Date()): string {
  const segundos = Math.round((instante.getTime() - agora.getTime()) / 1000);
  const passado = -segundos;
  if (passado < 60 && passado > -60) return "agora";
  if (passado < 3600 && passado > 0) return relativo.format(-Math.floor(passado / 60), "minute");
  if (passado < 6 * 3600 && passado > 0) return relativo.format(-Math.floor(passado / 3600), "hour");
  const dia = hojeISO(instante);
  const hoje = hojeISO(agora);
  if (dia === hoje) return `hoje às ${hora.format(instante)}`;
  if (dia === somarDias(hoje, -1)) return `ontem às ${hora.format(instante)}`;
  return formatarDataHora(instante);
}

/** 'YYYY-MM' → "out." (eixo) ou "outubro de 2026" (texto). */
export function formatarMes(mes: string, estilo: "curto" | "longo" = "curto"): string {
  const d = meioDia(`${mes}-15`);
  return (estilo === "curto" ? mesCurto : mesLongo).format(d);
}
