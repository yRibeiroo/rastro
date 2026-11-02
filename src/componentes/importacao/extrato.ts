import type { SituacaoDoExtrato } from "@/regras-de-negocio";

// Utilitários puros do extrato importado (servidor e navegador).

/**
 * Mesmo valor de TAMANHO_MAXIMO_DO_EXTRATO no backend. Duplicado porque aquele módulo é server-only;
 * testes/unidade/componentes/extrato-e-alertas.test.ts garante que os dois não se separam.
 */
export const TAMANHO_MAXIMO_DO_EXTRATO = 5 * 1024 * 1024;

/** RF-34: "Última importação hoje / ontem / há X dias" ou "Nenhum extrato importado ainda". */
export function textoDaSituacaoDoExtrato({
  diasDesdeAUltima: dias,
}: Pick<SituacaoDoExtrato, "diasDesdeAUltima">): string {
  if (dias === null) return "Nenhum extrato importado ainda";
  if (dias <= 0) return "Última importação hoje";
  if (dias === 1) return "Última importação ontem";
  return `Última importação há ${dias} dias`;
}
