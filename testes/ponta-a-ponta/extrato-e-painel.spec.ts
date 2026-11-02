import { expect, test, type Page } from "@playwright/test";
import { EMPRESA_DEMO, hidratada, semAbertura, sql } from "./apoio";

// HU-06 (busca e filtros), HU-08 (corrigir e virar regra), HU-10 (painel atualiza).
test.beforeEach(({ page }) => semAbertura(page));

const linhas = (page: Page) => page.locator('main li a[href^="/extrato/"]');

test("abre no mês atual, da mais recente para a mais antiga", async ({
  page,
}) => {
  await page.goto("/extrato");
  await expect(page.getByLabel("Período")).toHaveValue("mes");
  await expect(linhas(page).first()).toBeVisible();
  const dias = await page
    .locator("main section[aria-labelledby^='dia-']")
    .evaluateAll((s) =>
      s.map((e) => e.getAttribute("aria-labelledby")!.slice(4)),
    );
  expect(dias.length).toBeGreaterThan(1);
  expect([...dias].sort().reverse()).toEqual(dias);
});

test("busca ignora acentos e maiúsculas e o endereço guarda a busca", async ({
  page,
}) => {
  await page.goto("/extrato?periodo=tudo");
  await hidratada(page);
  await page.getByRole("searchbox").fill("pôsto");
  await expect(page).toHaveURL(/busca=p%C3%B4sto|busca=pôsto/);
  await expect(linhas(page).first()).toBeVisible();
  for (const texto of await linhas(page).allTextContents())
    expect(texto).toMatch(/POSTO/);
});

test("Saídas + Combustível + Mês passado ficam no endereço", async ({
  page,
}) => {
  await page.goto("/extrato");
  await hidratada(page);
  await page.getByLabel("Período").selectOption({ label: "Mês passado" });
  await page.getByLabel("Entradas ou saídas").selectOption("saida");
  await page.getByLabel("Categoria", { exact: true }).selectOption({
    label: "Combustível",
  });
  await expect(page).toHaveURL(/sentido=saida/);
  await expect(page).toHaveURL(/categoria=[0-9a-f-]{36}/);
  await expect(linhas(page)).toHaveText([
    "COMPRA CARTAO POSTO ESTRELA DO NORTE",
    "PIX ENVIADO POSTO SAO JOAO",
  ]);

  await page.reload();
  await expect(page.getByLabel("Entradas ou saídas")).toHaveValue("saida");
  await expect(linhas(page)).toHaveCount(2);
});

test("sem resultado: mensagem de vazio e 'Limpar filtros'", async ({
  page,
}) => {
  await page.goto("/extrato?busca=nada-casa-com-isto");
  await expect(
    page.getByText("Nenhuma transação com esses filtros"),
  ).toBeVisible();
  await hidratada(page);
  await page.getByRole("button", { name: "Limpar filtros" }).first().click();
  await expect(page).toHaveURL(/\/extrato$/);
  await expect(linhas(page).first()).toBeVisible();
});

test.describe("recategorizar", () => {
  const DESCRICAO = "COMPRA CARTAO EXTINTORES PALMAS";
  test.beforeEach(() => {
    // Volta ao estado do seed: sem categoria e sem a regra criada por uma execução anterior.
    sql(`
      delete from public.regras_categorizacao
        where empresa_id = '${EMPRESA_DEMO}' and origem = 'correcao' and padrao like '%EXTINTORES%';
      -- O gatilho que protege a categoria do usuário (RF-15) é desligado só nesta sessão de preparo.
      set session_replication_role = replica;
      update public.transacoes
        set categoria_id = null, categoria_origem = null, regra_id = null,
            categoria_definida_pelo_usuario = false
        where empresa_id = '${EMPRESA_DEMO}' and descricao = '${DESCRICAO}';`);
  });

  test("corrigir, aceitar a regra e ver o painel refletir", async ({
    page,
  }) => {
    await page.goto("/painel?periodo=mes");
    const paraOndeFoi = page.getByRole("figure", { name: "Para onde foi" });
    await expect(paraOndeFoi).toBeVisible();
    await expect(
      paraOndeFoi.getByRole("link", { name: "Equipamentos de incêndio" }),
    ).toHaveCount(0);

    await page.goto(
      `/extrato?busca=${encodeURIComponent("extintores palmas")}`,
    );
    await hidratada(page);
    await page
      .getByRole("combobox", { name: `Categoria de ${DESCRICAO}` })
      .first()
      .selectOption({ label: "Equipamentos de incêndio" });
    await expect(
      page.getByText("Transação movida para Equipamentos de incêndio."),
    ).toBeVisible();

    const oferta = page.getByRole("group", { name: "Criar regra" });
    await expect(oferta).toBeVisible();
    await oferta.getByRole("button", { name: "Criar regra" }).click();
    await expect(page.getByText(/^Regra criada\./)).toBeVisible();

    await page.goto("/categorias");
    await expect(page.getByText(/EXTINTORES/).first()).toBeVisible();

    await page.goto("/painel?periodo=mes");
    const item = page
      .getByRole("figure", { name: "Para onde foi" })
      .getByRole("listitem")
      .filter({ hasText: "Equipamentos de incêndio" });
    await expect(item).toContainText("R$ 558,15");
  });
});

test("painel: 'Classificar' leva ao extrato filtrado sem centro de custo", async ({
  page,
}) => {
  await page.goto("/painel");
  await page
    .getByRole("figure", { name: "Resultado por centro de custo" })
    .getByRole("link", { name: "Classificar" })
    .click();
  await expect(page).toHaveURL(/centro=nenhum/);
  await expect(page.getByLabel("Centro de custo", { exact: true })).toHaveValue(
    "nenhum",
  );
});

test("sem Open Finance o menu tem Importar e Comprovantes, e não Conexões bancárias (HU-23)", async ({
  page,
}) => {
  await page.goto("/painel");
  const menu = page.getByRole("navigation", { name: "Principal" }).first();
  await expect(menu.getByRole("link", { name: "Importar" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Comprovantes" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Conexões bancárias" }),
  ).toHaveCount(0);
  const resposta = await page.goto("/conexoes-bancarias");
  expect(resposta?.status()).toBe(404);
});
