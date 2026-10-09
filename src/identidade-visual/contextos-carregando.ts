import type { OrbState } from "thinking-orbs";

// Fora do "use client" de propósito: Server Components podem ler este mapa (de um módulo cliente
// ele chegaria como referência vazia).
export type ContextoCarregando =
  | "conectando"
  | "sincronizando"
  | "categorizando"
  | "gerando-painel"
  | "generico"
  | "aguardando";

/** Contexto do Rastro → estado do orbe + texto acessível padrão (PROMPT §5). */
export const CONTEXTOS: Record<ContextoCarregando, { estado: OrbState; texto: string }> = {
  conectando: { estado: "connecting", texto: "Conectando ao banco" },
  sincronizando: { estado: "searching", texto: "Sincronizando transações" },
  categorizando: { estado: "solving", texto: "Categorizando gastos" },
  "gerando-painel": { estado: "weaving", texto: "Gerando o painel" },
  generico: { estado: "working", texto: "Carregando" },
  aguardando: { estado: "breathing", texto: "Aguardando" },
};
