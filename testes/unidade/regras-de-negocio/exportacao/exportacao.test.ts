import { describe, expect, it, vi } from "vitest";
import {
  celulaDeTexto,
  celulaDeValor,
  criarServicoDeExportacao,
  LIMITE_DE_LINHAS,
  montarCsv,
} from "@/regras-de-negocio/exportacao";
import type { PaginaDoExtrato } from "@/regras-de-negocio/extrato";
import { ctx, novoId, umaTransacao } from "../falsos";

describe("células do CSV", () => {
  it("texto: neutraliza fórmulas e escapa separador, aspas e quebras de linha", () => {
    expect(celulaDeTexto('=HYPERLINK("http://x")')).toBe(
      `"'=HYPERLINK(""http://x"")"`,
    );
    for (const perigoso of ["+1", "-1", "@SOMA(A1)", "\tx"])
      expect(celulaDeTexto(perigoso).startsWith("'")).toBe(true);
    expect(celulaDeTexto("Padaria; Café")).toBe('"Padaria; Café"');
    expect(celulaDeTexto("linha 1\nlinha 2")).toBe("linha 1 linha 2");
    expect(celulaDeTexto(null)).toBe("");
  });

  it("valor: vírgula decimal, sem milhar, com sinal", () => {
    expect(celulaDeValor(-123456)).toBe("-1234,56");
    expect(celulaDeValor(5)).toBe("0,05");
    expect(celulaDeValor(0)).toBe("0,00");
  });
});

describe("montarCsv", () => {
  it("BOM, cabeçalho, data BR, nomes resolvidos e CRLF", () => {
    const categoria = novoId();
    const t = umaTransacao({
      data: "2026-11-02",
      descricao: "IFOOD",
      valorCentavos: -3590,
      categoriaId: categoria,
      oculta: true,
    });
    const csv = montarCsv([t], {
      categorias: new Map([[categoria, "Restaurantes"]]),
      centros: new Map(),
      contas: new Map([[t.contaId, "Nubank"]]),
    });
    expect(csv.startsWith("﻿Data;Descrição;Valor;")).toBe(true);
    expect(csv.split("\r\n")[1]).toBe(
      "02/11/2026;IFOOD;-35,90;Restaurantes;;Nubank;;;sim;não",
    );
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("ServicoDeExportacao", () => {
  const nomes = async () => ({
    categorias: new Map(),
    centros: new Map(),
    contas: new Map(),
  });

  function paginas(total: number) {
    const todas = Array.from({ length: total }, () => umaTransacao());
    return vi.fn(
      async (
        _c: unknown,
        f: { cursor?: string; limite?: number },
      ): Promise<PaginaDoExtrato> => {
        const inicio = Number(f.cursor ?? 0);
        const fim = inicio + (f.limite ?? 50);
        return {
          itens: todas.slice(inicio, fim),
          proximoCursor: fim < total ? String(fim) : null,
        };
      },
    );
  }

  it("percorre todas as páginas, aplica o limite de requisições e nomeia pelo período", async () => {
    const listarPagina = paginas(450);
    const consumirLimite = vi.fn(async () => true);
    const servico = criarServicoDeExportacao({
      listarPagina,
      nomes,
      consumirLimite,
      hoje: () => "2026-11-02",
    });
    const r = await servico.exportarExtrato(ctx, {
      dataDe: "2026-10-01",
      dataAte: "2026-10-31",
    });
    expect(listarPagina).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({
      linhas: 450,
      truncado: false,
      nomeDoArquivo: "rastro-extrato_2026-10-01_a_2026-10-31.csv",
    });
    expect(consumirLimite).toHaveBeenCalledWith(
      `exportacao:usuario:${ctx.usuarioId}`,
      { maximo: 30, janelaEmSegundos: 3600 },
    );
  });

  it("corta no limite e avisa no nome; limite de requisições estourado → limite_excedido", async () => {
    const servico = criarServicoDeExportacao({
      listarPagina: paginas(LIMITE_DE_LINHAS + 1),
      nomes,
      consumirLimite: async () => true,
      hoje: () => "2026-11-02",
    });
    const r = await servico.exportarExtrato(ctx, {});
    expect(r).toMatchObject({
      linhas: LIMITE_DE_LINHAS,
      truncado: true,
      nomeDoArquivo: "rastro-extrato_ate_2026-11-02_parcial.csv",
    });

    const bloqueado = criarServicoDeExportacao({
      listarPagina: paginas(1),
      nomes,
      consumirLimite: async () => false,
      hoje: () => "2026-11-02",
    });
    await expect(bloqueado.exportarExtrato(ctx, {})).rejects.toMatchObject({
      codigo: "limite_excedido",
    });
  });
});
