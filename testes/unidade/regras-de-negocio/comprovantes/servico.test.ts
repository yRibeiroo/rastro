import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ArmazenamentoDeArquivos,
  DadosDoComprovanteNoBanco,
  RepositorioDeComprovantes,
} from "@/acesso-a-dados/contratos";
import {
  criarServicoDeComprovantes,
  ErroDeLeitura,
  type LeitorDeComprovantes,
} from "@/regras-de-negocio/comprovantes";
import {
  alertaDoComprovante,
  contarPaginasDoPdf,
  inicioDoMes,
} from "@/regras-de-negocio/comprovantes/servico";
import type { Anexo, Comprovante, DadosDoComprovante, ImportacaoDeExtrato } from "@/regras-de-negocio/tipos";
import { ctx, EMPRESA, novoId, TransacoesEmMemoria, umaTransacao } from "../falsos";

const CHAVE = "17261008123456000190650010000123451234567899";
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const pdf = (paginas: number) =>
  new TextEncoder().encode(`%PDF-1.7\n${"<< /Type /Page >>\n".repeat(paginas)}<< /Type /Pages >>`);

class ComprovantesEmMemoria implements RepositorioDeComprovantes {
  linhas: Comprovante[] = [];
  async criar(empresaId: string) {
    const c: Comprovante = {
      id: novoId(),
      empresaId,
      transacaoId: null,
      situacao: "lendo",
      tipo: null,
      valorCentavos: null,
      data: null,
      emissor: null,
      documentoEmissor: null,
      chaveDeAcesso: null,
      itens: [],
      confianca: null,
      erro: null,
      camposCorrigidos: [],
      alerta: null,
      criadoEm: new Date("2026-10-01T15:00:00Z"),
      atualizadoEm: new Date(),
    };
    this.linhas.push(c);
    return { ...c };
  }
  async buscarPorId(empresaId: string, id: string) {
    const c = this.linhas.find((x) => x.empresaId === empresaId && x.id === id);
    return c ? { ...c } : null;
  }
  async buscarPorChave(empresaId: string, chave: string) {
    const c = this.linhas.find((x) => x.empresaId === empresaId && x.chaveDeAcesso === chave);
    return c ? { ...c } : null;
  }
  contarLeiturasDesde = vi.fn(async () => 0);
  leituras: string[] = [];
  registrarLeitura = vi.fn(async (_e: string, id: string) => {
    this.leituras.push(id);
  });
  async empresasComPendentes() {
    return [...new Set(this.linhas.filter((c) => c.situacao === "pendente").map((c) => c.empresaId))];
  }
  async listarTransacoesConciliadas(empresaId: string, ids: readonly string[]) {
    return this.linhas.flatMap((c) => (c.empresaId === empresaId && c.transacaoId && ids.includes(c.transacaoId) ? [c.transacaoId] : []));
  }
  async listar(empresaId: string, f?: { situacao?: string }) {
    return this.linhas.filter((c) => c.empresaId === empresaId && (!f?.situacao || c.situacao === f.situacao));
  }
  atualizar = vi.fn(async (_e: string, id: string, dados: DadosDoComprovanteNoBanco) => {
    const c = this.linhas.find((x) => x.id === id)!;
    Object.assign(c, dados);
    return { ...c };
  });
  remover = vi.fn(async (_e: string, id: string) => {
    this.linhas = this.linhas.filter((c) => c.id !== id);
  });
}

const dadosLidos = (p: Partial<DadosDoComprovante> = {}): DadosDoComprovante => ({
  tipo: "pix",
  valorCentavos: 25090,
  data: "2026-10-08",
  emissor: "Posto Ipiranga Palmas",
  documentoEmissor: null,
  chaveDeAcesso: null,
  itens: [{ descricao: "Gasolina", quantidade: 1, valorCentavos: 25090 }],
  confianca: 0.9,
  ...p,
});

function montar(opcoes: { ligado?: boolean; limite?: number } = {}) {
  const comprovantes = new ComprovantesEmMemoria();
  const anexos: Anexo[] = [];
  const repoAnexos = {
    criar: vi.fn(async (empresaId: string, dados: Omit<Anexo, "id" | "empresaId" | "criadoEm">) => {
      const a = { id: novoId(), empresaId, criadoEm: new Date(), ...dados };
      anexos.push(a);
      return a;
    }),
    buscarPorComprovante: vi.fn(async (_e: string, id: string) => anexos.find((a) => a.comprovanteId === id) ?? null),
  };
  const armazenamento = {
    enviar: vi.fn(async () => {}),
    baixar: vi.fn(async () => JPG),
    gerarUrlAssinada: vi.fn(async () => "u"),
    remover: vi.fn(async () => {}),
  } satisfies ArmazenamentoDeArquivos;
  const transacao = umaTransacao({ data: "2026-10-09", valorCentavos: -25090, descricao: "PIX ENVIADO", contraparte: "POSTO IPIRANGA" });
  const transacoes = new TransacoesEmMemoria([transacao]);
  const leitor = { ler: vi.fn<LeitorDeComprovantes["ler"]>(async () => dadosLidos()) };
  const categorizacao = { categorizarComDica: vi.fn(async () => true) };
  const importacoes: ImportacaoDeExtrato[] = [];
  const consumirLimite = vi.fn(async () => true);
  const servico = criarServicoDeComprovantes({
    leitor,
    comprovantes,
    anexos: repoAnexos,
    importacoes: { listar: vi.fn(async () => importacoes) },
    armazenamento,
    transacoes,
    categorizacao,
    consumirLimite,
    ligado: () => opcoes.ligado ?? true,
    limiteMensal: () => opcoes.limite ?? 300,
    agora: () => new Date("2026-10-10T12:00:00Z"),
  });
  return { servico, comprovantes, anexos, repoAnexos, armazenamento, transacoes, transacao, leitor, categorizacao, consumirLimite, importacoes };
}

const foto = (conteudo: Uint8Array = JPG, tipo = "image/jpeg", nome = "recibo.jpg") => new File([conteudo as BlobPart], nome, { type: tipo });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ServicoDeComprovantes.enviar", () => {
  it("salva o arquivo no caminho do comprovante, lê, concilia e sugere a categoria pelos itens", async () => {
    const m = montar();
    const c = await m.servico.enviar(ctx, foto());
    expect(c).toMatchObject({ situacao: "conciliado", transacaoId: m.transacao.id, valorCentavos: 25090, erro: null });
    expect(m.anexos).toEqual([
      expect.objectContaining({
        transacaoId: null,
        comprovanteId: c.id,
        caminho: expect.stringMatching(new RegExp(`^${EMPRESA}/comprovantes/${c.id}/[0-9a-f-]{36}\\.jpg$`)),
        nomeArquivo: "recibo.jpg",
        tipoMime: "image/jpeg",
      }),
    ]);
    expect(m.leitor.ler).toHaveBeenCalledWith({ bytes: expect.any(Uint8Array), tipoMime: "image/jpeg" }, undefined);
    expect(m.categorizacao.categorizarComDica).toHaveBeenCalledWith(EMPRESA, m.transacao.id, "Posto Ipiranga Palmas | Gasolina");
    expect(m.consumirLimite).toHaveBeenCalledWith(`comprovante:usuario:${ctx.usuarioId}`, { maximo: 30, janelaEmSegundos: 3600 });
  });

  it("sem transação no prazo → pendente; a chave do QR vai como dica e prevalece", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ valorCentavos: 999, chaveDeAcesso: null }));
    const c = await m.servico.enviar(ctx, foto(), { chaveDeAcesso: `https://sefaz.to.gov.br/nfce?p=${CHAVE}|2|1` });
    expect(c).toMatchObject({ situacao: "pendente", chaveDeAcesso: CHAVE });
    expect(m.leitor.ler).toHaveBeenCalledWith(expect.anything(), { chaveDeAcesso: CHAVE });
    expect(m.categorizacao.categorizarComDica).not.toHaveBeenCalled();
  });

  it("dois candidatos sem desempate → ambíguo; transação já conciliada não é candidata", async () => {
    const m = montar();
    m.transacoes.linhas.push(umaTransacao({ data: "2026-10-07", valorCentavos: -25090, descricao: "PIX", contraparte: "POSTO IPIRANGA" }));
    expect((await m.servico.enviar(ctx, foto())).situacao).toBe("ambiguo");
    const n = montar();
    const primeiro = await n.servico.enviar(ctx, foto());
    expect(primeiro.situacao).toBe("conciliado");
    expect((await n.servico.enviar(ctx, foto())).situacao).toBe("pendente");
  });

  it("chave duplicada (do QR antes de ler, ou lida pela IA) → comprovante_duplicado com a data, sem órfão", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValue(dadosLidos({ chaveDeAcesso: CHAVE, valorCentavos: 1 }));
    await m.servico.enviar(ctx, foto());
    await expect(m.servico.enviar(ctx, foto())).rejects.toMatchObject({
      codigo: "comprovante_duplicado",
      mensagemParaUsuario: "Esta nota já foi enviada em 01/10/2026.",
    });
    expect(m.comprovantes.linhas).toHaveLength(1);
    expect(m.armazenamento.remover).toHaveBeenCalledTimes(1);
    m.leitor.ler.mockClear();
    await expect(m.servico.enviar(ctx, foto(), { chaveDeAcesso: CHAVE })).rejects.toMatchObject({ codigo: "comprovante_duplicado" });
    expect(m.leitor.ler).not.toHaveBeenCalled();
  });

  it("falha da IA → erro_de_leitura com o motivo, arquivo mantido", async () => {
    const m = montar();
    m.leitor.ler.mockRejectedValueOnce(new ErroDeLeitura("recusa"));
    expect(await m.servico.enviar(ctx, foto())).toMatchObject({ situacao: "erro_de_leitura", erro: "recusa" });
    m.leitor.ler.mockRejectedValueOnce(new Error("timeout"));
    expect(await m.servico.enviar(ctx, foto())).toMatchObject({ situacao: "erro_de_leitura", erro: "falha_na_leitura" });
    expect(m.armazenamento.remover).not.toHaveBeenCalled();
    expect(m.anexos).toHaveLength(2);
  });

  it("RNF-26: teto mensal atingido → erro_de_leitura 'limite' sem chamar a IA", async () => {
    const m = montar({ limite: 2 });
    m.comprovantes.contarLeiturasDesde.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect((await m.servico.enviar(ctx, foto())).situacao).toBe("conciliado");
    expect(await m.servico.enviar(ctx, foto())).toMatchObject({ situacao: "erro_de_leitura", erro: "limite" });
    expect(m.leitor.ler).toHaveBeenCalledTimes(1);
    expect(m.comprovantes.contarLeiturasDesde).toHaveBeenCalledWith(EMPRESA, new Date("2026-10-01T03:00:00Z"));
    expect(inicioDoMes(new Date("2026-11-01T02:59:00Z"))).toEqual(new Date("2026-10-01T03:00:00Z")); // ainda outubro em Araguaína
  });

  it("recusa: flag desligada, tamanho, tipo pelos bytes, PDF com mais de 5 páginas e limite", async () => {
    await expect(montar({ ligado: false }).servico.enviar(ctx, foto())).rejects.toMatchObject({ codigo: "recurso_desligado" });
    const m = montar();
    const casos = [
      "x" as unknown as File,
      foto(new Uint8Array()),
      foto(new Uint8Array(4 * 1024 * 1024 + 1)),
      foto(new TextEncoder().encode("MZ executável"), "", "foto.jpg"),
      foto(JPG, "application/pdf"),
    ];
    for (const a of casos) await expect(m.servico.enviar(ctx, a)).rejects.toMatchObject({ codigo: "arquivo_invalido" });
    await expect(m.servico.enviar(ctx, foto(pdf(6), "application/pdf", "n.pdf"))).rejects.toMatchObject({
      mensagemParaUsuario: expect.stringContaining("mais de 5 páginas"),
    });
    expect(contarPaginasDoPdf(pdf(5))).toBe(5);
    expect((await m.servico.enviar(ctx, foto(pdf(5), "application/pdf", "n.pdf"))).situacao).toBe("conciliado");
    m.consumirLimite.mockResolvedValue(false);
    await expect(m.servico.enviar(ctx, foto())).rejects.toMatchObject({ codigo: "limite_excedido" });
    expect(m.comprovantes.linhas).toHaveLength(1);
  });

  it("falha no Storage ou na linha do anexo desfaz o comprovante (sem órfão)", async () => {
    const m = montar();
    m.armazenamento.enviar.mockRejectedValueOnce(new Error("storage"));
    await expect(m.servico.enviar(ctx, foto())).rejects.toThrow("storage");
    m.repoAnexos.criar.mockRejectedValueOnce(new Error("db"));
    await expect(m.servico.enviar(ctx, foto())).rejects.toThrow("db");
    expect(m.comprovantes.linhas).toHaveLength(0);
    expect(m.armazenamento.remover).toHaveBeenCalledTimes(1);
  });
});

describe("ServicoDeComprovantes: conciliação manual, correção, reconciliação e remoção", () => {
  it("conciliar manualmente, desfazer, candidatos e transação de outra empresa", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ valorCentavos: 999 }));
    const c = await m.servico.enviar(ctx, foto());
    expect(await m.servico.listarCandidatos(ctx, c.id)).toEqual([]);
    await expect(m.servico.conciliarManualmente(ctx, c.id, novoId())).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(m.servico.conciliarManualmente(ctx, c.id, "x")).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(m.servico.conciliarManualmente(ctx, novoId(), m.transacao.id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    const conciliado = await m.servico.conciliarManualmente(ctx, c.id, m.transacao.id);
    expect(conciliado).toMatchObject({ situacao: "conciliado", transacaoId: m.transacao.id });
    expect(m.categorizacao.categorizarComDica).toHaveBeenCalled();
    expect(await m.servico.desfazerConciliacao(ctx, c.id)).toMatchObject({ situacao: "pendente", transacaoId: null });
    expect((await m.servico.desfazerConciliacao(ctx, c.id)).situacao).toBe("pendente");
    // ±10 dias para a escolha manual
    await m.servico.corrigirDados(ctx, c.id, { valorCentavos: 50000 });
    m.transacoes.linhas.push(umaTransacao({ data: "2026-10-17", valorCentavos: -50000 }));
    expect(await m.servico.listarCandidatos(ctx, c.id)).toHaveLength(1);
  });

  it("corrigir o valor concilia; chave já usada → duplicado; dados inválidos → entrada_invalida", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ valorCentavos: 2509 })).mockResolvedValueOnce(dadosLidos({ valorCentavos: 1, chaveDeAcesso: CHAVE }));
    const c = await m.servico.enviar(ctx, foto());
    await m.servico.enviar(ctx, foto());
    expect(await m.servico.corrigirDados(ctx, c.id, { valorCentavos: 25090, documentoEmissor: "123.456.789-01" })).toMatchObject({
      situacao: "conciliado",
      documentoEmissor: "12345678901",
    });
    await expect(m.servico.corrigirDados(ctx, c.id, { chaveDeAcesso: CHAVE })).rejects.toMatchObject({ codigo: "comprovante_duplicado" });
    for (const dados of [{ valorCentavos: 0 }, { valorCentavos: -5 }, { data: "2026-02-30" }, { chaveDeAcesso: "123" }, { tipo: "cheque" }])
      await expect(m.servico.corrigirDados(ctx, c.id, dados as never)).rejects.toMatchObject({ codigo: "entrada_invalida" });
    // conciliado fica conciliado ao corrigir outro campo
    expect((await m.servico.corrigirDados(ctx, c.id, { emissor: "  " })).situacao).toBe("conciliado");
  });

  it("erro de leitura corrigido à mão vira pendente e tenta conciliar", async () => {
    const m = montar();
    m.leitor.ler.mockRejectedValueOnce(new ErroDeLeitura("ilegivel"));
    const c = await m.servico.enviar(ctx, foto());
    expect(await m.servico.corrigirDados(ctx, c.id, { data: "2026-10-08" })).toMatchObject({ situacao: "erro_de_leitura" });
    expect(await m.servico.corrigirDados(ctx, c.id, { valorCentavos: 25090 })).toMatchObject({
      situacao: "conciliado",
      tipo: "outro",
      erro: null,
    });
  });

  it("reconciliarPendentes concila os que ganharam transação e não para em falha", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValue(dadosLidos({ valorCentavos: 7000 }));
    await m.servico.enviar(ctx, foto());
    await m.servico.enviar(ctx, foto());
    expect(await m.servico.reconciliarPendentes(EMPRESA)).toBe(0);
    m.transacoes.linhas.push(umaTransacao({ data: "2026-10-08", valorCentavos: -7000 }));
    m.transacoes.candidatosParaConciliacao.mockRejectedValueOnce(new Error("db"));
    expect(await m.servico.reconciliarPendentes(EMPRESA)).toBe(1);
  });

  it("lista com filtro validado e remove linha + arquivo (falha no Storage só registra)", async () => {
    const m = montar();
    const c = await m.servico.enviar(ctx, foto());
    expect(await m.servico.listar(ctx, { situacao: "conciliado" })).toHaveLength(1);
    expect(await m.servico.listar(ctx)).toHaveLength(1);
    await expect(m.servico.listar(ctx, { situacao: "x" as never })).rejects.toMatchObject({ codigo: "entrada_invalida" });
    m.armazenamento.remover.mockRejectedValueOnce(new Error("storage"));
    await m.servico.remover(ctx, c.id);
    expect(m.comprovantes.linhas).toHaveLength(0);
    expect(m.armazenamento.remover).toHaveBeenCalledWith([m.anexos[0].caminho]);
    await expect(m.servico.remover(ctx, c.id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("falha na sugestão de categoria não quebra a conciliação; sem emissor nem itens não sugere", async () => {
    const m = montar();
    m.categorizacao.categorizarComDica.mockRejectedValueOnce(new Error("ia"));
    expect((await m.servico.enviar(ctx, foto())).situacao).toBe("conciliado");
    const n = montar();
    n.leitor.ler.mockResolvedValueOnce(dadosLidos({ emissor: null, itens: [] }));
    expect((await n.servico.enviar(ctx, foto())).situacao).toBe("conciliado");
    expect(n.categorizacao.categorizarComDica).not.toHaveBeenCalled();
  });
});

describe("RF-42: alerta 'sem transação no extrato'", () => {
  const importacao = (ate: string, criadaEm: string) => ({ periodo: { de: "2026-09-01", ate }, criadaEm: new Date(criadaEm) });
  const pendente = { situacao: "pendente" as const, data: "2026-10-01" };

  it.each([
    ["15/10: 10 dias depois da importação → sem alerta", "2026-10-15T20:00:00-03:00", null],
    ["16/10: 11 dias → alerta", "2026-10-16T08:00:00-03:00", "sem_transacao_no_extrato"],
  ])("%s", (_n, agora, esperado) => {
    expect(alertaDoComprovante(pendente, [importacao("2026-10-05", "2026-10-05T10:00:00-03:00")], new Date(agora))).toBe(esperado);
  });

  it("sem importação que cubra a data, sem data ou não pendente → sem alerta; vale a primeira que cobriu", () => {
    const tarde = new Date("2026-12-01T12:00:00Z");
    expect(alertaDoComprovante(pendente, [importacao("2026-09-30", "2026-10-01T10:00:00-03:00")], tarde)).toBeNull();
    expect(alertaDoComprovante({ ...pendente, data: null }, [importacao("2026-10-05", "2026-10-05T10:00:00-03:00")], tarde)).toBeNull();
    expect(alertaDoComprovante({ ...pendente, situacao: "ambiguo" }, [importacao("2026-10-05", "2026-10-05T10:00:00-03:00")], tarde)).toBeNull();
    const varias = [importacao("2026-10-31", "2026-11-25T10:00:00-03:00"), importacao("2026-10-05", "2026-10-05T10:00:00-03:00")];
    expect(alertaDoComprovante(pendente, varias, new Date("2026-11-30T12:00:00Z"))).toBe("sem_transacao_no_extrato");
  });

  it("listar marca o alerta, filtra só os alertados e contarAlertas conta", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValue(dadosLidos({ valorCentavos: 1, data: "2026-09-20" }));
    await m.servico.enviar(ctx, foto());
    await m.servico.enviar(ctx, foto());
    expect((await m.servico.listar(ctx)).map((c) => c.alerta)).toEqual([null, null]);
    m.importacoes.push({ id: novoId(), empresaId: EMPRESA, conexaoId: novoId(), contaId: novoId(), nomeDoArquivo: "x.ofx", periodo: { de: "2026-09-01", ate: "2026-09-25" }, novas: 0, atualizadas: 0, criadaEm: new Date("2026-09-26T12:00:00Z") });
    expect((await m.servico.listar(ctx)).map((c) => c.alerta)).toEqual(["sem_transacao_no_extrato", "sem_transacao_no_extrato"]);
    expect(await m.servico.listar(ctx, { comAlerta: true })).toHaveLength(2);
    expect(await m.servico.listar(ctx, { situacao: "conciliado", comAlerta: true })).toHaveLength(0);
    expect(await m.servico.contarAlertas(ctx)).toEqual({ comprovantesSemTransacao: 2 });
  });
});

describe("RF-41: tentar ler de novo e campos corrigidos", () => {
  it("cada leitura é registrada para o teto; a releitura não sobrescreve o que o usuário corrigiu", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ valorCentavos: 999, emissor: "Lido errado" }));
    const c = await m.servico.enviar(ctx, foto());
    expect(m.comprovantes.leituras).toEqual([c.id]);
    const corrigido = await m.servico.corrigirDados(ctx, c.id, { emissor: "Posto Certo" });
    expect(corrigido.camposCorrigidos).toEqual(["emissor"]);
    expect((await m.servico.corrigirDados(ctx, c.id, { emissor: "Posto Certo", data: "2026-10-08" })).camposCorrigidos).toEqual(["emissor", "data"]);

    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ emissor: "IA de novo", data: "2026-01-01", valorCentavos: 25090 }));
    const relido = await m.servico.lerDeNovo(ctx, c.id);
    expect(relido).toMatchObject({ emissor: "Posto Certo", data: "2026-10-08", valorCentavos: 25090, situacao: "conciliado" });
    expect(m.armazenamento.baixar).toHaveBeenCalledWith(m.anexos[0].caminho);
    expect(m.leitor.ler).toHaveBeenLastCalledWith({ bytes: JPG, tipoMime: "image/jpeg" }, undefined);
    expect(m.comprovantes.leituras).toEqual([c.id, c.id]);
    expect(m.consumirLimite).toHaveBeenCalledTimes(2);
  });

  it("falha na releitura: conciliado continua conciliado; erro de leitura continua com o motivo", async () => {
    const m = montar();
    const c = await m.servico.enviar(ctx, foto());
    m.leitor.ler.mockRejectedValueOnce(new ErroDeLeitura("indisponivel"));
    expect(await m.servico.lerDeNovo(ctx, c.id)).toMatchObject({ situacao: "conciliado", erro: "indisponivel" });
    m.leitor.ler.mockRejectedValueOnce(new ErroDeLeitura("ilegivel"));
    const e = await m.servico.enviar(ctx, foto());
    m.leitor.ler.mockRejectedValueOnce(new Error("timeout"));
    expect(await m.servico.lerDeNovo(ctx, e.id)).toMatchObject({ situacao: "erro_de_leitura", erro: "falha_na_leitura" });
    // Agora lê: sai do erro e concilia (a transação já tem outro comprovante → pendente).
    expect(await m.servico.lerDeNovo(ctx, e.id)).toMatchObject({ situacao: "pendente", erro: null });
  });

  it("chave relida que já é de outro comprovante é ignorada (mantém a atual); a chave atual vai como dica", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ chaveDeAcesso: CHAVE, valorCentavos: 1 }));
    await m.servico.enviar(ctx, foto());
    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ valorCentavos: 2 }));
    const outro = await m.servico.enviar(ctx, foto());
    m.leitor.ler.mockResolvedValueOnce(dadosLidos({ valorCentavos: 2, chaveDeAcesso: CHAVE }));
    expect((await m.servico.lerDeNovo(ctx, outro.id)).chaveDeAcesso).toBeNull();
  });

  it("recusa: desligado, teto mensal, rate limit, sem arquivo e comprovante de outra empresa", async () => {
    const m = montar();
    const c = await m.servico.enviar(ctx, foto());
    await expect(m.servico.lerDeNovo(ctx, novoId())).rejects.toMatchObject({ codigo: "nao_encontrado" });
    m.comprovantes.contarLeiturasDesde.mockResolvedValueOnce(300);
    await expect(m.servico.lerDeNovo(ctx, c.id)).rejects.toMatchObject({
      codigo: "limite_excedido",
      mensagemParaUsuario: expect.stringContaining("Limite mensal de leituras atingido"),
    });
    m.repoAnexos.buscarPorComprovante.mockResolvedValueOnce(null);
    await expect(m.servico.lerDeNovo(ctx, c.id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    m.consumirLimite.mockResolvedValueOnce(false);
    await expect(m.servico.lerDeNovo(ctx, c.id)).rejects.toMatchObject({ codigo: "limite_excedido" });
    const d = montar({ ligado: false });
    d.comprovantes.linhas.push({ ...c });
    await expect(d.servico.lerDeNovo(ctx, c.id)).rejects.toMatchObject({ codigo: "recurso_desligado" });
  });
});

describe("reconciliarTodas (cron)", () => {
  it("passa por todas as empresas com pendentes e não para em falha", async () => {
    const m = montar();
    m.leitor.ler.mockResolvedValue(dadosLidos({ valorCentavos: 7000 }));
    await m.servico.enviar(ctx, foto());
    m.transacoes.linhas.push(umaTransacao({ data: "2026-10-08", valorCentavos: -7000 }));
    expect(await m.servico.reconciliarTodas()).toEqual({ empresas: 1, conciliados: 1 });
    expect(await m.servico.reconciliarTodas()).toEqual({ empresas: 0, conciliados: 0 });
    await m.servico.enviar(ctx, foto());
    m.comprovantes.listar = async () => {
      throw new Error("db");
    };
    expect(await m.servico.reconciliarTodas()).toEqual({ empresas: 1, conciliados: 0 });
  });
});
