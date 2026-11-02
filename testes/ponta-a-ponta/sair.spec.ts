import { expect, test } from "@playwright/test";
import { hidratada, semAbertura } from "./apoio";

// HU-01: "Sair" volta para /entrar e não mostra mais dados.
// Fica por último (ordem alfabética, 1 worker): o signOut encerra a sessão salva pelo preparo.
test("sair encerra a sessão", async ({ page }) => {
  await semAbertura(page);
  await page.goto("/painel");
  await hidratada(page);
  await page
    .getByRole("button", { name: "Sair" })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/entrar/);
  await page.goto("/extrato");
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByText("R$")).toHaveCount(0);
});
