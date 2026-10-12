import { describe, expect, it } from "vitest";
import { lerVariavel } from "@/configuracao/ambiente";

describe("fumaça", () => {
  it("o Vitest roda e resolve o alias @/", () => {
    expect(lerVariavel("RECURSO_ANEXOS", {})).toBe(true);
  });

  it("variável obrigatória ausente falha com mensagem clara e sem vazar valor", () => {
    expect(() => lerVariavel("CRON_SECRET", { CRON_SECRET: "curto" })).toThrow(
      /CRON_SECRET ausente ou inválida/,
    );
    expect(() =>
      lerVariavel("CRON_SECRET", { CRON_SECRET: "curto" }),
    ).not.toThrow(/curto/);
  });
});
