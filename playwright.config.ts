import { defineConfig, devices } from "@playwright/test";

// Rode sempre por `npm run testar:e2e`: o comandos/ambiente-e2e.mjs injeta o Supabase LOCAL
// (sem imprimir as chaves) e desliga a IA e o Open Finance, no build e no servidor.
const ci = !!process.env.CI;
const porta = 3000;
export const SESSAO = "testes/ponta-a-ponta/.sessao/usuario.json";

export default defineConfig({
  testDir: "testes/ponta-a-ponta",
  // Um banco compartilhado e cenários que mudam dados (importar, recategorizar, conciliar): em série.
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${porta}`,
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Araguaina",
  },
  projects: [
    { name: "preparo", testMatch: /preparo\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["preparo"],
      use: { ...devices["Desktop Chrome"], storageState: SESSAO },
    },
  ],
  webServer: {
    // Produção de verdade (o ?estado= de desenvolvimento não existe aqui). No CI o build já foi feito.
    command: ci ? "npm run start" : "npm run build && npm run start",
    url: `http://localhost:${porta}/entrar`,
    reuseExistingServer: !ci,
    timeout: 600_000,
  },
});
