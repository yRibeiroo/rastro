import { expect, test } from "@playwright/test";
import { EMPRESA_DEMO, hidratada, semAbertura, sql } from "./apoio";

// HU-11 (RF-28, RNF-07): anexar quando precisar, clipe no extrato, link temporário e remover.
const DESCRICAO = "PIX ENVIADO RESTAURANTE SABOR DO CERRADO";
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "latin1",
);

test.beforeAll(() => {
  // Anexos de execuções anteriores (o arquivo no Storage fica órfão só no banco local de teste).
  sql(
    `delete from public.anexos where empresa_id = '${EMPRESA_DEMO}' and comprovante_id is null`,
  );
});
test.beforeEach(({ page }) => semAbertura(page));

test("anexar PDF, abrir por link temporário e remover", async ({ page }) => {
  await page.goto(`/extrato?busca=${encodeURIComponent("sabor do cerrado")}`);
  await page.getByRole("link", { name: DESCRICAO }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    DESCRICAO,
  );
  await hidratada(page);

  await page.getByLabel("Anexar arquivo").setInputFiles({
    name: "nota.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  const item = page.getByRole("listitem").filter({ hasText: "nota.pdf" });
  await expect(item).toBeVisible({ timeout: 20_000 });

  // Abre por link assinado do Storage privado (não pelo caminho do arquivo).
  const [pedido] = await Promise.all([
    page
      .context()
      .waitForEvent("request", (r) => /object\/sign\/.*token=/.test(r.url())),
    item.getByRole("button", { name: /Abrir/ }).click(),
  ]);
  expect(pedido.url()).toContain("/storage/v1/object/sign/");
  for (const aba of page.context().pages()) if (aba !== page) await aba.close();

  await page.reload();
  await hidratada(page);
  const linha = page.getByRole("listitem").filter({ hasText: "nota.pdf" });
  await linha.getByRole("button", { name: "Remover" }).click();
  await page
    .getByRole("group", { name: "Remover nota.pdf?" })
    .getByRole("button", { name: "Remover" })
    .click();
  await expect(
    page.getByText("Nenhum arquivo. Anexe a nota só quando o contador pedir."),
  ).toBeVisible();
});

test("arquivo fora do tipo é recusado (validação pelos bytes)", async ({
  page,
}) => {
  await page.goto(`/extrato?busca=${encodeURIComponent("sabor do cerrado")}`);
  await page.getByRole("link", { name: DESCRICAO }).first().click();
  await hidratada(page);
  // Nome e tipo de PDF, conteúdo de executável.
  await page.getByLabel("Anexar arquivo").setInputFiles({
    name: "nota.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("MZ\x90\x00 executavel", "latin1"),
  });
  await expect(page.getByText(/Arquivo não permitido/)).toBeVisible({
    timeout: 20_000,
  });
});

// HU-11 "o extrato mostra o ícone de clipe": hoje o clipe só marca comprovantes conciliados
// (ponytail em src/app/(sistema)/extrato/page.tsx). Pendência registrada em documentos/qualidade/revisoes.md.
test.fixme("anexo manual mostra o clipe no extrato", async () => {});
