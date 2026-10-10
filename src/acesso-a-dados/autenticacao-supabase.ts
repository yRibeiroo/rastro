import "server-only";
import type {
  CredencialDoLink,
  PortaDeAutenticacao,
  UsuarioAutenticado,
} from "@/regras-de-negocio/acesso";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";

const linkInvalido = (cause?: unknown) =>
  new ErroDeNegocio(
    "nao_autenticado",
    "O link expirou ou já foi usado. Peça um novo.",
    { cause },
  );

/** Supabase Auth com link mágico. Use o MESMO cliente (por requisição) do RepositorioDeEmpresas. */
export class AutenticacaoSupabase implements PortaDeAutenticacao {
  constructor(private readonly banco: ClienteDoBanco) {}

  async usuarioAtual(): Promise<UsuarioAutenticado | null> {
    // getClaims valida o JWT; getSession não serve para autorização (ADR 0008).
    const { data, error } = await this.banco.auth.getClaims();
    if (error || !data?.claims?.sub) return null;
    const email = data.claims.email;
    return {
      id: data.claims.sub,
      email: typeof email === "string" ? email : null,
    };
  }

  async enviarLinkMagico(email: string, urlDeRetorno: string) {
    const { error } = await this.banco.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: urlDeRetorno, shouldCreateUser: true },
    });
    if (error) throw new Error(`auth:${error.code ?? error.status ?? "falha"}`);
  }

  async trocarPorSessao(
    credencial: CredencialDoLink,
  ): Promise<UsuarioAutenticado> {
    const { data, error } =
      "code" in credencial
        ? await this.banco.auth.exchangeCodeForSession(credencial.code)
        : await this.banco.auth.verifyOtp({
            token_hash: credencial.tokenHash,
            type: credencial.tipo,
          });
    if (error || !data.user) throw linkInvalido(error);
    return { id: data.user.id, email: data.user.email ?? null };
  }

  async sair() {
    await this.banco.auth.signOut();
  }
}
