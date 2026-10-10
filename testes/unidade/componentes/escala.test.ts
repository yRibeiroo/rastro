import { describe, expect, it } from "vitest";
import { escalaRedonda } from "@/componentes/graficos/escala";

describe("escalaRedonda", () => {
  it("arredonda o teto para um passo legível", () => {
    expect(escalaRedonda(1_843_000)).toEqual({ teto: 2_000_000, valores: [0, 500_000, 1_000_000, 1_500_000, 2_000_000] });
    expect(escalaRedonda(730)).toEqual({ teto: 800, valores: [0, 200, 400, 600, 800] });
  });
  it("não quebra com zero", () => {
    expect(escalaRedonda(0)).toEqual({ teto: 1, valores: [0] });
  });
});
