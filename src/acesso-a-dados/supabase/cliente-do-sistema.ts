import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ambiente } from "@/configuracao/ambiente";
import { ambientePublico } from "@/configuracao/ambiente-publico";
import type { BancoDeDados, ClienteDoBanco } from "./cliente-do-usuario";

let unico: ClienteDoBanco | undefined;

/**
 * Service role: IGNORA a RLS. Só webhook, cron, rate limit e as escritas da sincronização.
 * Todo repositório recebe e filtra empresaId explicitamente (ADR 0005).
 */
export function clienteDoSistema(): ClienteDoBanco {
  unico ??= createClient<BancoDeDados>(
    ambientePublico().NEXT_PUBLIC_SUPABASE_URL,
    ambiente.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return unico;
}
