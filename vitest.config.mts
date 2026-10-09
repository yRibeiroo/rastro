import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = (caminho: string) =>
  fileURLToPath(new URL(caminho, import.meta.url));

const resolve = {
  alias: {
    "@": raiz("./src"),
    // `server-only` lança erro fora do Next; nos testes vira um módulo vazio.
    "server-only": raiz("./node_modules/server-only/empty.js"),
  },
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/regras-de-negocio/**"],
      exclude: ["**/*.d.ts", "**/index.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
    projects: [
      {
        resolve,
        test: {
          name: "unidade",
          environment: "node",
          include: ["testes/unidade/**/*.test.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "unidade-componentes",
          environment: "jsdom",
          include: ["testes/unidade/**/*.test.tsx"],
          setupFiles: ["testes/configuracao/componentes.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "integracao",
          environment: "node",
          include: ["testes/integracao/**/*.test.ts"],
          // Supabase local é compartilhado: arquivos em série evitam interferência.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
