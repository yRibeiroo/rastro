import { describe, expect, it, vi } from "vitest";
import type {
  ArmazenamentoDeArquivos,
  RepositorioDeAnexos,
} from "@/acesso-a-dados/contratos";
import { criarServicoDeAnexos } from "@/regras-de-negocio/anexos";
import { detectarTipo, limparNomeDoArquivo } from "@/regras-de-negocio/anexos/servico";
import { criarServicoDeCentrosDeCusto } from "@/regras-de-negocio/centros-de-custo";
import { criarServicoDoPainel } from "@/regras-de-negocio/painel";
import type { Anexo } from "@/regras-de-negocio/tipos";
import {
  CentrosEmMemoria,
  ContasEmMemoria,
  ctx,
  EMPRESA,
  novoId,
  TransacoesEmMemoria,
  umaTransacao,
} from "./falsos";

describe("ServicoDeCentrosDeCusto", () => {
  it("lista, cria e atualiza com validação", async () => {
    const centrosDeCusto = new CentrosEmMemoria([
      { id: novoId(), empresaId: EMPRESA, nome: "Elétrica", padrao: true, arquivado: false },
      { id: novoId(), empresaId: EMPRESA, nome: "Antigo", padrao: false, arquivado: true },
    ]);
    const servico = criarServicoDeCentrosDeCusto({ centrosDeCusto });
    expect(await servico.listar(ctx)).toHaveLength(1);
    expect(await servico.listar(ctx, { incluirArquivados: true })).toHaveLength(2);
    await servico.criar(ctx, { nome: "  Solar " });
    expect(centrosDeCusto.criar).toHaveBeenCalledWith(EMPRESA, { nome: "Solar" });
    await expect(servico.criar(ctx, { nome: "" })).rejects.toMatchObject({ codigo: "entrada_invalida" });
    const id = novoId();
    await servico.atualizar(ctx, id, { arquivado: true });
    expect(centrosDeCusto.atualizar).toHaveBeenCalledWith(EMPRESA, id, { arquivado: true });
    await expect(servico.atualizar(ctx, "x", {})).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(servico.atualizar(ctx, id, { nome: "x".repeat(61) })).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });
});

describe("ServicoDoPainel", () => {
  function montar() {
    const painel = {
      fluxoMensal: vi.fn(async () => [{ mes: "2026-10", entradasCentavos: 180000, saidasCentavos: 31080, resultadoCentavos: 148920 }]),
      gastosPorCategoria: vi.fn(async () => [{ categoriaId: null, nome: "Sem categoria", totalCentavos: 31080, quantidade: 2 }]),
      resultadoPorCentroDeCusto: vi.fn(async () => []),
    };
    const contas = new ContasEmMemoria();
    const transacoes = new TransacoesEmMemoria();
    return { painel, contas, transacoes, servico: criarServicoDoPainel({ painel, contas, transacoes }) };
  }

  it("junta agregações, saldo e quantidade sem categoria no período", async () => {
    const { servico, painel, transacoes } = montar();
    const periodo = { de: "2025-11-01", ate: "2026-10-09" };
    const r = await servico.obterResumo(ctx, periodo);
    expect(r).toMatchObject({
      periodo,
      saldoAtualCentavos: 1523456,
      saldoAtualizadoEm: new Date("2026-10-09T11:00:00Z"),
      transacoesSemCategoria: 3,
      fluxoMensal: [{ mes: "2026-10", resultadoCentavos: 148920 }],
    });
    expect(painel.fluxoMensal).toHaveBeenCalledWith(EMPRESA, periodo);
    expect(transacoes.contarSemCategoria).toHaveBeenCalledWith(EMPRESA, periodo);
  });

  it.each([
    { de: "2026-10-09", ate: "2026-10-01" },
    { de: "2024-01-01", ate: "2026-02-01" },
    { de: "2026-1-1", ate: "2026-10-01" },
  ])("período inválido %o → entrada_invalida", async (periodo) => {
    await expect(montar().servico.obterResumo(ctx, periodo)).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });
});

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

describe("ServicoDeAnexos", () => {
  function montar(opcoes: { ligados?: boolean } = {}) {
    const transacao = umaTransacao();
    const linhas: Anexo[] = [];
    const anexos = {
      criar: vi.fn(async (empresaId: string, dados: Omit<Anexo, "id" | "empresaId" | "criadoEm">) => {
        const anexo = { id: novoId(), empresaId, criadoEm: new Date(), ...dados };
        linhas.push(anexo);
        return anexo;
      }),
      listar: vi.fn(async () => linhas),
      buscarPorId: vi.fn(async (_e: string, id: string) => linhas.find((a) => a.id === id) ?? null),
      remover: vi.fn(async () => {}),
    } satisfies RepositorioDeAnexos;
    const armazenamento = {
      enviar: vi.fn(async () => {}),
      gerarUrlAssinada: vi.fn(async (caminho: string) => `https://sb.local/assinada/${caminho}?token=t`),
      remover: vi.fn(async () => {}),
    } satisfies ArmazenamentoDeArquivos;
    const consumirLimite = vi.fn(async () => true);
    const servico = criarServicoDeAnexos({
      anexos,
      armazenamento,
      transacoes: new TransacoesEmMemoria([transacao]),
      consumirLimite,
      anexosLigados: () => opcoes.ligados ?? true,
      agora: () => new Date("2026-10-09T12:00:00Z"),
    });
    return { servico, anexos, armazenamento, consumirLimite, transacao };
  }

  it("detecta o tipo pelos bytes e limpa o nome", () => {
    expect(detectarTipo(PDF)).toBe("application/pdf");
    expect(detectarTipo(PNG)).toBe("image/png");
    expect(detectarTipo(JPG)).toBe("image/jpeg");
    expect(detectarTipo(WEBP)).toBe("image/webp");
    expect(detectarTipo(new TextEncoder().encode("<script>"))).toBeNull();
    expect(limparNomeDoArquivo("../../etc/nota\u0000.pdf", "application/pdf")).toBe("nota.pdf");
    expect(limparNomeDoArquivo("C:\\fotos\\recibo.png", "image/png")).toBe("recibo.png");
    expect(limparNomeDoArquivo("", "image/jpeg")).toBe("anexo.jpg");
  });

  it("anexa: caminho {empresa}/{transação}/{uuid}.ext, tipo real e rate limit 30/h", async () => {
    const { servico, armazenamento, consumirLimite, transacao } = montar();
    const anexo = await servico.anexar(ctx, transacao.id, new File([PDF], "nota.pdf", { type: "application/pdf" }));
    expect(anexo.caminho).toMatch(new RegExp(`^${EMPRESA}/${transacao.id}/[0-9a-f-]{36}\\.pdf$`));
    expect(anexo).toMatchObject({ nomeArquivo: "nota.pdf", tipoMime: "application/pdf", tamanhoBytes: PDF.length });
    expect(armazenamento.enviar).toHaveBeenCalledWith(anexo.caminho, expect.any(File), "application/pdf");
    expect(consumirLimite).toHaveBeenCalledWith(`anexo:usuario:${ctx.usuarioId}`, { maximo: 30, janelaEmSegundos: 3600 });
    // MIME declarado vazio vale: o tipo vem dos bytes
    const semTipo = await servico.anexar(ctx, transacao.id, new File([PNG], "foto"));
    expect(semTipo.tipoMime).toBe("image/png");
  });

  it("recusa conteúdo que não bate com o MIME, tipo não aceito, vazio ou > 10 MB", async () => {
    const { servico, transacao } = montar();
    const casos = [
      new File([new TextEncoder().encode("<html>")], "x.pdf", { type: "application/pdf" }),
      new File([PNG], "x.pdf", { type: "application/pdf" }),
      new File([], "vazio.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf", { type: "application/pdf" }),
    ];
    for (const arquivo of casos)
      await expect(servico.anexar(ctx, transacao.id, arquivo)).rejects.toMatchObject({ codigo: "anexo_invalido" });
    await expect(servico.anexar(ctx, transacao.id, "texto" as unknown as File)).rejects.toMatchObject({ codigo: "anexo_invalido" });
  });

  it("flag desligada, transação de outra empresa e limite estourado", async () => {
    const arquivo = new File([PDF], "nota.pdf", { type: "application/pdf" });
    const desligado = montar({ ligados: false });
    await expect(desligado.servico.anexar(ctx, desligado.transacao.id, arquivo)).rejects.toMatchObject({ codigo: "recurso_desligado" });
    const m = montar();
    await expect(m.servico.anexar(ctx, novoId(), arquivo)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(m.servico.anexar(ctx, "x", arquivo)).rejects.toMatchObject({ codigo: "nao_encontrado" });
    m.consumirLimite.mockResolvedValue(false);
    await expect(m.servico.anexar(ctx, m.transacao.id, arquivo)).rejects.toMatchObject({ codigo: "limite_excedido" });
  });

  it("se gravar a linha falhar, remove o arquivo enviado (sem órfão)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { servico, anexos, armazenamento, transacao } = montar();
    anexos.criar.mockRejectedValueOnce(new Error("db"));
    armazenamento.remover.mockRejectedValueOnce(new Error("storage"));
    await expect(servico.anexar(ctx, transacao.id, new File([PDF], "n.pdf"))).rejects.toThrow("db");
    expect(armazenamento.remover).toHaveBeenCalledWith([expect.stringMatching(/\.pdf$/)]);
  });

  it("lista, gera link de 60 s e remove", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { servico, armazenamento, anexos, transacao } = montar();
    const anexo = await servico.anexar(ctx, transacao.id, new File([JPG], "recibo.jpg", { type: "image/jpeg" }));
    expect(await servico.listar(ctx, transacao.id)).toHaveLength(1);
    await expect(servico.listar(ctx, novoId())).rejects.toMatchObject({ codigo: "nao_encontrado" });
    const link = await servico.gerarLinkTemporario(ctx, anexo.id);
    expect(link.expiraEm).toEqual(new Date("2026-10-09T12:01:00Z"));
    expect(armazenamento.gerarUrlAssinada).toHaveBeenCalledWith(anexo.caminho, 60);
    await expect(servico.gerarLinkTemporario(ctx, novoId())).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(servico.gerarLinkTemporario(ctx, "x")).rejects.toMatchObject({ codigo: "nao_encontrado" });
    armazenamento.remover.mockRejectedValueOnce(new Error("storage"));
    await servico.remover(ctx, anexo.id);
    expect(anexos.remover).toHaveBeenCalledWith(EMPRESA, anexo.id);
    expect(armazenamento.remover).toHaveBeenCalledWith([anexo.caminho]);
  });
});
