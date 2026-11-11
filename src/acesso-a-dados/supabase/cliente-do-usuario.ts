import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ambiente } from "@/configuracao/ambiente";
import { ambientePublico } from "@/configuracao/ambiente-publico";
import { modoDemo } from "@/configuracao/modo-demo";
import type { Database } from "./tipos-do-banco";

export type BancoDeDados = Database;
export type ClienteDoBanco = SupabaseClient<BancoDeDados>;

// Modo demo: uma sessão só, guardada na memória do servidor. O visitante nunca recebe o token,
// então não consegue falar com o Supabase em nome do usuário da demonstração.
const FOLGA_DA_SESSAO_MS = 5 * 60_000;
let demo: { cliente: ClienteDoBanco; expiraEm: number } | undefined;
let entrando: Promise<ClienteDoBanco> | undefined;

async function entrarNaDemo(): Promise<ClienteDoBanco> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    ambientePublico();
  const cliente = createClient<BancoDeDados>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await cliente.auth.signInWithPassword({
    email: ambiente.DEMO_EMAIL,
    password: ambiente.DEMO_SENHA,
  });
  // Só o código no erro: nunca o e-mail nem a senha.
  if (error || !data.session)
    throw new Error(`demo:${error?.code ?? "sem_sessao"}`);
  demo = { cliente, expiraEm: (data.session.expires_at ?? 0) * 1000 };
  return cliente;
}

function clienteDaDemo(): Promise<ClienteDoBanco> {
  if (demo && demo.expiraEm - Date.now() > FOLGA_DA_SESSAO_MS)
    return Promise.resolve(demo.cliente);
  // Uma entrada por vez, mesmo com várias requisições chegando juntas.
  entrando ??= entrarNaDemo().finally(() => {
    entrando = undefined;
  });
  return entrando;
}

/** Cliente com a sessão do usuário (cookies + chave publicável): a RLS se aplica. Um por requisição. */
export async function clienteDoUsuario(): Promise<ClienteDoBanco> {
  if (modoDemo()) return clienteDaDemo();
  const loja = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    ambientePublico();
  return createServerClient<BancoDeDados>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => loja.getAll(),
        setAll(lista) {
          try {
            for (const { name, value, options } of lista)
              loja.set(name, value, options);
          } catch {
            // Server Component não grava cookie: o src/proxy.ts renova a sessão.
          }
        },
      },
    },
  );
}
