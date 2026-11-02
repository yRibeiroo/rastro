import type { TipoDeConta } from "@/regras-de-negocio";

// Módulo comum (sem "use client"): um Server Component que importa de um módulo cliente recebe
// referências, não os valores.
export const TIPOS_DE_CONTA: Record<TipoDeConta, string> = {
  dinheiro: "Dinheiro (carteira)",
  corrente: "Conta corrente",
  poupanca: "Poupança",
  cartao_de_credito: "Cartão de crédito",
};
