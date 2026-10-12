import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

// Peças comuns dos testes de ponta a ponta. As variáveis vêm do comandos/ambiente-e2e.mjs.

export const EMAIL = (process.env.EMAIL_AUTORIZADO ?? "davi@exemplo.com")
  .split(",")[0]
  .trim();
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
export const EMPRESA_DEMO = "00000000-0000-4000-a000-000000000001";

/** SQL como postgres no banco LOCAL (container do Supabase CLI). Só para preparo e conferência. */
export function sql(consulta: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_rastro",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      consulta,
    ],
    { encoding: "utf8" },
  ).trim();
}

/** Link mágico mais novo que `desde` na caixa do Mailpit. */
export async function linkMagico(email: string, desde: Date): Promise<string> {
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const busca = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    ).then((r) => r.json());
    const nova = (busca.messages ?? []).find(
      (m: { Created: string }) => new Date(m.Created) >= desde,
    );
    if (nova) {
      const msg = await fetch(`${MAILPIT}/api/v1/message/${nova.ID}`).then(
        (r) => r.json(),
      );
      const link = String(msg.HTML || msg.Text)
        .replaceAll("&amp;", "&")
        .match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`nenhum link mágico chegou para ${email}`);
}

/** Quantas mensagens o Mailpit recebeu para o endereço desde `desde`. */
export async function mensagensPara(email: string, desde: Date) {
  const busca = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
  ).then((r) => r.json());
  return (busca.messages ?? []).filter(
    (m: { Created: string }) => new Date(m.Created) >= desde,
  ).length;
}

/** Marca a abertura como já vista nesta sessão (ela cobre a tela por 2,4 s). */
export async function semAbertura(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem("rastro:abertura-vista", "1"),
  );
}

/** Espera a hidratação: antes dela o formulário (Server Action) ainda não responde ao clique. */
export async function hidratada(page: Page) {
  await page.waitForLoadState("networkidle");
}

export async function pedirLink(page: Page, email: string) {
  await hidratada(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(
    page.getByRole("heading", { name: "Confira seu e-mail" }),
  ).toBeVisible();
}
