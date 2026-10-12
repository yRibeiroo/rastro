import { describe, expect, it } from "vitest";
import {
  formatarData,
  formatarDataHora,
  formatarDia,
  formatarMes,
  formatarTempoRelativo,
  hojeISO,
  somarDias,
} from "@/ferramentas-internas/formatar-data";

// 09/10/2026 01:30 em UTC = 08/10/2026 22:30 em Araguaína (UTC−3).
const quaseMeiaNoite = new Date("2026-10-09T01:30:00Z");
const agora = new Date("2026-10-09T17:00:00Z"); // 14:00 em Araguaína

describe("formatar-data (America/Araguaina)", () => {
  it("hojeISO respeita o fuso, não o UTC", () => {
    expect(hojeISO(quaseMeiaNoite)).toBe("2026-10-08");
  });

  it("DataISO não muda de dia ao formatar", () => {
    expect(formatarData("2026-10-08")).toBe("08/10/2026");
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
  });

  it("somarDias atravessa mês e ano", () => {
    expect(somarDias("2026-10-01", -1)).toBe("2026-09-30");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formata data e hora no fuso", () => {
    expect(formatarDataHora(quaseMeiaNoite)).toBe("08/10/2026 às 22:30");
  });

  it("dia relativo: hoje, ontem e por extenso", () => {
    expect(formatarDia("2026-10-09", agora)).toBe("Hoje");
    expect(formatarDia("2026-10-08", agora)).toBe("Ontem");
    expect(formatarDia("2026-10-07", agora)).toBe("quarta-feira, 7 de outubro");
  });

  it("tempo relativo", () => {
    const menos = (min: number) => new Date(agora.getTime() - min * 60_000);
    expect(formatarTempoRelativo(menos(0), agora)).toBe("agora");
    expect(formatarTempoRelativo(menos(4), agora)).toBe("há 4 minutos");
    expect(formatarTempoRelativo(menos(120), agora)).toBe("há 2 horas");
    expect(formatarTempoRelativo(menos(60 * 20), agora)).toBe("ontem às 18:00");
    expect(formatarTempoRelativo(menos(60 * 24 * 3), agora)).toBe(
      "06/10/2026 às 14:00",
    );
  });

  it("mês curto e longo", () => {
    expect(formatarMes("2026-10")).toBe("out.");
    expect(formatarMes("2026-10", "longo")).toBe("outubro de 2026");
  });
});
