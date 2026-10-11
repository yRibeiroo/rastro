import type { SituacaoDoComprovante, TipoDeComprovante } from "@/regras-de-negocio";

// Rótulos e utilitários puros dos comprovantes (servidor e navegador).

export const TIPOS: Record<TipoDeComprovante, string> = {
  pix: "Pix",
  boleto: "Boleto pago",
  nfce: "NFC-e (cupom)",
  nfe: "NF-e (DANFE)",
  recibo: "Recibo",
  outro: "Outro",
};

/** Situações que o usuário filtra (a "lendo" é transitória e aparece em "Todos"). */
export const SITUACOES: Record<Exclude<SituacaoDoComprovante, "lendo">, string> = {
  conciliado: "Conciliado",
  pendente: "Pendente",
  ambiguo: "Escolher transação",
  erro_de_leitura: "Erro de leitura",
};

export const ROTULO_DA_SITUACAO: Record<SituacaoDoComprovante, string> = { ...SITUACOES, lendo: "Lendo" };

export function lerSituacao(valor: string | string[] | undefined): Exclude<SituacaoDoComprovante, "lendo"> | null {
  return typeof valor === "string" && valor in SITUACOES ? (valor as Exclude<SituacaoDoComprovante, "lendo">) : null;
}

/**
 * Mesmo valor de TAMANHO_MAXIMO_DO_COMPROVANTE e TAMANHO_MAXIMO_DO_ANEXO no backend (a Vercel recusa
 * corpos acima de 4,5 MB). Duplicado porque aqueles módulos são server-only.
 */
export const TAMANHO_MAXIMO_DO_ARQUIVO = 4 * 1024 * 1024;

/** Abaixo disso a leitura da IA é destacada para conferência. */
export const CONFIANCA_BAIXA = 0.7;

/** CPF/CNPJ (só dígitos) mascarado para exibir: ***.456.789-** e **.345.678/0001-**. */
export function mascararDocumento(documento: string | null): string | null {
  const d = documento?.replace(/\D/g, "") ?? "";
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return null;
}

/** "1.234,56", "1234,56", "R$ 12", "12.5" → centavos (> 0). null se não for um valor válido. */
export function lerValorEmCentavos(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const centavos = Math.round(Number(t) * 100);
  return centavos > 0 ? centavos : null;
}

/** Centavos → "1234,56" para preencher o campo de edição. */
export function valorParaCampo(centavos: number | null): string {
  return centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ",");
}
