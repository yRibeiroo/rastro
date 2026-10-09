// Converte `supabase status -o json` nas variáveis que o Rastro usa (NOME=valor por linha).
// Uso no CI: node comandos/ambiente-supabase-local.mjs >> "$GITHUB_ENV"
// São as chaves de demonstração do Supabase local, não segredos de produção.
import { execSync } from "node:child_process";

const status = JSON.parse(
  execSync("npx supabase status -o json", { encoding: "utf8" }),
);
const variaveis = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
};

for (const [nome, valor] of Object.entries(variaveis)) {
  if (!valor)
    throw new Error(`supabase status não trouxe o valor para ${nome}`);
  if (process.env.GITHUB_ACTIONS) console.error(`::add-mask::${valor}`);
  console.log(`${nome}=${valor}`);
}
