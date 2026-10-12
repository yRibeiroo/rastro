import { describe, expect, it, vi } from "vitest";
import type { EventoDeWebhook } from "@/regras-de-negocio/conexao-bancaria";
import { criarServicoDeSincronizacao } from "@/regras-de-negocio/extrato";
import {
  CONTA_EXTERNA,
  ConexoesEmMemoria,
  ContasEmMemoria,
  ctx,
  EMPRESA,
  EventosEmMemoria,
  ITEM,
  novoId,
  ProvedorFalso,
  TransacoesEmMemoria,
  umaConexao,
  umaTransacaoDoProvedor,
} from "../falsos";

const AGORA = new Date("2026-10-09T12:00:00Z");
const DIA = 86_400_000;

function montar(opcoes: { conexoes?: ReturnType<typeof umaConexao>[] } = {}) {
  const provedor = new ProvedorFalso();
  const conexoes = new ConexoesEmMemoria(opcoes.conexoes ?? []);
  const contas = new ContasEmMemoria();
  const transacoes = new TransacoesEmMemoria();
  const eventos = new EventosEmMemoria();
  const empresas = { existe: vi.fn(async (id: string) => id === EMPRESA) };
  const categorizacao = {
    categorizarPendentes: vi.fn(async () => ({
      categorizadas: 0,
      semSugestao: 0,
    })),
  };
  const consumirLimite = vi.fn(async () => true);
  const servico = criarServicoDeSincronizacao({
    provedor,
    conexoes,
    contas,
    transacoes,
    eventos,
    empresas,
    categorizacao,
    consumirLimite,
    agora: () => AGORA,
  });
  return {
    provedor,
    conexoes,
    contas,
    transacoes,
    eventos,
    empresas,
    categorizacao,
    consumirLimite,
    servico,
  };
}

const base = { eventoId: "ev-1", conexaoIdExterno: ITEM };
const ev = {
  criada: { ...base, tipo: "conexao_criada", nomeOriginal: "item/created" },
  atualizada: {
    ...base,
    tipo: "conexao_atualizada",
    nomeOriginal: "item/updated",
  },
  erro: {
    ...base,
    tipo: "conexao_com_erro",
    nomeOriginal: "item/error",
    erro: { codigo: "INVALID_CREDENTIALS", mensagem: "Senha errada" },
  },
  transacoesCriadas: {
    ...base,
    tipo: "transacoes_criadas",
    nomeOriginal: "transactions/created",
    contaIdExterno: CONTA_EXTERNA,
    criadasDesde: new Date("2026-10-08T12:30:00Z"),
  },
  transacoesAtualizadas: {
    ...base,
    tipo: "transacoes_atualizadas",
    nomeOriginal: "transactions/updated",
    contaIdExterno: CONTA_EXTERNA,
    transacaoIdsExternos: Array.from({ length: 501 }, (_, i) => `tx-${i}`),
  },
  transacoesRemovidas: {
    ...base,
    tipo: "transacoes_removidas",
    nomeOriginal: "transactions/deleted",
    contaIdExterno: CONTA_EXTERNA,
    transacaoIdsExternos: ["tx-a"],
  },
  ignorado: {
    ...base,
    tipo: "ignorado",
    nomeOriginal: "connector/status_updated",
    conexaoIdExterno: null,
  },
} satisfies Record<string, EventoDeWebhook>;

describe("processarEvento — cada evento chama o serviço certo", () => {
  it("item/created: GET /items é a fonte da verdade, cria a conexão pelo clientUserId e sincroniza tudo", async () => {
    const m = montar();
    m.provedor.paginas = [
      {
        itens: [umaTransacaoDoProvedor({ idExterno: "a" })],
        proximoCursor: "1",
      },
      {
        itens: [
          umaTransacaoDoProvedor({ idExterno: "b" }),
          umaTransacaoDoProvedor({ idExterno: "zero", valorCentavos: 0 }),
        ],
        proximoCursor: null,
      },
    ];
    await m.servico.processarEvento(ev.criada);
    expect(m.provedor.obterConexao).toHaveBeenCalledWith(ITEM);
    expect(m.empresas.existe).toHaveBeenCalledWith(EMPRESA);
    expect(m.conexoes.linhas).toHaveLength(1);
    // só a conta corrente (P-04), sem filtro (histórico completo), seguindo o cursor
    expect(m.provedor.listarTransacoes).toHaveBeenCalledTimes(2);
    expect(m.provedor.listarTransacoes.mock.calls[0]).toEqual([
      CONTA_EXTERNA,
      { cursor: undefined },
    ]);
    expect(m.transacoes.linhas.map((t) => t.idExterno)).toEqual(["a", "b"]); // valor 0 fica fora
    expect(m.contas.linhas.map((c) => c.tipo)).toEqual(["corrente"]);
    expect(m.conexoes.marcarSincronizada).toHaveBeenCalled();
    expect(m.categorizacao.categorizarPendentes).toHaveBeenCalledWith(EMPRESA);
    expect(m.eventos.marcarProcessado).toHaveBeenCalledWith("ev-1", {
      empresaId: EMPRESA,
      erro: null,
    });
  });

  it("item/created com item ainda atualizando: só grava a conexão", async () => {
    const m = montar();
    m.provedor.conexao!.status = "atualizando";
    await m.servico.processarEvento(ev.criada);
    expect(m.conexoes.linhas[0].status).toBe("atualizando");
    expect(m.provedor.listarTransacoes).not.toHaveBeenCalled();
  });

  it("item/created de empresa inexistente ou de outra aplicação: não cria nada e registra o erro", async () => {
    const m = montar();
    m.provedor.conexao!.identificadorDoUsuario =
      "99999999-2222-4333-8444-555555555555";
    await m.servico.processarEvento(ev.criada);
    expect(m.conexoes.linhas).toHaveLength(0);
    expect(m.eventos.marcarProcessado).toHaveBeenCalledWith("ev-1", {
      empresaId: null,
      erro: "conexao_nao_encontrada",
    });
    const sem = montar();
    sem.provedor.conexao = null;
    await sem.servico.processarEvento(ev.criada);
    expect(sem.eventos.marcarProcessado).toHaveBeenCalledWith("ev-1", {
      empresaId: null,
      erro: "conexao_nao_encontrada",
    });
  });

  it("item/updated: atualiza o status pelo GET /items e sincroniza desde a última sincronização − 2 dias", async () => {
    const conexao = umaConexao({
      status: "atualizando",
      ultimaSincronizacaoEm: new Date("2026-10-08T00:00:00Z"),
    });
    const m = montar({ conexoes: [conexao] });
    await m.servico.processarEvento(ev.atualizada);
    expect(m.conexoes.atualizarStatus).toHaveBeenCalledWith(
      EMPRESA,
      conexao.id,
      expect.objectContaining({ status: "atualizada" }),
    );
    expect(m.provedor.listarTransacoes.mock.calls[0][1]).toEqual({
      criadasDesde: new Date("2026-10-06T00:00:00Z"),
      cursor: undefined,
    });
  });

  it("item/updated sem sincronização anterior busca o histórico completo", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    await m.servico.processarEvento(ev.atualizada);
    expect(m.provedor.listarTransacoes.mock.calls[0][1]).toEqual({
      cursor: undefined,
    });
  });

  it("item/error: confirma no GET /items e grava status + erro", async () => {
    const conexao = umaConexao();
    const m = montar({ conexoes: [conexao] });
    m.provedor.conexao!.status = "erro_de_login";
    await m.servico.processarEvento(ev.erro);
    expect(m.conexoes.atualizarStatus).toHaveBeenCalledWith(
      EMPRESA,
      conexao.id,
      {
        status: "erro_de_login",
        erro: { codigo: "INVALID_CREDENTIALS", mensagem: "Senha errada" },
        consentimentoExpiraEm: expect.any(Date),
      },
    );
    // Status sem significado de erro vira 'erro'
    m.provedor.conexao!.status = "atualizada";
    m.provedor.conexao!.erro = { codigo: "X", mensagem: "y" };
    await m.servico.processarEvento(ev.erro);
    expect(m.conexoes.atualizarStatus).toHaveBeenLastCalledWith(
      EMPRESA,
      conexao.id,
      expect.objectContaining({
        status: "erro",
        erro: { codigo: "X", mensagem: "y" },
      }),
    );
    expect(m.provedor.listarTransacoes).not.toHaveBeenCalled();
  });

  it("transactions/created: busca pela API com createdAtFrom (não usa o payload)", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    m.provedor.paginas = [
      { itens: [umaTransacaoDoProvedor()], proximoCursor: null },
    ];
    await m.servico.processarEvento(ev.transacoesCriadas);
    expect(m.provedor.listarTransacoes).toHaveBeenCalledWith(CONTA_EXTERNA, {
      criadasDesde: new Date("2026-10-08T12:30:00Z"),
      cursor: undefined,
    });
    expect(m.transacoes.linhas).toHaveLength(1);
    expect(m.categorizacao.categorizarPendentes).toHaveBeenCalled();
  });

  it("transactions/created de conta que não é corrente: ignora", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    await m.servico.processarEvento({
      ...ev.transacoesCriadas,
      contaIdExterno: "poupanca-1",
    });
    expect(m.provedor.listarTransacoes).not.toHaveBeenCalled();
    expect(m.eventos.marcarProcessado).toHaveBeenCalledWith("ev-1", {
      empresaId: EMPRESA,
      erro: null,
    });
  });

  it("transactions/updated: rebusca por ids em lotes de até 500", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    await m.servico.processarEvento(ev.transacoesAtualizadas);
    const chamadas = m.provedor.listarTransacoes.mock.calls.map(
      (c) => (c[1] as { ids: string[] }).ids.length,
    );
    expect(chamadas).toEqual([500, 1]);
  });

  it("transactions/deleted: remove pelos ids externos", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    await m.transacoes.salvarDoProvedor(EMPRESA, novoId(), [
      { ...umaTransacaoDoProvedor({ idExterno: "tx-a" }), contaId: novoId() },
    ]);
    await m.servico.processarEvento(ev.transacoesRemovidas);
    expect(m.transacoes.linhas).toHaveLength(0);
    expect(m.provedor.listarTransacoes).not.toHaveBeenCalled();
    const vazio = montar();
    await vazio.servico.processarEvento(ev.transacoesRemovidas);
    expect(vazio.eventos.marcarProcessado).toHaveBeenCalledWith("ev-1", {
      empresaId: null,
      erro: "conexao_nao_encontrada",
    });
  });

  it("evento ignorado só é marcado como processado", async () => {
    const m = montar();
    await m.servico.processarEvento(ev.ignorado);
    expect(m.provedor.obterConexao).not.toHaveBeenCalled();
    expect(m.eventos.marcarProcessado).toHaveBeenCalledWith("ev-1", {
      empresaId: null,
      erro: null,
    });
  });

  it("nunca lança: falha inesperada vira erro curto, sem payload, em eventos_webhook", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    m.provedor.listarContas.mockRejectedValue(
      new TypeError("boom com dado sensível"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      m.servico.processarEvento(ev.transacoesCriadas),
    ).resolves.toBeUndefined();
    expect(m.eventos.marcarProcessado).toHaveBeenCalledWith("ev-1", {
      empresaId: null,
      erro: "falha_inesperada:TypeError",
    });
    m.eventos.marcarProcessado.mockRejectedValue(new Error("banco fora"));
    await expect(
      m.servico.processarEvento(ev.ignorado),
    ).resolves.toBeUndefined();
    await m.servico.processarEvento({ ...ev.ignorado, eventoId: "ev-2" });
    m.provedor.listarContas.mockRejectedValue("texto");
    await m.servico.processarEvento(ev.transacoesCriadas);
  });

  it("falha da categorização não derruba a sincronização", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    m.categorizacao.categorizarPendentes.mockRejectedValue(
      new Error("IA fora"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.provedor.paginas = [
      { itens: [umaTransacaoDoProvedor()], proximoCursor: null },
    ];
    expect(await m.servico.sincronizarConexao(ITEM)).toEqual({
      transacoesGravadas: 1,
    });
  });
});

describe("categoria do usuário nunca é sobrescrita pela sincronização", () => {
  it("reprocessar a mesma transação atualiza valor/descrição e mantém a categoria do usuário", async () => {
    const m = montar({ conexoes: [umaConexao()] });
    m.provedor.paginas = [
      {
        itens: [umaTransacaoDoProvedor({ idExterno: "x" })],
        proximoCursor: null,
      },
    ];
    await m.servico.sincronizarConexao(ITEM);
    const t = m.transacoes.linhas[0];
    const categoriaId = novoId();
    await m.transacoes.definirCategoriaPeloUsuario(EMPRESA, t.id, {
      categoriaId,
      centroDeCustoId: null,
    });
    m.provedor.paginas = [
      {
        itens: [
          umaTransacaoDoProvedor({
            idExterno: "x",
            descricao: "NOVA DESCRICAO",
            valorCentavos: -999,
          }),
        ],
        proximoCursor: null,
      },
    ];
    await m.servico.sincronizarConexao(ITEM);
    expect(m.transacoes.linhas).toHaveLength(1);
    expect(m.transacoes.linhas[0]).toMatchObject({
      descricao: "NOVA DESCRICAO",
      valorCentavos: -999,
      categoriaId,
      categoriaOrigem: "usuario",
      categoriaDefinidaPeloUsuario: true,
    });
  });
});

describe("sincronizarConexao, ressincronizarTodas e sincronizarAgora", () => {
  it("sincronizarConexao de conexão desconhecida → conexao_nao_encontrada", async () => {
    await expect(
      montar().servico.sincronizarConexao(ITEM),
    ).rejects.toMatchObject({ codigo: "conexao_nao_encontrada" });
  });

  it("ressincronizarTodas: 7 dias para todas, contando falhas sem parar", async () => {
    const boa = umaConexao();
    const ruim = umaConexao({ idExterno: "item-ruim" });
    const m = montar({ conexoes: [boa, ruim] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.provedor.listarContas.mockImplementation(async (id?: string) => {
      if (id === "item-ruim") throw new Error("fora");
      return m.provedor.contas;
    });
    expect(await m.servico.ressincronizarTodas()).toEqual({
      conexoes: 2,
      falhas: 1,
    });
    expect(m.provedor.listarTransacoes.mock.calls[0][1]).toEqual({
      criadasDesde: new Date(AGORA.getTime() - 7 * DIA),
      cursor: undefined,
    });
    m.provedor.conexao = null;
    expect(await m.servico.ressincronizarTodas()).toEqual({
      conexoes: 2,
      falhas: 1,
    });
  });

  it("sincronizarAgora: só conexão da empresa, rate limit 6/h e janela de 90 dias", async () => {
    const conexao = umaConexao();
    const m = montar({ conexoes: [conexao] });
    await m.servico.sincronizarAgora(ctx, conexao.id);
    expect(m.consumirLimite).toHaveBeenCalledWith(
      `sincronizar:usuario:${ctx.usuarioId}`,
      { maximo: 6, janelaEmSegundos: 3600 },
    );
    expect(m.provedor.listarTransacoes.mock.calls[0][1]).toEqual({
      criadasDesde: new Date(AGORA.getTime() - 90 * DIA),
      cursor: undefined,
    });
    await expect(m.servico.sincronizarAgora(ctx, "x")).rejects.toMatchObject({
      codigo: "conexao_nao_encontrada",
    });
    await expect(
      m.servico.sincronizarAgora(ctx, novoId()),
    ).rejects.toMatchObject({ codigo: "conexao_nao_encontrada" });
    m.consumirLimite.mockResolvedValue(false);
    await expect(
      m.servico.sincronizarAgora(ctx, conexao.id),
    ).rejects.toMatchObject({ codigo: "limite_excedido" });
  });

  it("rate limit fora do ar não bloqueia o usuário autenticado (fail-open)", async () => {
    const conexao = umaConexao();
    const m = montar({ conexoes: [conexao] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.consumirLimite.mockRejectedValue(new Error("banco"));
    await expect(m.servico.sincronizarAgora(ctx, conexao.id)).resolves.toEqual({
      transacoesGravadas: 0,
    });
  });
});

describe("conexão 'arquivo' (extrato importado, ADR 0016)", () => {
  it("o cron ignora e o 'Sincronizar agora' recusa: não há o que buscar na Pluggy", async () => {
    const arquivo = umaConexao({ provedor: "arquivo", idExterno: EMPRESA });
    const m = montar({ conexoes: [arquivo] });
    expect(await m.servico.ressincronizarTodas()).toEqual({
      conexoes: 0,
      falhas: 0,
    });
    expect(m.provedor.obterConexao).not.toHaveBeenCalled();
    await expect(
      m.servico.sincronizarAgora(ctx, arquivo.id),
    ).rejects.toMatchObject({ codigo: "conexao_nao_encontrada" });
  });
});
