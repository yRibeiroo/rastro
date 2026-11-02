import { describe, expect, it } from "vitest";
import {
  descreverMoeda,
  formatarMoeda,
  MENOS,
} from "@/ferramentas-internas/formatar-moeda";

// Intl usa espaço não separável (U+00A0) entre "R$" e o número.
const s = (t: string) => t.replace(/ /g, " ");

describe("formatarMoeda", () => {
  it("formata centavos em R$ pt-BR", () => {
    expect(s(formatarMoeda(123456))).toBe("R$ 1.234,56");
    expect(s(formatarMoeda(0))).toBe("R$ 0,00");
    expect(s(formatarMoeda(5))).toBe("R$ 0,05");
  });

  it("negativo leva o sinal de menos tipográfico", () => {
    expect(s(formatarMoeda(-28640))).toBe(`${MENOS}R$ 286,40`);
  });

  it("com sinal: + nas entradas, − nas saídas, nada no zero", () => {
    expect(s(formatarMoeda(630000, { sinal: true }))).toBe("+R$ 6.300,00");
    expect(s(formatarMoeda(-1, { sinal: true }))).toBe(`${MENOS}R$ 0,01`);
    expect(s(formatarMoeda(0, { sinal: true }))).toBe("R$ 0,00");
  });

  it("compacto", () => {
    expect(s(formatarMoeda(1842000, { compacto: true }))).toBe("R$ 18,4 mil");
    expect(s(formatarMoeda(-512000, { compacto: true, sinal: true }))).toBe(
      `${MENOS}R$ 5,1 mil`,
    );
  });

  it("descreve para leitor de tela", () => {
    expect(s(descreverMoeda(-28640))).toBe("menos R$ 286,40");
    expect(s(descreverMoeda(100))).toBe("mais R$ 1,00");
  });
});

describe("textoParaCentavos", () => {
  it("entende vírgula ou ponto decimal e separador de milhar", async () => {
    const { textoParaCentavos } =
      await import("@/ferramentas-internas/formatar-moeda");
    expect(textoParaCentavos("1.234,56")).toBe(123456);
    expect(textoParaCentavos("1234,5")).toBe(123450);
    expect(textoParaCentavos("1234.56")).toBe(123456);
    expect(textoParaCentavos("1,234.56")).toBe(123456);
    expect(textoParaCentavos("R$ 12")).toBe(1200);
    expect(textoParaCentavos("1.234")).toBe(123400); // 3 dígitos depois do ponto = milhar
    expect(textoParaCentavos("0,05")).toBe(5);
  });

  it("recusa vazio, negativo, letras e valores grandes demais", async () => {
    const { textoParaCentavos } =
      await import("@/ferramentas-internas/formatar-moeda");
    for (const t of ["", "-10", "abc", "10,5x", "1234567890123,00"])
      expect(textoParaCentavos(t)).toBeNull();
  });
});
