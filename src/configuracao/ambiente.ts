import "server-only";
import { z } from "zod";

// Variáveis do servidor, validadas de forma preguiçosa: cada uma só é conferida
// quando é lida pela primeira vez. Assim o `next build` não quebra quando faltam
// segredos, e uma rota só falha pela variável que ela realmente usa.

const texto = z.string().trim().min(1);
const flag = (padrao: "0" | "1") =>
  z
    .enum(["0", "1"])
    .default(padrao)
    .transform((v) => v === "1");

const esquemas = {
  SUPABASE_SERVICE_ROLE_KEY: texto,
  EMAIL_AUTORIZADO: texto.transform((v) =>
    v
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
  PLUGGY_CLIENT_ID: texto,
  PLUGGY_CLIENT_SECRET: texto,
  PLUGGY_WEBHOOK_SECRET: z
    .string()
    .min(32, "precisa ter pelo menos 32 caracteres"),
  PLUGGY_INCLUIR_SANDBOX: flag("0"),
  ANTHROPIC_API_KEY: texto,
  ANTHROPIC_MODELO: texto.optional(),
  CRON_SECRET: z.string().min(16, "precisa ter pelo menos 16 caracteres"),
  URL_DO_SITE: z.url().transform((v) => v.replace(/\/+$/, "")),
  RECURSO_CATEGORIZACAO_IA: flag("1"),
  RECURSO_ANEXOS: flag("1"),
  RECURSO_MULTIEMPRESA: flag("0"),
};

type Ambiente = {
  [K in keyof typeof esquemas]: z.output<(typeof esquemas)[K]>;
};

export class ErroDeConfiguracao extends Error {
  constructor(nome: string, motivo: string) {
    super(
      `Variável de ambiente ${nome} ausente ou inválida (${motivo}). ` +
        `Confira o .env.local (modelo em .env.example) ou as variáveis do projeto na Vercel.`,
    );
    this.name = "ErroDeConfiguracao";
  }
}

export function lerVariavel<K extends keyof Ambiente>(
  nome: K,
  fonte: Record<string, string | undefined> = process.env,
): Ambiente[K] {
  const bruto = fonte[nome];
  // Linhas vazias copiadas do .env.example contam como "não definida".
  const resultado = esquemas[nome].safeParse(bruto === "" ? undefined : bruto);
  if (!resultado.success) {
    // Nunca inclui o valor na mensagem: pode ser um segredo.
    throw new ErroDeConfiguracao(
      nome,
      resultado.error.issues[0]?.message ?? "inválida",
    );
  }
  return resultado.data as Ambiente[K];
}

const cache = new Map<keyof Ambiente, unknown>();

export const ambiente: Readonly<Ambiente> = new Proxy({} as Ambiente, {
  get(_alvo, nome) {
    if (typeof nome !== "string" || !(nome in esquemas)) return undefined;
    const chave = nome as keyof Ambiente;
    if (!cache.has(chave)) cache.set(chave, lerVariavel(chave));
    return cache.get(chave);
  },
  set() {
    throw new TypeError("ambiente é somente leitura");
  },
});
