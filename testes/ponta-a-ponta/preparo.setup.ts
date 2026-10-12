import { expect, test as preparo } from "@playwright/test";
import { SESSAO } from "../../playwright.config";
import { EMAIL, linkMagico, pedirLink, semAbertura, sql } from "./apoio";

// Entra pelo link mágico de verdade (Mailpit) e liga o usuário à empresa demo do seed.
preparo(
  "entrar com o e-mail autorizado e ligar à empresa demo",
  async ({ page }) => {
    // Reexecuções seguidas não podem esbarrar no rate limit do link (3 por e-mail a cada 15 min).
    sql("delete from public.limites_de_requisicao");
    await semAbertura(page);

    await page.goto("/entrar");
    const desde = new Date(Date.now() - 1000);
    await pedirLink(page, EMAIL);
    await page.goto(await linkMagico(EMAIL, desde));
    await expect(page).toHaveURL(/\/painel$/);

    sql(`select privado.dev_vincular_usuario_a_demo('${EMAIL}')`);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.context().storageState({ path: SESSAO });
  },
);
