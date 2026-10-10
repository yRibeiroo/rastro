import { NextResponse, type NextRequest } from "next/server";
import { confirmarEntrada } from "@/regras-de-negocio/acesso";
import { ErroDeNegocio, registrarFalha } from "@/regras-de-negocio/erros";

// Callback do link mágico (ADR 0008): troca code/token_hash pela sessão, confere a allowlist
// (signOut se falhar), garante a empresa e segue para o sistema.

/** Só caminho relativo do próprio site (contra open redirect). */
function destinoSeguro(proximo: string | null): string {
  if (!proximo || !proximo.startsWith("/") || proximo.startsWith("//") || proximo.includes("\\"))
    return "/painel";
  return proximo;
}

export async function GET(requisicao: NextRequest) {
  const parametros = requisicao.nextUrl.searchParams;
  const code = parametros.get("code");
  const tokenHash = parametros.get("token_hash");
  const tipo = parametros.get("type");
  const ir = (caminho: string) => NextResponse.redirect(new URL(caminho, requisicao.url));

  try {
    if (code) await confirmarEntrada({ code });
    else if (tokenHash && (tipo === "magiclink" || tipo === "email"))
      await confirmarEntrada({ tokenHash, tipo });
    else return ir("/entrar?erro=link_expirado");
  } catch (erro) {
    if (erro instanceof ErroDeNegocio && erro.codigo === "email_nao_autorizado")
      return ir("/entrar?erro=nao_autorizado");
    if (!(erro instanceof ErroDeNegocio)) registrarFalha("callback do link mágico", erro);
    return ir("/entrar?erro=link_expirado");
  }
  return ir(destinoSeguro(parametros.get("proximo")));
}
