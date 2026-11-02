// Roda um comando (build + Playwright, Lighthouse) com o Supabase LOCAL, sem imprimir as chaves.
// Uso: node comandos/ambiente-e2e.mjs playwright test
// Sobrepõe o .env.local (o Next não sobrescreve variáveis já definidas no processo) e desliga a IA
// e o Open Finance: os testes de ponta a ponta nunca chamam a Anthropic nem a Pluggy.
import { spawnSync } from "node:child_process";
import { variaveisDoSupabaseLocal } from "./ambiente-supabase-local.mjs";

const { variaveis, mailpit } = variaveisDoSupabaseLocal();
const env = {
  ...process.env,
  ...variaveis,
  MAILPIT_URL: mailpit ?? "http://127.0.0.1:54324",
  EMAIL_AUTORIZADO: process.env.EMAIL_AUTORIZADO || "davi@exemplo.com",
  URL_DO_SITE: process.env.URL_DO_SITE || "http://localhost:3000",
  RECURSO_OPEN_FINANCE: "0",
  RECURSO_COMPROVANTES_IA: "0",
  RECURSO_CATEGORIZACAO_IA: "0",
  NEXT_TELEMETRY_DISABLED: "1",
};

const [comando, ...args] = process.argv.slice(2);
if (!comando) {
  console.error("Uso: node comandos/ambiente-e2e.mjs <comando> [args…]");
  process.exit(2);
}
const r = spawnSync(comando, args, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
