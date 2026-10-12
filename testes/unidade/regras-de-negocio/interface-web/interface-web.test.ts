import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";
import { ctx, novoId } from "../falsos";

// Sem Next em execução: redirect/notFound viram exceções marcadas, como no framework.
const navegacao = vi.hoisted(() => ({
  redirect: vi.fn((destino: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { destino });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), {});
  }),
  unstable_rethrow: vi.fn((erro: unknown) => {
    if (erro instanceof Error && erro.message.startsWith("NEXT_")) throw erro;
  }),
}));
vi.mock("next/navigation", () => navegacao);
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ refresh }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }),
}));

const servicos = vi.hoisted(() => ({
  atual: null as unknown,
  acesso: null as unknown,
}));
vi.mock("@/regras-de-negocio/montagem", () => ({
  servicosDoUsuario: vi.fn(async () => {
    if (servicos.atual instanceof Error) throw servicos.atual;
    return servicos.atual;
  }),
  servicoDeAcesso: vi.fn(async () => servicos.acesso),
}));

const acoes = await import("@/regras-de-negocio/interface-web/acoes");
const leituras = await import("@/regras-de-negocio/interface-web");
const { executarAcao, ipDaRequisicao } =
  await import("@/regras-de-negocio/interface-web/resultado");

function servicosFalsos() {
  const f = () => vi.fn(async (..._a: unknown[]) => ({ ok: "dados" }) as never);
  return {
    ctx,
    conexoes: {
      iniciarConexao: f(),
      registrarConexao: f(),
      listarConexoes: vi.fn(async () => []),
    },
    extrato: { listar: f(), obter: vi.fn(async () => ({ id: "t" })) },
    sincronizacao: { sincronizarAgora: f() },
    categorizacao: {
      corrigirCategoria: f(),
      criarRegra: f(),
      atualizarRegra: f(),
      removerRegra: f(),
      listarRegras: vi.fn(async () => []),
      listarCategorias: vi.fn(async () => []),
      criarCategoria: f(),
      atualizarCategoria: f(),
    },
    centrosDeCusto: {
      listar: vi.fn(async () => []),
      criar: f(),
      atualizar: f(),
    },
    painel: { obterResumo: f() },
    anexos: {
      anexar: f(),
      listar: vi.fn(async () => []),
      gerarLinkTemporario: f(),
      remover: f(),
    },
    importacao: {
      importar: f(),
      listarImportacoes: vi.fn(async () => []),
      situacao: f(),
    },
    comprovantes: {
      enviar: f(),
      listar: vi.fn(async () => []),
      listarCandidatos: vi.fn(async () => []),
      conciliarManualmente: f(),
      desfazerConciliacao: f(),
      lerDeNovo: f(),
      contarAlertas: vi.fn(async () => ({ comprovantesSemTransacao: 2 })),
      corrigirDados: f(),
      remover: f(),
    },
  };
}

let s: ReturnType<typeof servicosFalsos>;
beforeEach(() => {
  s = servicosFalsos();
  servicos.atual = s;
  servicos.acesso = {
    enviarLinkMagico: vi.fn(async () => {}),
    sair: vi.fn(async () => {}),
  };
  refresh.mockClear();
});

describe("executarAcao", () => {
  it("ok, ErroDeNegocio com mensagem segura, inesperado sem detalhes e redirect passa direto", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await executarAcao("x", async () => 1)).toEqual({
      ok: true,
      dados: 1,
    });
    expect(
      await executarAcao("x", async () => {
        throw new ErroDeNegocio("limite_excedido", "Muitas tentativas.");
      }),
    ).toEqual({
      ok: false,
      erro: { codigo: "limite_excedido", mensagem: "Muitas tentativas." },
    });
    const inesperado = await executarAcao("x", async () => {
      throw new Error("senha do banco: 123");
    });
    expect(inesperado).toEqual({
      ok: false,
      erro: {
        codigo: "inesperado",
        mensagem: expect.stringContaining("Algo deu errado"),
      },
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("senha");
    await expect(
      executarAcao("x", async () => navegacao.redirect("/entrar")),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("IP: primeiro valor do x-forwarded-for, senão x-real-ip", () => {
    expect(
      ipDaRequisicao(new Headers({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" })),
    ).toBe("1.2.3.4");
    expect(ipDaRequisicao(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe(
      "9.9.9.9",
    );
    expect(ipDaRequisicao(new Headers())).toBeNull();
  });
});

describe("Server Actions", () => {
  it("enviarLinkMagico usa o IP da requisição e responde neutro", async () => {
    expect(await acoes.enviarLinkMagico("davi@hometec.com.br")).toEqual({
      ok: true,
      dados: null,
    });
    expect(
      (servicos.acesso as { enviarLinkMagico: ReturnType<typeof vi.fn> })
        .enviarLinkMagico,
    ).toHaveBeenCalledWith("davi@hometec.com.br", "200.1.2.3");
    expect(await acoes.enviarLinkMagico(42 as unknown as string)).toMatchObject(
      { ok: false, erro: { codigo: "entrada_invalida" } },
    );
  });

  it("sair encerra a sessão e redireciona", async () => {
    await expect(acoes.sair()).rejects.toThrow("NEXT_REDIRECT");
    expect(navegacao.redirect).toHaveBeenCalledWith("/entrar");
  });

  it("sem sessão: toda ação devolve nao_autenticado, sem executar nada", async () => {
    servicos.atual = new ErroDeNegocio(
      "nao_autenticado",
      "Entre para continuar.",
    );
    expect(await acoes.criarRegra({} as never)).toEqual({
      ok: false,
      erro: { codigo: "nao_autenticado", mensagem: "Entre para continuar." },
    });
    expect(await acoes.iniciarConexao()).toMatchObject({
      ok: false,
      erro: { codigo: "nao_autenticado" },
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("cada ação chama o serviço certo com o ctx da sessão e atualiza a tela nas mutações", async () => {
    const id = novoId();
    const chamadas: Array<
      [Promise<unknown>, ReturnType<typeof vi.fn>, unknown[]]
    > = [
      [
        acoes.iniciarConexao({ conexaoIdParaReconectar: id }),
        s.conexoes.iniciarConexao,
        [ctx, { conexaoIdParaReconectar: id }],
      ],
      [acoes.registrarConexao(id), s.conexoes.registrarConexao, [ctx, id]],
      [acoes.sincronizarAgora(id), s.sincronizacao.sincronizarAgora, [ctx, id]],
      [
        acoes.corrigirCategoria(id, {
          categoriaId: null,
          centroDeCustoId: null,
        }),
        s.categorizacao.corrigirCategoria,
        [ctx, id, { categoriaId: null, centroDeCustoId: null }],
      ],
      [
        acoes.criarRegra({ padrao: "x" } as never),
        s.categorizacao.criarRegra,
        [ctx, { padrao: "x" }],
      ],
      [
        acoes.atualizarRegra(id, { ativa: false }),
        s.categorizacao.atualizarRegra,
        [ctx, id, { ativa: false }],
      ],
      [acoes.removerRegra(id), s.categorizacao.removerRegra, [ctx, id]],
      [
        acoes.criarCategoria({ nome: "A", tipo: "saida" }),
        s.categorizacao.criarCategoria,
        [ctx, { nome: "A", tipo: "saida" }],
      ],
      [
        acoes.atualizarCategoria(id, { nome: "B" }),
        s.categorizacao.atualizarCategoria,
        [ctx, id, { nome: "B" }],
      ],
      [
        acoes.criarCentroDeCusto({ nome: "C" }),
        s.centrosDeCusto.criar,
        [ctx, { nome: "C" }],
      ],
      [
        acoes.atualizarCentroDeCusto(id, { arquivado: true }),
        s.centrosDeCusto.atualizar,
        [ctx, id, { arquivado: true }],
      ],
      [acoes.gerarLinkTemporario(id), s.anexos.gerarLinkTemporario, [ctx, id]],
      [acoes.removerAnexo(id), s.anexos.remover, [ctx, id]],
    ];
    for (const [promessa, servico, argumentos] of chamadas) {
      expect(await promessa).toMatchObject({ ok: true });
      expect(servico).toHaveBeenCalledWith(...argumentos);
    }
    expect(refresh).toHaveBeenCalledTimes(11); // iniciarConexao e gerarLinkTemporario não mudam a tela
  });

  it("anexar exige um File no campo 'arquivo'", async () => {
    const formulario = new FormData();
    const id = novoId();
    expect(await acoes.anexar(id, formulario)).toMatchObject({
      ok: false,
      erro: { codigo: "anexo_invalido" },
    });
    const arquivo = new File(["%PDF-"], "n.pdf", { type: "application/pdf" });
    formulario.set("arquivo", arquivo);
    expect(await acoes.anexar(id, formulario)).toMatchObject({ ok: true });
    expect(s.anexos.anexar).toHaveBeenCalledWith(ctx, id, expect.any(File));
    expect(await acoes.anexar(id, "x" as unknown as FormData)).toMatchObject({
      ok: false,
    });
  });
});

describe("leituras para Server Components", () => {
  it("chamam o serviço com o ctx", async () => {
    const periodo = { de: "2026-10-01", ate: "2026-10-09" };
    await leituras.carregarPainel(periodo);
    expect(s.painel.obterResumo).toHaveBeenCalledWith(ctx, periodo);
    await leituras.carregarExtrato({ busca: "posto" });
    expect(s.extrato.listar).toHaveBeenCalledWith(ctx, { busca: "posto" });
    expect(await leituras.carregarTransacao("t")).toEqual({
      transacao: { id: "t" },
      anexos: [],
    });
    expect(await leituras.carregarCategoriasERegras()).toEqual({
      categorias: [],
      regras: [],
      centrosDeCusto: [],
    });
    expect(s.categorizacao.listarCategorias).toHaveBeenCalledWith(ctx, {
      incluirArquivadas: true,
    });
    expect(
      await leituras.carregarCentrosDeCusto({ incluirArquivados: true }),
    ).toEqual([]);
    expect(await leituras.carregarConexoes()).toEqual([]);
  });

  it("sem sessão ou fora da allowlist → /entrar; inexistente → notFound; resto propaga", async () => {
    servicos.atual = new ErroDeNegocio("email_nao_autorizado", "x");
    await expect(leituras.carregarConexoes()).rejects.toThrow("NEXT_REDIRECT");
    expect(navegacao.redirect).toHaveBeenLastCalledWith("/entrar");
    servicos.atual = new Error("banco fora");
    await expect(leituras.carregarConexoes()).rejects.toThrow("banco fora");
    servicos.atual = s;
    s.extrato.obter.mockRejectedValueOnce(
      new ErroDeNegocio("nao_encontrado", "x"),
    );
    await expect(leituras.carregarTransacao("t")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    s.painel.obterResumo.mockRejectedValueOnce(
      new ErroDeNegocio("entrada_invalida", "x"),
    );
    await expect(
      leituras.carregarPainel({ de: "x", ate: "y" }),
    ).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });

  it("recursos (flags) lidos no servidor", async () => {
    vi.stubEnv("RECURSO_ANEXOS", "0");
    vi.stubEnv("PLUGGY_INCLUIR_SANDBOX", "1");
    vi.stubEnv("RECURSO_CATEGORIZACAO_IA", "1");
    vi.stubEnv("RECURSO_OPEN_FINANCE", "0");
    vi.stubEnv("RECURSO_COMPROVANTES_IA", "1");
    expect(await leituras.carregarRecursos()).toEqual({
      anexos: false,
      categorizacaoIa: true,
      incluirSandbox: true,
      openFinance: false,
      comprovantesIa: true,
    });
    vi.unstubAllEnvs();
  });
});

describe("importar extrato e comprovantes (ADR 0016)", () => {
  const ofx = () => new File(["<OFX>"], "extrato.ofx");

  it("importarExtrato e enviarComprovante exigem File em 'arquivo'; a chave do QR é opcional", async () => {
    expect(await acoes.importarExtrato(new FormData())).toMatchObject({
      ok: false,
      erro: { codigo: "arquivo_invalido" },
    });
    expect(
      await acoes.importarExtrato("x" as unknown as FormData),
    ).toMatchObject({ ok: false, erro: { codigo: "arquivo_invalido" } });
    const f = new FormData();
    f.set("arquivo", ofx());
    expect(await acoes.importarExtrato(f)).toMatchObject({ ok: true });
    expect(s.importacao.importar).toHaveBeenCalledWith(ctx, expect.any(File));

    expect(await acoes.enviarComprovante(new FormData())).toMatchObject({
      ok: false,
      erro: { codigo: "arquivo_invalido" },
    });
    const c = new FormData();
    c.set("arquivo", new File([new Uint8Array([0xff, 0xd8, 0xff])], "r.jpg"));
    expect(await acoes.enviarComprovante(c)).toMatchObject({ ok: true });
    expect(s.comprovantes.enviar).toHaveBeenLastCalledWith(
      ctx,
      expect.any(File),
      undefined,
    );
    c.set("chaveDeAcesso", "https://sefaz/qr?p=123|2");
    await acoes.enviarComprovante(c);
    expect(s.comprovantes.enviar).toHaveBeenLastCalledWith(
      ctx,
      expect.any(File),
      { chaveDeAcesso: "https://sefaz/qr?p=123|2" },
    );
  });

  it("conciliar, desfazer, corrigir e remover chamam o serviço com o ctx e atualizam a tela", async () => {
    const id = novoId();
    const t = novoId();
    refresh.mockClear();
    expect(await acoes.conciliarComprovante(id, t)).toMatchObject({ ok: true });
    expect(s.comprovantes.conciliarManualmente).toHaveBeenCalledWith(
      ctx,
      id,
      t,
    );
    expect(await acoes.desfazerConciliacao(id)).toMatchObject({ ok: true });
    expect(s.comprovantes.desfazerConciliacao).toHaveBeenCalledWith(ctx, id);
    expect(
      await acoes.corrigirComprovante(id, { valorCentavos: 100 }),
    ).toMatchObject({ ok: true });
    expect(s.comprovantes.corrigirDados).toHaveBeenCalledWith(ctx, id, {
      valorCentavos: 100,
    });
    expect(await acoes.lerComprovanteDeNovo(id)).toMatchObject({ ok: true });
    expect(s.comprovantes.lerDeNovo).toHaveBeenCalledWith(ctx, id);
    expect(await acoes.removerComprovante(id)).toEqual({
      ok: true,
      dados: null,
    });
    expect(s.comprovantes.remover).toHaveBeenCalledWith(ctx, id);
    expect(refresh).toHaveBeenCalledTimes(5);
  });

  it("leituras: importações, comprovantes com filtro e candidatos", async () => {
    expect(await leituras.carregarImportacoes()).toEqual([]);
    expect(
      await leituras.carregarComprovantes({ situacao: "ambiguo" }),
    ).toEqual([]);
    expect(s.comprovantes.listar).toHaveBeenCalledWith(ctx, {
      situacao: "ambiguo",
    });
    expect(await leituras.carregarCandidatosParaConciliacao("c")).toEqual([]);
    expect(s.comprovantes.listarCandidatos).toHaveBeenCalledWith(ctx, "c");
    expect(await leituras.carregarSituacaoDoExtrato()).toEqual({ ok: "dados" });
    expect(s.importacao.situacao).toHaveBeenCalledWith(ctx);
    expect(await leituras.contarAlertas()).toEqual({
      comprovantesSemTransacao: 2,
    });
    await leituras.carregarComprovantes({ comAlerta: true });
    expect(s.comprovantes.listar).toHaveBeenLastCalledWith(ctx, {
      comAlerta: true,
    });
  });
});
