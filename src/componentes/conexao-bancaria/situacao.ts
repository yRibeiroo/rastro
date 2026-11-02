import type { Conexao } from "@/regras-de-negocio";

/** Os quatro rótulos do RF-07, com o detalhe do glossário quando ajuda. */
export type Situacao = {
  rotulo: "Conectado" | "Sincronizando" | "Precisa reconectar" | "Erro";
  detalhe: string | null;
  tom: "ok" | "andamento" | "alerta" | "erro";
  /** Mostrar o botão "Reconectar". */
  reconectar: boolean;
  /** Avisar no cabeçalho de todas as telas (HU-04): erro de login ou autorização já vencida. */
  aviso: boolean;
  /** A autorização do Open Finance já venceu. */
  expirada: boolean;
};

const SETE_DIAS = 7 * 86_400_000;

export function situacaoDaConexao(
  c: Pick<Conexao, "status" | "consentimentoExpiraEm">,
  agora = new Date(),
): Situacao {
  const restante = c.consentimentoExpiraEm
    ? c.consentimentoExpiraEm.getTime() - agora.getTime()
    : Infinity;
  const expirada = restante <= 0;

  if (c.status === "erro_de_login")
    return {
      rotulo: "Precisa reconectar",
      detalhe: "O banco recusou o acesso.",
      tom: "alerta",
      reconectar: true,
      aviso: true,
      expirada,
    };
  if (c.status === "aguardando_usuario")
    return {
      rotulo: "Precisa reconectar",
      detalhe: "Precisa da sua autorização no app do banco.",
      tom: "alerta",
      reconectar: true,
      aviso: true,
      expirada,
    };
  if (restante <= 0)
    return {
      rotulo: "Precisa reconectar",
      detalhe: "A autorização expirou.",
      tom: "alerta",
      reconectar: true,
      aviso: true,
      expirada,
    };
  if (c.status === "erro")
    return {
      rotulo: "Erro",
      detalhe: "Erro na conexão.",
      tom: "erro",
      reconectar: true,
      aviso: true,
      expirada,
    };
  if (c.status === "desatualizada")
    return {
      rotulo: "Erro",
      detalhe: "Desatualizada, tentando de novo.",
      tom: "erro",
      reconectar: false,
      aviso: false,
      expirada,
    };
  if (restante <= SETE_DIAS)
    return {
      rotulo: "Precisa reconectar",
      detalhe: "A autorização expira em breve.",
      tom: "alerta",
      reconectar: true,
      aviso: false,
      expirada,
    };
  if (c.status === "atualizando")
    return {
      rotulo: "Sincronizando",
      detalhe: null,
      tom: "andamento",
      reconectar: false,
      aviso: false,
      expirada,
    };
  return {
    rotulo: "Conectado",
    detalhe: null,
    tom: "ok",
    reconectar: false,
    aviso: false,
    expirada,
  };
}
