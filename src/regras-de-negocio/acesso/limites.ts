import "server-only";
import { createHash } from "node:crypto";
import { ErroDeNegocio, registrarFalha } from "../erros";

// Rate limit (ADR 0011). A contagem é atômica no Postgres (consumir_limite_de_requisicao).

export interface LimiteDeRequisicoes {
  maximo: number;
  janelaEmSegundos: number;
}

/** true = pode seguir. */
export type ConsumirLimite = (
  chave: string,
  limite: LimiteDeRequisicoes,
) => Promise<boolean>;

export const LIMITES = {
  entrarPorIp: { maximo: 5, janelaEmSegundos: 15 * 60 },
  entrarPorEmail: { maximo: 3, janelaEmSegundos: 15 * 60 },
  conexao: { maximo: 10, janelaEmSegundos: 3600 },
  sincronizar: { maximo: 6, janelaEmSegundos: 3600 },
  anexo: { maximo: 30, janelaEmSegundos: 3600 },
  importacao: { maximo: 20, janelaEmSegundos: 3600 },
  comprovante: { maximo: 30, janelaEmSegundos: 3600 },
} as const satisfies Record<string, LimiteDeRequisicoes>;

/** Chave com SHA-256 do valor (IP/e-mail nunca em texto puro, LGPD). */
export function chaveComHash(prefixo: string, valor: string): string {
  const resumo = createHash("sha256")
    .update(valor.trim().toLowerCase())
    .digest("hex");
  return `${prefixo}:${resumo}`;
}

export const MENSAGEM_DE_LIMITE =
  "Muitas tentativas. Tente de novo em alguns minutos.";

/**
 * Lança 'limite_excedido' se estourou. Falha do banco: `aberta` libera (usuário já autenticado),
 * `fechada` bloqueia propagando o erro (envio do link mágico).
 */
export async function exigirLimite(
  consumir: ConsumirLimite,
  chave: string,
  limite: LimiteDeRequisicoes,
  falha: "aberta" | "fechada" = "aberta",
): Promise<void> {
  let dentro: boolean;
  try {
    dentro = await consumir(chave, limite);
  } catch (erro) {
    registrarFalha("rate limit indisponível", erro);
    if (falha === "fechada") throw erro;
    return;
  }
  if (!dentro) throw new ErroDeNegocio("limite_excedido", MENSAGEM_DE_LIMITE);
}
