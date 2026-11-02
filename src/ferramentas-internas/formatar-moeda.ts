/** Centavos (inteiro, negativo = saída) → texto em R$ no padrão pt-BR. */

const completo = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const compacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Sinal de menos tipográfico (U+2212): mais legível que o hífen e lido como "menos". */
export const MENOS = "−";

export interface OpcoesDeMoeda {
  /** Sempre mostra "+" ou "−" (0 fica sem sinal). Padrão: só "−" nos negativos. */
  sinal?: boolean;
  /** "R$ 18,4 mil" em vez de "R$ 18.420,00". */
  compacto?: boolean;
}

export function formatarMoeda(
  centavos: number,
  { sinal = false, compacto: curto = false }: OpcoesDeMoeda = {},
): string {
  const absoluto = Math.abs(Math.round(centavos)) / 100;
  const texto = (curto ? compacto : completo).format(absoluto);
  if (centavos < 0 && absoluto > 0) return `${MENOS}${texto}`;
  if (sinal && absoluto > 0) return `+${texto}`;
  return texto;
}

/**
 * Valor digitado → centavos (sempre positivo; o sentido vem de outro campo).
 * Aceita "1.234,56", "1234,5", "1234.56", "R$ 12". Vazio, negativo ou ilegível → null.
 */
export function textoParaCentavos(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  // O último separador seguido de 1 ou 2 dígitos é o decimal; os outros são de milhar.
  const decimal = Math.max(virgula, ponto);
  const temDecimal = decimal >= 0 && /^\d{1,2}$/.test(t.slice(decimal + 1));
  const inteiro = (temDecimal ? t.slice(0, decimal) : t).replace(/[.,]/g, "");
  const fracao = temDecimal ? t.slice(decimal + 1).padEnd(2, "0") : "00";
  t = `${inteiro}${fracao}`;
  if (inteiro.length > 12) return null;
  return Number(t);
}

/** Versão para leitores de tela: "menos R$ 286,40" / "mais R$ 6.300,00". */
export function descreverMoeda(centavos: number): string {
  const texto = formatarMoeda(Math.abs(centavos));
  if (centavos < 0) return `menos ${texto}`;
  if (centavos > 0) return `mais ${texto}`;
  return texto;
}
