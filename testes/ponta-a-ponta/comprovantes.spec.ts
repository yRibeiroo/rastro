import { expect, test } from "@playwright/test";
import { EMPRESA_DEMO, hidratada, semAbertura, sql } from "./apoio";

// HU-22 (lista e filtros), HU-20 (escolher a transação), HU-17 com RECURSO_COMPROVANTES_IA=0.
const AMBIGUO = "00000000-0000-4000-a000-000000000404";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  // O recibo ambíguo do seed volta a 'ambiguo' (a execução anterior o conciliou).
  sql(`update public.comprovantes set situacao = 'ambiguo', transacao_id = null
       where empresa_id = '${EMPRESA_DEMO}' and id = '${AMBIGUO}'`);
});
test.beforeEach(({ page }) => semAbertura(page));

const cartoes = (page: import("@playwright/test").Page) =>
  page
    .getByRole("region", { name: "Comprovantes enviados" })
    .getByRole("listitem")
    .filter({
      has: page.getByRole("heading", { level: 3 }),
    });

test("lista os comprovantes com a situação escrita", async ({ page }) => {
  await page.goto("/comprovantes");
  await expect(cartoes(page)).toHaveCount(6);
  for (const situacao of [
    "Conciliado",
    "Pendente",
    "Escolher transação",
    "Erro de leitura",
  ])
    await expect(
      cartoes(page).filter({ hasText: situacao }).first(),
    ).toBeVisible();
});

test("filtros por situação ficam no endereço", async ({ page }) => {
  await page.goto("/comprovantes");
  const filtros = page.getByRole("navigation", {
    name: "Filtrar comprovantes",
  });
  await filtros.getByRole("link", { name: "Conciliado" }).click();
  await expect(page).toHaveURL(/situacao=conciliado/);
  await expect(cartoes(page)).toHaveCount(3);

  await filtros.getByRole("link", { name: "Escolher transação" }).click();
  await expect(page).toHaveURL(/situacao=ambiguo/);
  await expect(cartoes(page)).toHaveCount(1);
  await expect(cartoes(page)).toContainText("Recibo de 25/09/2026");
});

test("ambíguo: escolher a transação concilia e o clipe aparece no extrato", async ({
  page,
}) => {
  await page.goto("/comprovantes?situacao=ambiguo");
  await hidratada(page);
  const cartao = cartoes(page).first();
  await cartao.getByRole("radio", { name: /APLICACAO POUPANCA/ }).check();
  await cartao.getByRole("button", { name: "Ligar à transação" }).click();
  await expect(page.getByText("Nenhum comprovante em")).toBeVisible();

  await page.goto("/comprovantes?situacao=conciliado");
  const recibo = cartoes(page).filter({ hasText: "Recibo de 25/09/2026" });
  await expect(recibo).toContainText("Conciliado");
  await recibo.getByRole("link", { name: "Abrir transação" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "APLICACAO POUPANCA",
  );
});

test("desfazer a conciliação volta a pendente (RF-40)", async ({ page }) => {
  await page.goto("/comprovantes?situacao=conciliado");
  await hidratada(page);
  const recibo = cartoes(page).filter({ hasText: "Recibo de 25/09/2026" });
  await recibo.getByRole("button", { name: "Desligar da transação" }).click();
  await expect(
    page.getByText("Conciliação desfeita. O comprovante voltou a pendente."),
  ).toBeVisible();
});

test("com a leitura por IA desligada, a página avisa e não oferece o envio", async ({
  page,
}) => {
  await page.goto("/comprovantes");
  await expect(
    page.getByText("A leitura de comprovantes está desligada no momento."),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});
