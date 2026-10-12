import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compara 'Bearer <segredo>' em tempo constante. Segredo vazio => false.
 * Os dois lados passam por SHA-256 antes do timingSafeEqual: buffers de mesmo
 * tamanho sem vazar o comprimento do segredo por tempo de resposta.
 */
export function webhookAutorizado(
  cabecalhoAuthorization: string | null,
  segredo: string | undefined,
): boolean {
  if (!segredo || !cabecalhoAuthorization) return false;
  const resumo = (texto: string) => createHash("sha256").update(texto).digest();
  return timingSafeEqual(
    resumo(cabecalhoAuthorization),
    resumo(`Bearer ${segredo}`),
  );
}
