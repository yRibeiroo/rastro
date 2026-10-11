import "server-only";
import { z } from "zod";
import type { RepositorioDeEmpresas } from "@/acesso-a-dados/contratos";
import { ambiente } from "@/configuracao/ambiente";
import { ErroDeNegocio, entradaInvalida, registrarFalha } from "../erros";
import type { ContextoDoUsuario, Id } from "../tipos";
import {
  chaveComHash,
  exigirLimite,
  LIMITES,
  type ConsumirLimite,
  type LimiteDeRequisicoes,
} from "./limites";

// Acesso (contratos.md §9, ADR 0008): sessão, allowlist, empresa e rate limit.

export interface UsuarioAutenticado {
  id: Id;
  email: string | null;
}

/** O que o link mágico traz na URL de retorno: `code` (PKCE) ou `token_hash` (template de e-mail). */
export type CredencialDoLink =
  { code: string } | { tokenHash: string; tipo: "magiclink" | "email" };

/** Porta para o Supabase Auth (implementada em src/acesso-a-dados). */
export interface PortaDeAutenticacao {
  /** Lê a sessão validando o JWT (getClaims, nunca getSession). */
  usuarioAtual(): Promise<UsuarioAutenticado | null>;
  enviarLinkMagico(email: string, urlDeRetorno: string): Promise<void>;
  trocarPorSessao(credencial: CredencialDoLink): Promise<UsuarioAutenticado>;
  sair(): Promise<void>;
}

export const NOME_PADRAO_DA_EMPRESA = "Minha empresa";

/** EMAIL_AUTORIZADO aceita uma lista separada por vírgulas; comparação case-insensitive após trim. */
export function emailAutorizado(
  email: string | null | undefined,
  lista: readonly string[] = ambiente.EMAIL_AUTORIZADO,
): boolean {
  const normalizado = email?.trim().toLowerCase();
  if (!normalizado) return false;
  return lista.some(
    (autorizado) => autorizado.trim().toLowerCase() === normalizado,
  );
}

const esquemaEmail = z.email().max(254);

export interface ServicoDeAcesso {
  obterContextoDoUsuario(): Promise<ContextoDoUsuario>;
  enviarLinkMagico(email: string, ip: string | null): Promise<void>;
  confirmarEntrada(credencial: CredencialDoLink): Promise<{ empresaId: Id }>;
  sair(): Promise<void>;
  consumirLimite(chave: string, limite: LimiteDeRequisicoes): Promise<boolean>;
}

export function criarServicoDeAcesso(deps: {
  autenticacao: PortaDeAutenticacao;
  empresas: RepositorioDeEmpresas; // cliente do usuário (a RPC usa auth.uid())
  consumirLimite: ConsumirLimite; // service role
  emailsAutorizados: () => readonly string[];
  urlDoSite: () => string;
}): ServicoDeAcesso {
  const autorizado = (email: string | null | undefined) =>
    emailAutorizado(email, deps.emailsAutorizados());

  return {
    async obterContextoDoUsuario() {
      const usuario = await deps.autenticacao.usuarioAtual();
      if (!usuario)
        throw new ErroDeNegocio("nao_autenticado", "Entre para continuar.");
      if (!usuario.email || !autorizado(usuario.email))
        throw new ErroDeNegocio(
          "email_nao_autorizado",
          "Este e-mail não tem acesso ao Rastro.",
        );
      const membership = await deps.empresas.obterMembershipDoUsuario(
        usuario.id,
      );
      if (membership)
        return {
          usuarioId: usuario.id,
          email: usuario.email,
          empresaId: membership.empresaId,
          papel: membership.papel,
        };
      // O callback cria a empresa; isto cobre um callback interrompido no meio.
      const empresaId = await deps.empresas.garantirEmpresaDoUsuario(
        NOME_PADRAO_DA_EMPRESA,
      );
      return {
        usuarioId: usuario.id,
        email: usuario.email,
        empresaId,
        papel: "dono",
      };
    },

    async enviarLinkMagico(email, ip) {
      const valido = esquemaEmail.safeParse(email.trim().toLowerCase());
      if (!valido.success) throw entradaInvalida("Digite um e-mail válido.");
      // Fail-closed (ADR 0011): sem o banco de limites, não envia.
      if (ip)
        await exigirLimite(
          deps.consumirLimite,
          chaveComHash("entrar:ip", ip),
          LIMITES.entrarPorIp,
          "fechada",
        );
      await exigirLimite(
        deps.consumirLimite,
        chaveComHash("entrar:email", valido.data),
        LIMITES.entrarPorEmail,
        "fechada",
      );
      // E-mail fora da lista: mesma resposta, nada é enviado (não revela a allowlist).
      if (!autorizado(valido.data)) return;
      try {
        await deps.autenticacao.enviarLinkMagico(
          valido.data,
          `${deps.urlDoSite()}/entrar/confirmar`,
        );
      } catch (erro) {
        // Resposta neutra também aqui: uma falha só para e-mails autorizados revelaria a lista.
        registrarFalha("envio do link mágico", erro);
      }
    },

    async confirmarEntrada(credencial) {
      const usuario = await deps.autenticacao.trocarPorSessao(credencial);
      if (!autorizado(usuario.email)) {
        await deps.autenticacao.sair();
        throw new ErroDeNegocio(
          "email_nao_autorizado",
          "Este e-mail não tem acesso ao Rastro.",
        );
      }
      const empresaId = await deps.empresas.garantirEmpresaDoUsuario(
        NOME_PADRAO_DA_EMPRESA,
      );
      return { empresaId };
    },

    sair: () => deps.autenticacao.sair(),

    consumirLimite: (chave, limite) => deps.consumirLimite(chave, limite),
  };
}
