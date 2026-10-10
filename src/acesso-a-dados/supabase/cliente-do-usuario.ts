import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ambientePublico } from "@/configuracao/ambiente-publico";
import type { Database } from "./tipos-do-banco";

export type BancoDeDados = Database;
export type ClienteDoBanco = SupabaseClient<BancoDeDados>;

/** Cliente com a sessão do usuário (cookies + chave publicável): a RLS se aplica. Um por requisição. */
export async function clienteDoUsuario(): Promise<ClienteDoBanco> {
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
