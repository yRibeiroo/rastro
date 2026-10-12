import { expect, test } from "@playwright/test";
import { semAbertura } from "./apoio";

// HU-02 (RF-04, RNF-10) e RNF-14 (claro/escuro).

test.describe("abertura com a logo", () => {
  test("aparece na primeira visita, 'Pular' some na hora e não volta na sessão", async ({
    page,
  }) => {
    await page.goto("/painel");
    const pular = page.getByRole("button", { name: "Pular abertura" });
    await expect(pular).toBeVisible();
    await pular.click();
    await expect(page.locator(".abertura")).toHaveCount(0, { timeout: 1000 });

    await page.reload();
    await expect(page.locator(".abertura")).toBeHidden();
    await page.getByRole("link", { name: "Extrato" }).first().click();
    await expect(page.locator(".abertura")).toBeHidden();
  });

  test("Enter pula a abertura", async ({ page }) => {
    await page.goto("/painel");
    await expect(
      page.getByRole("button", { name: "Pular abertura" }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator(".abertura")).toHaveCount(0, { timeout: 1000 });
  });

  test("termina sozinha em até 2,5 s", async ({ page }) => {
    await page.goto("/painel");
    await expect(page.locator(".abertura")).toHaveCount(0, { timeout: 3000 });
  });

  test("com movimento reduzido, só um fade curto (sem o traçado)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/painel");
    const abertura = page.locator(".abertura");
    await expect(abertura).toHaveCSS("animation-name", "abertura-pular");
    await expect(page.locator(".abertura__tracado")).toBeHidden();
    await expect(abertura).toHaveCount(0, { timeout: 1500 });
  });
});

test("tema claro e escuro: a escolha vale na hora e sobrevive ao recarregar", async ({
  page,
}) => {
  await semAbertura(page);
  await page.goto("/painel");
  const html = page.locator("html");

  await page
    .getByText("Escuro", { exact: true })
    .filter({ visible: true })
    .click();
  await expect(html).toHaveAttribute("data-tema", "escuro");
  const fundoEscuro = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  await page.reload();
  await expect(html).toHaveAttribute("data-tema", "escuro");

  await page
    .getByText("Claro", { exact: true })
    .filter({ visible: true })
    .click();
  await expect(html).toHaveAttribute("data-tema", "claro");
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).not.toBe(fundoEscuro);
});
