import { defineConfig, devices } from "@playwright/test";

const ci = !!process.env.CI;
const porta = 3000;

export default defineConfig({
  testDir: "testes/ponta-a-ponta",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  workers: ci ? 1 : undefined,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${porta}`,
    trace: "on-first-retry",
    locale: "pt-BR",
    timezoneId: "America/Araguaina",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // No CI o build já foi feito no passo anterior do job.
    command: ci ? "npm run start" : "npm run dev",
    url: `http://localhost:${porta}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
});
