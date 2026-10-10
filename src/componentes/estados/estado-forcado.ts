/**
 * Protótipo: força um estado de tela pela URL (?estado=carregando|vazio|erro) para revisar os
 * quatro estados sem mexer nos dados. Sem o parâmetro, a tela mostra o estado real.
 * "carregando" renderiza o mesmo fallback do <Suspense> da tela.
 */
export type EstadoForcado = "carregando" | "vazio" | "erro";

export function lerEstadoForcado(valor: string | string[] | undefined): EstadoForcado | null {
  return valor === "carregando" || valor === "vazio" || valor === "erro" ? valor : null;
}
