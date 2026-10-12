import { expect, test } from "@playwright/test";
import { hidratada, mensagensPara, pedirLink, semAbertura } from "./apoio";

// HU-01 (RF-01, RF-02, RF-03, RNF-04). O login autorizado é o preparo.setup.ts.
test.use({ storageState: { cookies: [], origins: [] } });
test.beforeEach(({ page }) => semAbertura(page));

for (const rota of [
  "/painel",
  "/extrato",
  "/comprovantes",
  "/importar",
  "/categorias",
  "/centros-de-custo",
])
  test(`sem sessão, ${rota} leva para /entrar`, async ({ page }) => {
    await page.goto(rota);
    await expect(page).toHaveURL(
      new RegExp(`/entrar\\?proximo=${encodeURIComponent(rota)}$`),
    );
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

test("e-mail fora da lista: mesma resposta, nenhum e-mail e nenhuma sessão", async ({
  page,
}) => {
  const intruso = `intruso-${Date.now()}@exemplo.com`;
  const desde = new Date(Date.now() - 1000);
  await page.goto("/entrar");
  await pedirLink(page, intruso);
  await page.waitForTimeout(1500); // dá tempo de um e-mail (que não deve existir) chegar
  expect(await mensagensPara(intruso, desde)).toBe(0);

  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar/);
});

test("link inválido no callback volta para /entrar com aviso", async ({
  page,
}) => {
  await page.goto("/entrar/confirmar?code=invalido");
  await expect(page).toHaveURL(/\/entrar\?erro=link_expirado/);
  await expect(
    page.getByText("Este link expirou ou já foi usado"),
  ).toBeVisible();
});

test("callback não aceita redirecionar para outro site", async ({
  request,
}) => {
  const r = await request.get(
    "/entrar/confirmar?token_hash=x&type=magiclink&proximo=//malicioso.exemplo",
    { maxRedirects: 0 },
  );
  expect(r.headers().location ?? "").not.toContain("malicioso");
});

test("muitos pedidos do mesmo e-mail: 'Muitas tentativas'", async ({
  page,
}) => {
  const email = `limite-${Date.now()}@exemplo.com`;
  for (let i = 0; i < 3; i++) {
    await page.goto("/entrar");
    await pedirLink(page, email);
  }
  await page.goto("/entrar");
  await hidratada(page);
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(
    page.getByText("Muitas tentativas. Tente de novo em alguns minutos."),
  ).toBeVisible();
});

test("webhook da Pluggy responde 404 com o Open Finance desligado (HU-23)", async ({
  request,
}) => {
  const r = await request.post("/api/webhooks/pluggy", {
    headers: { authorization: "Bearer qualquer" },
    data: { event: "item/updated" },
  });
  expect(r.status()).toBe(404);
});

test("cabeçalhos de segurança e CSP (RNF-03)", async ({ request }) => {
  const r = await request.get("/entrar");
  const h = r.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-powered-by"]).toBeUndefined();
});
