/**
 * Só em desenvolvimento: força um estado de tela pela URL (?estado=carregando|vazio|erro) para
 * revisar os quatro estados sem mexer nos dados. Em produção o parâmetro é ignorado.
 * "carregando" renderiza o mesmo fallback do <Suspense> da tela.
 */
export type EstadoForcado = "carregando" | "vazio" | "erro";

export function lerEstadoForcado(
  valor: string | string[] | undefined,
): EstadoForcado | null {
  if (process.env.NODE_ENV === "production") return null;
  return valor === "carregando" || valor === "vazio" || valor === "erro"
    ? valor
    : null;
}
