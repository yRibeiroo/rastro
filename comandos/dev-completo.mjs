// Sobe o Supabase local e depois o Next em modo dev. Funciona no Windows e no Linux.
import { spawn, spawnSync } from "node:child_process";

const windows = process.platform === "win32";
const rodar = (comando, args) =>
  spawnSync(comando, args, { stdio: "inherit", shell: windows });

console.log("▶ Subindo o Supabase local (precisa do Docker rodando)…");
const supabase = rodar("npx", ["supabase", "start"]);
if (supabase.status !== 0) {
  console.error("✖ `supabase start` falhou. O Docker Desktop está aberto?");
  process.exit(supabase.status ?? 1);
}

console.log(
  "▶ Iniciando o Next (Ctrl+C encerra; o Supabase continua: `npx supabase stop`).",
);
const next = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: windows,
});
next.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"])
  process.on(sinal, () => next.kill(sinal));
