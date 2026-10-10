import { describe, expect, it } from "vitest";
import { lerFiltros } from "@/componentes/extrato/filtros-da-url";

const hoje = "2026-10-09";

describe("lerFiltros (RF-18)", () => {
  it("sem parâmetros: mês atual, sem outros filtros", () => {
    const r = lerFiltros({}, hoje);
    expect(r.periodo).toBe("mes");
    expect(r.filtros).toEqual({ dataDe: "2026-10-01", dataAte: "2026-10-09" });
    expect(r.ativos).toBe(0);
  });

  it("mês passado atravessa a virada do ano", () => {
    expect(lerFiltros({ periodo: "mes-passado" }, "2026-01-15").filtros).toMatchObject({ dataDe: "2025-12-01", dataAte: "2025-12-31" });
  });

  it("datas explícitas viram período personalizado e valem mais que ?periodo", () => {
    const r = lerFiltros({ periodo: "90d", de: "2026-09-01", ate: "2026-09-30" }, hoje);
    expect(r.periodo).toBe("personalizado");
    expect(r.filtros).toMatchObject({ dataDe: "2026-09-01", dataAte: "2026-09-30" });
  });

  it("traduz nenhuma/nenhum e ignora valores inválidos", () => {
    const r = lerFiltros({ categoria: "nenhuma", centro: "nenhum", sentido: "lateral", de: "ontem" }, hoje);
    expect(r.filtros).toMatchObject({ categoriaId: "sem_categoria", centroDeCustoId: "sem_centro", sentido: undefined });
    expect(r.periodo).toBe("mes");
    expect(r.ativos).toBe(2);
  });

  it("tudo = sem limite de datas; busca cortada em 100 caracteres", () => {
    const r = lerFiltros({ periodo: "tudo", busca: "x".repeat(150) }, hoje);
    expect(r.filtros.dataDe).toBeUndefined();
    expect(r.filtros.busca).toHaveLength(100);
  });
});
