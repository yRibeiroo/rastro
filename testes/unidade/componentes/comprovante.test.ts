import { describe, expect, it } from "vitest";
import {
  lerValorEmCentavos,
  mascararDocumento,
} from "@/componentes/comprovantes/comprovante";
import {
  dimensoesReduzidas,
  reduzirImagem,
} from "@/componentes/comprovantes/reduzir-imagem";

describe("dimensoesReduzidas (RNF-24)", () => {
  it("limita o lado maior a 2576 px mantendo a proporção", () => {
    expect(dimensoesReduzidas(4032, 3024)).toEqual({
      largura: 2576,
      altura: 1932,
    });
    expect(dimensoesReduzidas(3024, 4032)).toEqual({
      largura: 1932,
      altura: 2576,
    });
  });
  it("nunca amplia imagens menores", () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe("reduzirImagem", () => {
  it("devolve o PDF intacto", async () => {
    const pdf = new File(["%PDF-1.7"], "nota.pdf", { type: "application/pdf" });
    expect(await reduzirImagem(pdf)).toBe(pdf);
  });
});

describe("lerValorEmCentavos", () => {
  it.each([
    ["1.234,56", 123456],
    ["R$ 12", 1200],
    ["12.5", 1250],
    ["0,99", 99],
    ["0", null],
    ["abc", null],
    ["1,234", null],
  ])("%s → %s", (texto, centavos) => {
    expect(lerValorEmCentavos(texto)).toBe(centavos);
  });
});

describe("mascararDocumento", () => {
  it("mascara CPF e CNPJ", () => {
    expect(mascararDocumento("12345678909")).toBe("***.456.789-**");
    expect(mascararDocumento("12345678000190")).toBe("**.345.678/0001-**");
    expect(mascararDocumento(null)).toBeNull();
  });
});
