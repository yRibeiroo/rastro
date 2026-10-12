import { z } from "zod";

// Variáveis públicas (vão para o navegador). O Next só embute NEXT_PUBLIC_* quando
// o nome aparece literalmente como `process.env.NEXT_PUBLIC_…`, por isso a leitura
// é explícita. A validação é preguiçosa para não quebrar o `next build`.

const esquema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
});

export type AmbientePublico = z.output<typeof esquema>;

let validado: AmbientePublico | undefined;

export function ambientePublico(): AmbientePublico {
  if (validado) return validado;
  const resultado = esquema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  });
  if (!resultado.success) {
    const nomes = resultado.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    throw new Error(
      `Variáveis públicas ausentes ou inválidas: ${nomes}. ` +
        `Confira o .env.local (modelo em .env.example) ou as variáveis do projeto na Vercel.`,
    );
  }
  validado = resultado.data;
  return validado;
}
