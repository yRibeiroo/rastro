import type { Account, Item, Transaction } from "pluggy-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  codigoHttpDe,
  contraparteDe,
  cursorDoProximo,
  interpretarEventoDaPluggy,
  paraContaDoProvedor,
  paraDataContabil,
  paraStatusDaConexao,
  paraTransacaoDoProvedor,
  ProvedorBancarioPluggy,
  type ClienteDaPluggy,
} from "@/regras-de-negocio/conexao-bancaria/adaptadores/pluggy/provedor-bancario-pluggy";
import { EVENTOS_DO_WEBHOOK } from "@/regras-de-negocio/conexao-bancaria";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";
import { CONTA_EXTERNA, EMPRESA, fixture, fixtureCrua, ITEM } from "../falsos";

type Pagina<T> = { results: T[]; next?: string | null };
const transacoes = fixture<Pagina<Transaction>>("transacoes-pagina-1.json");
const contas = fixture<Pagina<Account>>("contas.json");
const item = fixture<Item>("item.json");
const webhooks = fixtureCrua<Record<string, Record<string, unknown>>>("webhooks.json");

function clienteFalso(parcial: Partial<Record<keyof ClienteDaPluggy, unknown>> = {}) {
  return {
    createConnectToken: vi.fn(async () => ({ accessToken: "tok" })),
    fetchItem: vi.fn(async () => item),
    fetchAccounts: vi.fn(async () => contas),
    fetchTransactionsCursor: vi.fn(async () => transacoes),
    fetchWebhooks: vi.fn(async () => ({ results: [] })),
    createWebhook: vi.fn(async () => ({})),
    updateWebhook: vi.fn(async () => ({})),
    ...parcial,
  } as unknown as ClienteDaPluggy & Record<string, ReturnType<typeof vi.fn>>;
}

describe("mapeamento Pluggy → Transação", () => {
  const [debito, credito, tarifa] = transacoes.results.map(paraTransacaoDoProvedor);

  it("saída é sempre negativa e entrada positiva, em centavos inteiros", () => {
    expect(debito.valorCentavos).toBe(-25090);
    expect(credito.valorCentavos).toBe(180000);
    // DEBIT que já vem com sinal negativo continua negativo (não inverte duas vezes).
    expect(tarifa.valorCentavos).toBe(-5990);
  });

  it("contraparte: quem recebeu na saída, quem pagou na entrada, senão o estabelecimento", () => {
    expect(debito.contraparte).toBe("Posto Ipiranga Palmas");
    expect(credito.contraparte).toBe("Condominio Residencial Sol");
    expect(tarifa.contraparte).toBe("SICREDI"); // merchant.name vazio → businessName
    expect(contraparteDe({ type: "DEBIT" } as Transaction)).toBeNull();
  });

  it("ids viram texto e documentos/contas da contraparte não são copiados", () => {
    expect(debito.idExterno).toBe("f1a2b3c4-d5e6-4f70-8192-a3b4c5d6e7f8");
    expect(debito.contaIdExterno).toBe(CONTA_EXTERNA);
    expect(JSON.stringify(debito)).not.toMatch(/98765432000110|12345678000190/);
    const comIdNaoTexto = paraTransacaoDoProvedor({
      ...transacoes.results[0],
      id: { toString: () => "uuid-objeto" } as unknown as string,
    });
    expect(comIdNaoTexto.idExterno).toBe("uuid-objeto");
  });

  it("data no fuso America/Araguaina: 01:15 UTC ainda é o dia anterior em Palmas", () => {
    expect(debito.data).toBe("2026-10-07");
    // Meia-noite UTC exata = data sem hora: não volta um dia.
    expect(credito.data).toBe("2026-10-07");
    expect(paraDataContabil("2026-01-31")).toBe("2026-01-31");
    expect(paraDataContabil("2026-02-01T02:59:59.000Z")).toBe("2026-01-31");
  });

  it("pendente, método de pagamento, descrição original e categoria do provedor", () => {
    expect(tarifa.pendente).toBe(true);
    expect(debito.pendente).toBe(false);
    expect(debito.metodoDePagamento).toBe("PIX");
    expect(debito.descricaoOriginal).toBe("PIX ENV 08/10 POSTO IPIRANGA");
    expect(credito.descricaoOriginal).toBeNull();
    expect(debito.categoriaDoProvedor).toBe("Gas stations");
    expect(
      paraTransacaoDoProvedor({ ...transacoes.results[0], description: "  " }).descricao,
    ).toBe("(sem descrição)");
  });
});

describe("mapeamentos fixos", () => {
  it("status do item", () => {
    expect(paraStatusDaConexao("UPDATED")).toBe("atualizada");
    expect(paraStatusDaConexao("MERGING")).toBe("atualizando");
    expect(paraStatusDaConexao("WAITING_USER_ACTION")).toBe("aguardando_usuario");
    expect(paraStatusDaConexao("LOGIN_ERROR")).toBe("erro_de_login");
    expect(paraStatusDaConexao("OUTDATED")).toBe("desatualizada");
    expect(paraStatusDaConexao("QUALQUER")).toBe("erro");
  });

  it("contas: tipo, 4 últimos dígitos e saldo em centavos", () => {
    const [corrente, poupanca, cartao] = contas.results.map(paraContaDoProvedor);
    expect(corrente).toEqual({
      idExterno: CONTA_EXTERNA,
      nome: "Sicredi Empresas",
      tipo: "corrente",
      numeroFinal: "3456",
      saldoCentavos: 1523456,
    });
    expect(poupanca?.tipo).toBe("poupanca");
    expect(cartao?.tipo).toBe("cartao_de_credito");
    expect(paraContaDoProvedor({ ...contas.results[0], subtype: "OUTRO" } as unknown as Account)).toBeNull();
    expect(paraContaDoProvedor({ ...contas.results[0], number: "" } as Account)?.numeroFinal).toBeNull();
  });

  it("cursor vem do parâmetro after do link next", () => {
    expect(cursorDoProximo(transacoes.next ?? null)).toBe("eyJpZCI6ImM0ZDUifQ");
    expect(cursorDoProximo(null)).toBeNull();
  });

  it("código HTTP do erro do SDK (objeto, não Error)", () => {
    expect(codigoHttpDe({ code: 404, message: "Item not found" })).toBe(404);
    expect(codigoHttpDe({ code: "500" })).toBe(500);
    expect(codigoHttpDe({ status: 401 })).toBe(401);
    expect(codigoHttpDe(new Error("rede"))).toBeNull();
    expect(codigoHttpDe(null)).toBeNull();
  });
});

describe("ProvedorBancarioPluggy", () => {
  it("connect token SEM webhookUrl, com clientUserId = empresaId e avoidDuplicates", async () => {
    const cliente = clienteFalso();
    const provedor = new ProvedorBancarioPluggy(() => cliente);
    await expect(
      provedor.criarTokenDeConexao({ identificadorDoUsuario: EMPRESA }),
    ).resolves.toEqual({ token: "tok" });
    expect(cliente.createConnectToken).toHaveBeenCalledWith(undefined, {
      clientUserId: EMPRESA,
      avoidDuplicates: true,
    });
    await provedor.criarTokenDeConexao({ identificadorDoUsuario: EMPRESA, idExternoParaReconectar: ITEM });
    expect(cliente.createConnectToken).toHaveBeenLastCalledWith(ITEM, expect.not.objectContaining({ webhookUrl: expect.anything() }));
  });

  it("obterConexao: GET /items é traduzido; 404 vira null; 5xx vira provedor_indisponivel", async () => {
    const provedor = new ProvedorBancarioPluggy(() => clienteFalso());
    expect(await provedor.obterConexao(ITEM)).toMatchObject({
      idExterno: ITEM,
      banco: "Sicredi Empresas",
      status: "atualizada",
      identificadorDoUsuario: EMPRESA,
      consentimentoExpiraEm: new Date("2027-10-01T00:00:00.000Z"),
    });
    const com404 = new ProvedorBancarioPluggy(() =>
      clienteFalso({ fetchItem: vi.fn(async () => Promise.reject({ code: 404, message: "not found" })) }),
    );
    expect(await com404.obterConexao(ITEM)).toBeNull();
    const com500 = new ProvedorBancarioPluggy(() =>
      clienteFalso({ fetchItem: vi.fn(async () => Promise.reject({ code: 500 })) }),
    );
    await expect(com500.obterConexao(ITEM)).rejects.toMatchObject({ codigo: "provedor_indisponivel" });
  });

  it("item com erro traz código e mensagem", async () => {
    const provedor = new ProvedorBancarioPluggy(() =>
      clienteFalso({
        fetchItem: vi.fn(async () => ({ ...item, status: "LOGIN_ERROR", error: { code: "INVALID_CREDENTIALS", message: "x" } })),
      }),
    );
    expect(await provedor.obterConexao(ITEM)).toMatchObject({
      status: "erro_de_login",
      erro: { codigo: "INVALID_CREDENTIALS", mensagem: "x" },
    });
  });

  it("listarContas filtra subtipos desconhecidos; erro de rede vira provedor_indisponivel", async () => {
    const provedor = new ProvedorBancarioPluggy(() => clienteFalso());
    expect((await provedor.listarContas(ITEM)).map((c) => c.tipo)).toEqual([
      "corrente",
      "poupanca",
      "cartao_de_credito",
    ]);
    const falha = new ProvedorBancarioPluggy(() =>
      clienteFalso({ fetchAccounts: vi.fn(async () => Promise.reject(new Error("ECONNRESET"))) }),
    );
    const erro = await falha.listarContas(ITEM).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeNegocio);
    expect(erro.codigo).toBe("provedor_indisponivel");
  });

  it("listarTransacoes traduz filtros (createdAtFrom × dateFrom, ids ≤ 500, cursor)", async () => {
    const cliente = clienteFalso();
    const provedor = new ProvedorBancarioPluggy(() => cliente);
    const pagina = await provedor.listarTransacoes(CONTA_EXTERNA, {
      criadasDesde: new Date("2026-10-08T12:30:00.000Z"),
      cursor: "abc",
    });
    expect(pagina.itens).toHaveLength(3);
    expect(pagina.proximoCursor).toBe("eyJpZCI6ImM0ZDUifQ");
    expect(cliente.fetchTransactionsCursor).toHaveBeenCalledWith(CONTA_EXTERNA, {
      createdAtFrom: "2026-10-08T12:30:00.000Z",
      after: "abc",
    });
    await provedor.listarTransacoes(CONTA_EXTERNA, {
      ids: Array.from({ length: 600 }, (_, i) => `id-${i}`),
    });
    expect(vi.mocked(cliente.fetchTransactionsCursor).mock.calls[1][1]?.ids).toHaveLength(500);
    await provedor.listarTransacoes(CONTA_EXTERNA, { dataDe: "2026-01-01", dataAte: "2026-02-01" });
    expect(vi.mocked(cliente.fetchTransactionsCursor).mock.calls[2][1]).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-02-01" });
    await provedor.listarTransacoes(CONTA_EXTERNA);
    expect(vi.mocked(cliente.fetchTransactionsCursor).mock.calls[3][1]).toEqual({});
  });

  it("registrarWebhooks cria os ausentes e atualiza (mesmo evento + URL) com o cabeçalho secreto", async () => {
    const url = "https://rastro.app/api/webhooks/pluggy";
    const cliente = clienteFalso({
      fetchWebhooks: vi.fn(async () => ({
        results: [
          { id: "w1", event: "item/created", url },
          { id: "w2", event: "item/updated", url: "https://outra.url" },
        ],
      })),
    });
    const provedor = new ProvedorBancarioPluggy(() => cliente);
    const cabecalhos = { Authorization: "Bearer segredo" };
    const r = await provedor.registrarWebhooks({ url, eventos: EVENTOS_DO_WEBHOOK, cabecalhos });
    expect(r.atualizados).toEqual(["item/created"]);
    expect(r.criados).toHaveLength(5);
    expect(cliente.updateWebhook).toHaveBeenCalledWith("w1", { url, event: "item/created", headers: cabecalhos, enabled: true });
    expect(cliente.createWebhook).toHaveBeenCalledWith("item/updated", url, cabecalhos);
    await expect(
      provedor.registrarWebhooks({ url: "http://inseguro", eventos: EVENTOS_DO_WEBHOOK, cabecalhos }),
    ).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });

  it("o cliente só é criado na primeira chamada (credenciais preguiçosas)", async () => {
    const fabrica = vi.fn(() => clienteFalso());
    const provedor = new ProvedorBancarioPluggy(fabrica);
    expect(provedor.interpretarWebhook(webhooks["item-created"])).not.toBeNull();
    expect(fabrica).not.toHaveBeenCalled();
    await provedor.listarContas(ITEM);
    await provedor.listarContas(ITEM);
    expect(fabrica).toHaveBeenCalledTimes(1);
  });
});

describe("interpretarWebhook (Zod)", () => {
  it("traduz os 6 eventos assinados", () => {
    expect(interpretarEventoDaPluggy(webhooks["item-created"])).toEqual({
      tipo: "conexao_criada",
      eventoId: "a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      nomeOriginal: "item/created",
      conexaoIdExterno: ITEM,
    });
    expect(interpretarEventoDaPluggy(webhooks["item-updated"])?.tipo).toBe("conexao_atualizada");
    expect(interpretarEventoDaPluggy(webhooks["item-error"])).toMatchObject({
      tipo: "conexao_com_erro",
      erro: { codigo: "INVALID_CREDENTIALS_MFA", mensagem: "Credenciais inválidas" },
    });
    expect(interpretarEventoDaPluggy(webhooks["transactions-created"])).toMatchObject({
      tipo: "transacoes_criadas",
      contaIdExterno: CONTA_EXTERNA,
      criadasDesde: new Date("2026-10-08T12:30:00.000Z"),
    });
    expect(interpretarEventoDaPluggy(webhooks["transactions-updated"])).toMatchObject({
      tipo: "transacoes_atualizadas",
      transacaoIdsExternos: ["f1a2b3c4-d5e6-4f70-8192-a3b4c5d6e7f8", "a2b3c4d5-e6f7-4081-92a3-b4c5d6e7f809"],
    });
    expect(interpretarEventoDaPluggy(webhooks["transactions-deleted"])?.tipo).toBe("transacoes_removidas");
  });

  it("evento não assinado vira 'ignorado'; item/error sem objeto de erro ainda é aceito", () => {
    expect(interpretarEventoDaPluggy(webhooks["connector-status"])).toEqual({
      tipo: "ignorado",
      eventoId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
      nomeOriginal: "connector/status_updated",
      conexaoIdExterno: null,
    });
    expect(
      interpretarEventoDaPluggy({ event: "item/deleted", eventId: "e1", itemId: ITEM }),
    ).toMatchObject({ tipo: "ignorado", conexaoIdExterno: ITEM });
    expect(
      interpretarEventoDaPluggy({ event: "item/error", eventId: "e2", itemId: ITEM }),
    ).toMatchObject({ erro: { codigo: "desconhecido", mensagem: "" } });
  });

  it("corpo inválido → null", () => {
    expect(interpretarEventoDaPluggy(null)).toBeNull();
    expect(interpretarEventoDaPluggy("texto")).toBeNull();
    expect(interpretarEventoDaPluggy({ event: "item/created" })).toBeNull(); // sem eventId
    expect(interpretarEventoDaPluggy({ event: "item/created", eventId: "x" })).toBeNull(); // sem itemId
    expect(interpretarEventoDaPluggy({ ...webhooks["item-error"], itemId: 42 })).toBeNull();
    expect(
      interpretarEventoDaPluggy({ ...webhooks["transactions-created"], transactionsCreatedAtFrom: "ontem" }),
    ).toBeNull();
    expect(
      interpretarEventoDaPluggy({ ...webhooks["transactions-updated"], transactionIds: "a,b" }),
    ).toBeNull();
    expect(interpretarEventoDaPluggy({ ...webhooks["item-updated"], itemId: "" })).toBeNull();
  });
});
