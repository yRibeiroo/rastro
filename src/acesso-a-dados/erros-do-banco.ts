import "server-only";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";

/** Falha inesperada do banco: só o código do Postgres/PostgREST, nunca dados ou mensagem. */
export class ErroDoBanco extends Error {
  constructor(readonly codigo: string) {
    super(`erro do banco (${codigo})`);
    this.name = "ErroDoBanco";
  }
}

/** Traduz o erro do supabase-js em ErroDeNegocio (esperado) ou ErroDoBanco (inesperado). */
export function falhaDoBanco(
  erro: { code?: string } | null | undefined,
  mensagens: {
    duplicado?: string;
    referencia?: string;
    naoEncontrado?: string;
  } = {},
): Error {
  const codigo = erro?.code ?? "desconhecido";
  if (codigo === "23505" && mensagens.duplicado)
    return new ErroDeNegocio("entrada_invalida", mensagens.duplicado);
  if (codigo === "23503" || codigo === "23514")
    return new ErroDeNegocio(
      "entrada_invalida",
      mensagens.referencia ?? "Confira os dados informados.",
    );
  if (codigo === "22023" || codigo === "22P02")
    return new ErroDeNegocio(
      "entrada_invalida",
      "Confira os dados informados.",
    );
  if (codigo === "PGRST116")
    return new ErroDeNegocio(
      "nao_encontrado",
      mensagens.naoEncontrado ?? "Registro não encontrado.",
    );
  return new ErroDoBanco(codigo);
}

/** Desembrulha { data, error } do supabase-js. */
export function dadosOuFalha<
  R extends { data: unknown; error: { code?: string } | null },
>(
  resposta: R,
  mensagens?: Parameters<typeof falhaDoBanco>[1],
): NonNullable<R["data"]> {
  if (resposta.error) throw falhaDoBanco(resposta.error, mensagens);
  if (resposta.data === null || resposta.data === undefined)
    throw falhaDoBanco({ code: "PGRST116" }, mensagens);
  return resposta.data as NonNullable<R["data"]>;
}

/** numeric(14,2) ↔ centavos: a conversão só acontece nos repositórios. */
export const paraCentavos = (valor: number | string | null | undefined) =>
  Math.round(Number(valor ?? 0) * 100);
export const paraReais = (centavos: number) => centavos / 100;

export const paraDataOuNulo = (valor: string | null | undefined) =>
  valor ? new Date(valor) : null;
