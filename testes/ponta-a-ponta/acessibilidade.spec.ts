import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { semAbertura } from "./apoio";

// RNF-08 (axe sem violações sérias/críticas), RNF-09 (teclado), RNF-11 (390 px), RNF-14 (claro/escuro).

const ROTAS = [
  "/painel",
  "/extrato",
  "/extrato/:primeira",
  "/comprovantes",
  "/importar",
  "/categorias",
  "/centros-de-custo",
];
const LARGURAS = [390, 1280];
const TEMAS = ["claro", "escuro"] as const;

async function graves(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
    );
}

async function prepararTema(page: Page, tema: (typeof TEMAS)[number]) {
  await semAbertura(page);
  await page.addInitScript((t) => localStorage.setItem("rastro:tema", t), tema);
}

let primeira = "";
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await semAbertura(page);
  await page.goto("/extrato");
  primeira =
    (await page
      .locator('main a[href^="/extrato/"]')
      .first()
      .getAttribute("href")) ?? "/extrato";
  await page.close();
});

for (const tema of TEMAS)
  for (const largura of LARGURAS)
    for (const rota of ROTAS)
      test(`axe ${rota} · ${largura}px · ${tema}`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await prepararTema(page, tema);
        await page.goto(rota.replace("/extrato/:primeira", primeira));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        // Sem rolagem lateral (RNF-11).
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        expect(await graves(page)).toEqual([]);
      });

for (const tema of TEMAS)
  for (const largura of LARGURAS)
    test(`axe /entrar · ${largura}px · ${tema}`, async ({ browser }) => {
      const contexto = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: { width: largura, height: 900 },
      });
      const page = await contexto.newPage();
      await prepararTema(page, tema);
      await page.goto("/entrar");
      await expect(page.getByLabel("E-mail")).toBeVisible();
      expect(await graves(page)).toEqual([]);
      await contexto.close();
    });

test("teclado: 'Pular para o conteúdo' é o primeiro foco e leva ao conteúdo", async ({
  page,
}) => {
  await semAbertura(page);
  await page.goto("/extrato");
  await page.keyboard.press("Tab");
  const pular = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(pular).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#conteudo$/);
  // Daqui o Tab segue para dentro do conteúdo (a busca do extrato), não para o menu.
  await page.keyboard.press("Tab");
  const dentroDoMain = await page.evaluate(
    () => !!document.activeElement?.closest("main"),
  );
  expect(dentroDoMain).toBe(true);
});

test("teclado: entrar só com o teclado", async ({ browser }) => {
  const contexto = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await contexto.newPage();
  await semAbertura(page);
  await page.goto("/entrar");
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    if (
      await page
        .getByLabel("E-mail")
        .evaluate((e) => e === document.activeElement)
    )
      break;
  }
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Enviar link de acesso" }),
  ).toBeFocused();
  await contexto.close();
});
