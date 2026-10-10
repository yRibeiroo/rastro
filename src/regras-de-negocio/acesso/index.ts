import "server-only";
import type { ContextoDoUsuario, Id } from "../tipos";
import type { CredencialDoLink } from "./servico";
import type { LimiteDeRequisicoes } from "./limites";

export type {
  CredencialDoLink,
  PortaDeAutenticacao,
  ServicoDeAcesso,
  UsuarioAutenticado,
} from "./servico";
export {
  criarServicoDeAcesso,
  emailAutorizado,
  NOME_PADRAO_DA_EMPRESA,
} from "./servico";
export type { ConsumirLimite, LimiteDeRequisicoes } from "./limites";
export {
  chaveComHash,
  exigirLimite,
  LIMITES,
  MENSAGEM_DE_LIMITE,
} from "./limites";

// Funções do contrato (contratos.md §9). A montagem (raiz de composição) liga os
// clientes do Supabase; o import é dinâmico para não criar ciclo na carga dos módulos.
const acesso = async () => (await import("../montagem")).servicoDeAcesso();

/** Lê a sessão (getClaims), confere a allowlist e resolve a empresa. Lança 'nao_autenticado' ou 'email_nao_autorizado'. */
export async function obterContextoDoUsuario(): Promise<ContextoDoUsuario> {
  return (await acesso()).obterContextoDoUsuario();
}

/** Envia o link mágico só se autorizado; resposta igual para os demais. Rate limit por IP e e-mail. */
export async function enviarLinkMagico(
  email: string,
  ip: string | null,
): Promise<void> {
  return (await acesso()).enviarLinkMagico(email, ip);
}

/** Callback: troca o code/token_hash pela sessão, confere a allowlist (signOut se falhar) e chama garantir_empresa. */
export async function confirmarEntrada(
  credencial: CredencialDoLink,
): Promise<{ empresaId: Id }> {
  return (await acesso()).confirmarEntrada(credencial);
}

export async function sair(): Promise<void> {
  return (await acesso()).sair();
}

/** true = pode seguir. */
export async function consumirLimite(
  chave: string,
  limite: LimiteDeRequisicoes,
): Promise<boolean> {
  return (await acesso()).consumirLimite(chave, limite);
}
