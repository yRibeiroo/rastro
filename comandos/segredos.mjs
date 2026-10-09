// Varre segredos com o gitleaks no histórico do git (ou só no stage, com --staged).
// Só olha o que está/vai para o git: arquivos ignorados, como o .env.local, ficam de fora.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const naPasta = ["gitleaks", "gitleaks.exe"]
  .map((nome) => join(homedir(), "bin", nome))
  .find(existsSync);
const candidatos = ["gitleaks", naPasta].filter(Boolean);
const gitleaks = candidatos.find(
  (c) => spawnSync(c, ["version"], { stdio: "ignore" }).status === 0,
);

if (!gitleaks) {
  console.error(
    [
      "✖ gitleaks não encontrado (nem no PATH nem em ~/bin). Instale e tente de novo:",
      "  Windows: winget install Gitleaks.Gitleaks  (ou baixe o binário para ~/bin)",
      "  macOS:   brew install gitleaks",
      "  Linux:   https://github.com/gitleaks/gitleaks/releases",
    ].join("\n"),
  );
  process.exit(1);
}

const args = ["git", "--redact", "--no-banner", ...process.argv.slice(2)];
const { status } = spawnSync(gitleaks, args, { stdio: "inherit" });
process.exit(status ?? 1);
