import { expect, test } from "@playwright/test";
import { EMPRESA_DEMO, hidratada, semAbertura, sql } from "./apoio";

// HU-13 (categorias e regras) e HU-09 (centros de custo).
const sufixo = Date.now().toString(36).toUpperCase();
test.beforeEach(({ page }) => semAbertura(page));
test.afterAll(() => {
  // Não deixa lixo no banco demo entre execuções.
  sql(`
    delete from public.regras_categorizacao where empresa_id = '${EMPRESA_DEMO}' and padrao like 'E2E %';
    delete from public.categorias where empresa_id = '${EMPRESA_DEMO}' and nome like 'Uniformes E2E%';
    delete from public.centros_de_custo where empresa_id = '${EMPRESA_DEMO}' and nome like 'Manutenção E2E%';`);
});

test("categoria nova aparece no extrato, nome repetido é recusado e arquivar tira das opções", async ({
  page,
}) => {
  const nome = `Uniformes E2E ${sufixo}`;
  await page.goto("/categorias");
  await hidratada(page);
  await page.getByRole("textbox", { name: /Nova categoria/ }).fill(nome);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(page.getByRole("link", { name: nome })).toBeVisible();

  await page.goto("/extrato");
  await expect(
    page.getByLabel("Categoria", { exact: true }).locator("option", {
      hasText: nome,
    }),
  ).toHaveCount(1);

  await page.goto("/categorias");
  await hidratada(page);
  await page.getByRole("textbox", { name: /Nova categoria/ }).fill(nome);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(
    page.getByText("Já existe uma categoria com esse nome."),
  ).toBeVisible();

  await page.getByRole("button", { name: `Arquivar ${nome}` }).click();
  await expect(page.getByText(/Arquivadas \(\d+\)/)).toBeVisible();
  await expect(page.getByRole("link", { name: nome })).toHaveCount(0);
  // Some das opções para classificar (o filtro ainda acha as antigas).
  await page.goto("/extrato");
  await expect(
    page
      .getByRole("combobox", { name: /^Categoria de / })
      .first()
      .locator("option", { hasText: nome }),
  ).toHaveCount(0);
});

test("regra nova entra na lista e pode subir e ser excluída", async ({
  page,
}) => {
  const padrao = `E2E ${sufixo}`;
  await page.goto("/categorias");
  await hidratada(page);
  await page.getByText("Nova regra").click();
  await page.getByLabel("contém o texto").fill(padrao);
  await page
    .locator("#regra-nova-categoria")
    .selectOption({ label: "Combustível" });
  // Prioridade alta (número grande): nunca é a primeira da lista, então pode subir.
  await page.locator("#regra-nova-prioridade").fill("900");
  await page.getByRole("button", { name: "Criar regra" }).click();
  await expect(
    page.getByText("Regra criada. Vale para as próximas transações."),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: `Editar a regra ${padrao}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Subir a regra ${padrao}` }).click();
  await expect(page.getByText("Regra subiu na lista.")).toBeVisible();
  await page
    .getByRole("button", { name: `Excluir a regra ${padrao}` })
    .first()
    .click();
  const confirmar = page.getByRole("group", {
    name: `Excluir a regra ${padrao}?`,
  });
  await confirmar.getByRole("button", { name: /Excluir/ }).click();
  await expect(
    page.getByRole("button", { name: `Editar a regra ${padrao}` }),
  ).toHaveCount(0);
});

test("centros de custo: os 4 do seed aparecem e um novo pode ser criado e arquivado", async ({
  page,
}) => {
  await page.goto("/centros-de-custo");
  for (const nome of [
    "Ar-condicionado/Refrigeração",
    "Elétrica",
    "Prevenção contra incêndio",
    "Administrativo",
  ])
    await expect(
      page.getByRole("button", { name: `Renomear ${nome}` }),
    ).toBeVisible();

  const novo = `Manutenção E2E ${sufixo}`;
  await hidratada(page);
  await page.getByRole("textbox", { name: "Novo centro de custo" }).fill(novo);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Arquivar ${novo}` }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Arquivar ${novo}` }).click();
  await expect(page.getByText(/Arquivados \(\d+\)/)).toBeVisible();

  // Arquivado some das opções para atribuir na transação.
  await page.goto("/extrato");
  await page.locator('main li a[href^="/extrato/"]').first().click();
  await expect(
    page
      .getByRole("combobox", { name: "Centro de custo" })
      .locator("option", { hasText: "Elétrica" }),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("combobox", { name: "Centro de custo" })
      .locator("option", { hasText: novo }),
  ).toHaveCount(0);
});
