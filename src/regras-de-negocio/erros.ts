import "server-only";

// Erros esperados do domínio (contratos.md §2).

export type CodigoDeErro =
  | "nao_autenticado"
  | "email_nao_autorizado"
  | "limite_excedido"
  | "entrada_invalida"
  | "nao_encontrado"
  | "conexao_nao_encontrada" // itemId não existe na aplicação Pluggy ou é de outra empresa
  | "provedor_indisponivel" // Pluggy fora ou erro 5xx
  | "classificador_indisponivel"
  | "recurso_desligado" // feature flag
  | "anexo_invalido";

export class ErroDeNegocio extends Error {
  constructor(
    readonly codigo: CodigoDeErro,
    readonly mensagemParaUsuario: string, // pt-BR, segura para exibir
    options?: { cause?: unknown },
  ) {
    super(codigo, options);
    this.name = "ErroDeNegocio";
  }
}

/** Retorno padrão de toda Server Action. */
export type ResultadoDaAcao<T> =
  | { ok: true; dados: T }
  | {
      ok: false;
      erro: { codigo: CodigoDeErro | "inesperado"; mensagem: string };
    };

export const MENSAGEM_INESPERADA = "Algo deu errado. Tente de novo em instantes.";

/** Atalho para a validação de entrada (Zod) nos serviços. */
export function entradaInvalida(
  mensagem = "Confira os dados informados.",
): ErroDeNegocio {
  return new ErroDeNegocio("entrada_invalida", mensagem);
}

/** Log sem dados sensíveis: só o nome/código do erro, nunca payload, e-mail ou descrição. */
export function registrarFalha(contexto: string, erro: unknown): void {
  const tipo =
    erro instanceof ErroDeNegocio
      ? erro.codigo
      : erro instanceof Error
        ? erro.name
        : typeof erro;
  console.error(`[rastro] ${contexto}: ${tipo}`);
}
