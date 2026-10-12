import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ambientePublico } from "@/configuracao/ambiente-publico";

// Next 16: o antigo middleware. Renova a sessão do Supabase e manda para /entrar quem não está
// logado ou não está na allowlist (ADR 0008). Server Actions e páginas revalidam por conta própria.

function emailNaAllowlist(email: unknown): boolean {
  if (typeof email !== "string" || !email.trim()) return false;
  // Lido direto do ambiente: o proxy não importa módulos server-only.
  return (process.env.EMAIL_AUTORIZADO ?? "")
    .split(",")
    .some((e) => e.trim().toLowerCase() === email.trim().toLowerCase());
}

export async function proxy(requisicao: NextRequest) {
  let resposta = NextResponse.next({ request: requisicao });
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    ambientePublico();
  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => requisicao.cookies.getAll(),
        setAll(lista, cabecalhos) {
          for (const { name, value } of lista)
            requisicao.cookies.set(name, value);
          resposta = NextResponse.next({ request: requisicao });
          for (const { name, value, options } of lista)
            resposta.cookies.set(name, value, options);
          for (const [nome, valor] of Object.entries(cabecalhos ?? {}))
            resposta.headers.set(nome, valor);
        },
      },
    },
  );

  // getClaims valida o JWT (e renova a sessão se preciso). Nada entre a criação e esta chamada.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub || !emailNaAllowlist(data.claims.email)) {
    const destino = requisicao.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    const proximo = requisicao.nextUrl.pathname + requisicao.nextUrl.search;
    if (proximo !== "/") destino.searchParams.set("proximo", proximo);
    const redirecionamento = NextResponse.redirect(destino);
    // Mantém os cookies renovados/limpos pelo Supabase no redirecionamento.
    for (const cookie of resposta.cookies.getAll())
      redirecionamento.cookies.set(cookie);
    return redirecionamento;
  }
  return resposta;
}

export const config = {
  matcher: [
    // Tudo, menos: assets do Next, arquivos com extensão (públicos), /entrar*,
    // /api/webhooks/* (Bearer próprio) e /api/tarefas/* (CRON_SECRET).
    "/((?!_next/static|_next/image|entrar|api/webhooks|api/tarefas|.*\\.[\\w]+$).*)",
  ],
};
