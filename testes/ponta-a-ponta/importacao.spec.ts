import { expect, test, type Page } from "@playwright/test";
import { EMPRESA_DEMO, hidratada, semAbertura, sql } from "./apoio";

// HU-15 (importar OFX, reimportar sem duplicar, arquivo inválido) e HU-16 (histórico, "importado hoje").
const OFX = "testes/fixtures/ofx/sicredi-sgml-latin1.ofx";
const CORROMPIDO = "testes/fixtures/ofx/corrompido.ofx";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => {
  // Volta ao seed: apaga o que uma execução anterior importou deste arquivo.
  sql(`
    delete from public.importacoes_de_extrato
      where empresa_id = '${EMPRESA_DEMO}' and nome_do_arquivo = 'sicredi-sgml-latin1.ofx';
    delete from public.transacoes
      where empresa_id = '${EMPRESA_DEMO}' and data between '2026-10-01' and '2026-10-08'
        and conta_id in (select id from public.contas where empresa_id = '${EMPRESA_DEMO}' and id_externo not like 'demo-%');`);
});
test.beforeEach(({ page }) => semAbertura(page));

async function importar(page: Page, arquivo: string) {
  await page.goto("/importar");
  await hidratada(page);
  await page.locator('input[type="file"]').setInputFiles(arquivo);
}

const numero = (page: Page, rotulo: string) =>
  page.locator("dl > div").filter({ hasText: rotulo }).locator("dd");

test("importa o OFX do Sicredi e as transações aparecem no extrato", async ({
  page,
}) => {
  await importar(page, OFX);
  await expect(
    page.getByText("Extrato de 01/10/2026 a 08/10/2026 importado."),
  ).toBeVisible({ timeout: 20_000 });
  // 5 lançamentos no arquivo, um repetido (mesmo FITID): 4 novas.
  await expect(numero(page, "Transações novas")).toHaveText("4");
  await expect(numero(page, "Atualizadas")).toHaveText("0");

  await page.getByRole("link", { name: "Ver no extrato" }).click();
  await expect(page).toHaveURL(/de=2026-10-01&ate=2026-10-08/);
  await expect(
    page.getByRole("link", { name: /TARIFA CESTA DE SERVI/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: /CHEQUE COMPENSADO/ }),
  ).toHaveCount(1);
});

test("reimportar o mesmo arquivo não duplica nada", async ({ page }) => {
  await importar(page, OFX);
  await expect(
    page.getByText("Esse período já estava importado: nada foi duplicado."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(numero(page, "Transações novas")).toHaveText("0");
  await expect(numero(page, "Atualizadas")).toHaveText("4");

  await page.goto(
    "/extrato?de=2026-10-01&ate=2026-10-08&periodo=personalizado",
  );
  await expect(
    page.getByRole("link", { name: /TARIFA CESTA DE SERVI/ }),
  ).toHaveCount(1);
});

test("histórico mostra a importação e o menu diz 'hoje'", async ({ page }) => {
  await page.goto("/importar");
  const historico = page.getByRole("region", { name: "Histórico" });
  await expect(historico).toContainText("sicredi-sgml-latin1.ofx");
  await expect(historico).toContainText("01/10/2026 a 08/10/2026");
  await expect(
    page.getByRole("link", { name: "Última importação hoje" }).first(),
  ).toBeVisible();
});

test("OFX corrompido é recusado e nada é gravado", async ({ page }) => {
  const antes = sql(
    `select count(*) from public.importacoes_de_extrato where empresa_id = '${EMPRESA_DEMO}'`,
  );
  await importar(page, CORROMPIDO);
  await expect(page.getByText("Não importamos")).toBeVisible({
    timeout: 20_000,
  });
  expect(
    sql(
      `select count(*) from public.importacoes_de_extrato where empresa_id = '${EMPRESA_DEMO}'`,
    ),
  ).toBe(antes);
});

test("arquivo que não é .ofx é recusado antes de enviar", async ({ page }) => {
  await page.goto("/importar");
  await hidratada(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "extrato.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 falso"),
  });
  await expect(
    page.getByText("Envie o arquivo .ofx exportado do Internet Banking"),
  ).toBeVisible();
});
