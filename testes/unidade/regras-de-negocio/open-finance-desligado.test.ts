import { beforeEach, describe, expect, it, vi } from "vitest";
import { provedorDesligado } from "@/regras-de-negocio/conexao-bancaria";

// RF-45: RECURSO_OPEN_FINANCE ausente/false (padrão). O ambiente é lido uma vez por arquivo de teste.
const sistema = vi.hoisted(() => ({
  provedor: { interpretarWebhook: vi.fn() },
  eventos: { registrar: vi.fn() },
  sincronizacao: {
    ressincronizarTodas: vi.fn(async () => ({ conexoes: 1, falhas: 0 })),
    processarEvento: vi.fn(),
  },
  comprovantes: {
    reconciliarTodas: vi.fn(async () => ({ empresas: 2, conciliados: 3 })),
  },
  limpeza: vi.fn(async () => {}),
}));
vi.mock("@/regras-de-negocio/montagem", () => ({
  servicosDoSistema: () => sistema,
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

const SEGREDO = "s".repeat(40);
beforeEach(() => {
  vi.stubEnv("RECURSO_OPEN_FINANCE", "");
  vi.stubEnv("PLUGGY_WEBHOOK_SECRET", SEGREDO);
  vi.stubEnv("CRON_SECRET", SEGREDO);
});

describe("Open Finance desligado", () => {
  it("o provedor desligado recusa tudo com recurso_desligado e ignora webhooks", async () => {
    for (const chamada of [
      () =>
        provedorDesligado.criarTokenDeConexao({ identificadorDoUsuario: "e" }),
      () => provedorDesligado.obterConexao("i"),
      () => provedorDesligado.listarContas("i"),
      () => provedorDesligado.listarTransacoes("c"),
      () =>
        provedorDesligado.registrarWebhooks({
          url: "https://x",
          eventos: [],
          cabecalhos: {},
        }),
    ])
      await expect(chamada()).rejects.toMatchObject({
        codigo: "recurso_desligado",
      });
    expect(
      provedorDesligado.interpretarWebhook({ event: "item/created" }),
    ).toBeNull();
  });

  it("webhook da Pluggy → 404 sem ler o corpo, mesmo com o Bearer certo", async () => {
    const { POST } = await import("@/app/api/webhooks/pluggy/route");
    const requisicao = new Request("https://rastro.local/api/webhooks/pluggy", {
      method: "POST",
      headers: { authorization: `Bearer ${SEGREDO}` },
      body: "{}",
    });
    const resposta = await POST(requisicao);
    expect(resposta.status).toBe(404);
    expect(requisicao.bodyUsed).toBe(false);
    expect(sistema.eventos.registrar).not.toHaveBeenCalled();
  });

  it("cron roda a limpeza e reconcilia os comprovantes de todas as empresas, sem chamar a Pluggy", async () => {
    const { GET } = await import("@/app/api/tarefas/ressincronizar/route");
    const resposta = await GET(
      new Request("https://rastro.local/api/tarefas/ressincronizar", {
        headers: { authorization: `Bearer ${SEGREDO}` },
      }),
    );
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({
      conexoes: 0,
      falhas: 0,
      comprovantesConciliados: 3,
    });
    expect(sistema.comprovantes.reconciliarTodas).toHaveBeenCalled();
    expect(sistema.sincronizacao.ressincronizarTodas).not.toHaveBeenCalled();
    expect(sistema.limpeza).toHaveBeenCalled();
  });
});
