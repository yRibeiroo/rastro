import { describe, expect, it, vi } from "vitest";
import {
  criarServicoDeLimitesDeGasto,
  estadoDoLimite,
} from "@/regras-de-negocio/limites-de-gasto";
import type { LimiteDeGasto } from "@/regras-de-negocio/tipos";
import { ctx, EMPRESA, novoId, umaCategoria } from "../falsos";

const mercado = umaCategoria({ nome: "Mercado" });
const lazer = umaCategoria({ nome: "Lazer" });
const pets = umaCategoria({ nome: "Pets" });

function montar(limites: LimiteDeGasto[]) {
  const repo = {
    listar: vi.fn(async () => limites),
    definir: vi.fn(async (_e: string, l: LimiteDeGasto) => l),
    remover: vi.fn(async () => {}),
  };
  const painel = {
    gastosPorCategoria: vi.fn(async () => [
      {
        categoriaId: mercado.id,
        nome: "Mercado",
        totalCentavos: 85000,
        quantidade: 4,
      },
      {
        categoriaId: lazer.id,
        nome: "Lazer",
        totalCentavos: 30000,
        quantidade: 2,
      },
      {
        categoriaId: null,
        nome: "Sem categoria",
        totalCentavos: 999,
        quantidade: 1,
      },
    ]),
  };
  const categorias = { listar: vi.fn(async () => [mercado, lazer, pets]) };
  const servico = criarServicoDeLimitesDeGasto({
    limites: repo,
    categorias,
    painel,
    hoje: () => "2026-11-20",
  });
  return { servico, repo, painel };
}

describe("limites de gasto", () => {
  it("estado: abaixo de 80% ok, de 80% a 99% atenção, 100% ou mais estourado", () => {
    expect(estadoDoLimite(0.79)).toBe("ok");
    expect(estadoDoLimite(0.8)).toBe("atencao");
    expect(estadoDoLimite(1)).toBe("estourado");
  });

  it("situação: gasto do mês corrente contra o limite, do mais estourado ao mais folgado", async () => {
    const { servico, painel } = montar([
      { categoriaId: lazer.id, valorMensalCentavos: 100000 },
      { categoriaId: mercado.id, valorMensalCentavos: 80000 },
      { categoriaId: pets.id, valorMensalCentavos: 20000 },
    ]);
    const s = await servico.situacao(ctx);
    expect(painel.gastosPorCategoria).toHaveBeenCalledWith(EMPRESA, {
      de: "2026-11-01",
      ate: "2026-11-20",
    });
    expect(s.map((l) => [l.nome, l.gastoCentavos, l.estado])).toEqual([
      ["Mercado", 85000, "estourado"],
      ["Lazer", 30000, "ok"],
      ["Pets", 0, "ok"],
    ]);
  });

  it("sem limites não consulta o painel", async () => {
    const { servico, painel } = montar([]);
    expect(await servico.situacao(ctx)).toEqual([]);
    expect(painel.gastosPorCategoria).not.toHaveBeenCalled();
  });

  it("definir valida (uuid, inteiro positivo); remover valida o id", async () => {
    const { servico, repo } = montar([]);
    const categoriaId = novoId();
    await servico.definir(ctx, { categoriaId, valorMensalCentavos: 60000 });
    expect(repo.definir).toHaveBeenCalledWith(EMPRESA, {
      categoriaId,
      valorMensalCentavos: 60000,
    });
    for (const l of [
      { categoriaId: "x", valorMensalCentavos: 1 },
      { categoriaId, valorMensalCentavos: 0 },
      { categoriaId, valorMensalCentavos: 1.5 },
    ])
      await expect(servico.definir(ctx, l)).rejects.toMatchObject({
        codigo: "entrada_invalida",
      });
    await expect(servico.remover(ctx, "x")).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
  });
});
