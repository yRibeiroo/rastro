import { describe, expect, it, vi } from "vitest";
import { criarServicoDeLancamentos } from "@/regras-de-negocio/lancamentos";
import { ctx, EMPRESA, novoId } from "../falsos";

function montar() {
  const lancamentos = {
    criarContaManual: vi.fn(async () => "conta-1"),
    lancar: vi.fn(async () => "lanc-1"),
    remover: vi.fn(async () => {}),
  };
  const categorizacao = { categorizarPendentes: vi.fn(async () => ({ categorizadas: 1, semSugestao: 0 })) };
  const contas = { listar: vi.fn(async () => []) };
  const servico = criarServicoDeLancamentos({ lancamentos, contas, categorizacao });
  return { servico, lancamentos, categorizacao, contas };
}

const conta = novoId();
const base = { contaId: conta, data: "2026-11-01", descricao: " Feira ", valorCentavos: -3550 };

describe("contas manuais", () => {
  it("valida e cria com saldo inicial padrão 0, sempre na empresa do ctx", async () => {
    const { servico, lancamentos } = montar();
    expect(await servico.criarConta(ctx, { nome: " Carteira ", tipo: "dinheiro" })).toEqual({ id: "conta-1" });
    expect(lancamentos.criarContaManual).toHaveBeenCalledWith(EMPRESA, { nome: "Carteira", tipo: "dinheiro", saldoInicialCentavos: 0 });
  });

  it("nome vazio, tipo desconhecido ou saldo fracionado → entrada_invalida", async () => {
    const { servico, lancamentos } = montar();
    for (const dados of [
      { nome: "  ", tipo: "dinheiro" },
      { nome: "X", tipo: "cripto" },
      { nome: "X", tipo: "dinheiro", saldoInicialCentavos: 1.5 },
    ])
      await expect(servico.criarConta(ctx, dados as never)).rejects.toMatchObject({ codigo: "entrada_invalida" });
    expect(lancamentos.criarContaManual).not.toHaveBeenCalled();
  });
});

describe("lançamentos manuais", () => {
  it("com categoria: grava e não chama a categorização automática", async () => {
    const { servico, lancamentos, categorizacao } = montar();
    const categoriaId = novoId();
    expect(await servico.lancar(ctx, { ...base, categoriaId })).toEqual({ id: "lanc-1" });
    expect(lancamentos.lancar).toHaveBeenCalledWith(EMPRESA, { ...base, descricao: "Feira", categoriaId, centroDeCustoId: null });
    expect(categorizacao.categorizarPendentes).not.toHaveBeenCalled();
  });

  it("sem categoria: categoriza em seguida; falha da categorização não derruba o lançamento", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { servico, categorizacao } = montar();
    categorizacao.categorizarPendentes.mockRejectedValueOnce(new Error("ia fora"));
    await expect(servico.lancar(ctx, base)).resolves.toEqual({ id: "lanc-1" });
    expect(categorizacao.categorizarPendentes).toHaveBeenCalledWith(EMPRESA);
    expect(erro).toHaveBeenCalled();
  });

  it("valor zero, data inválida, conta não-uuid ou descrição vazia → entrada_invalida", async () => {
    const { servico, lancamentos } = montar();
    for (const dados of [
      { ...base, valorCentavos: 0 },
      { ...base, data: "01/11/2026" },
      { ...base, contaId: "x" },
      { ...base, descricao: "   " },
      { ...base, valorCentavos: 10.5 },
    ])
      await expect(servico.lancar(ctx, dados)).rejects.toMatchObject({ codigo: "entrada_invalida" });
    expect(lancamentos.lancar).not.toHaveBeenCalled();
  });

  it("remover: id inválido → nao_encontrado; válido delega com a empresa do ctx", async () => {
    const { servico, lancamentos } = montar();
    await expect(servico.remover(ctx, "x")).rejects.toMatchObject({ codigo: "nao_encontrado" });
    const id = novoId();
    await servico.remover(ctx, id);
    expect(lancamentos.remover).toHaveBeenCalledWith(EMPRESA, id);
  });
});
