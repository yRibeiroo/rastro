import { describe, expect, it } from "vitest";
import { situacaoDaConexao } from "@/componentes/conexao-bancaria/situacao";

const agora = new Date("2026-10-09T12:00:00-03:00");
const emDias = (d: number) => new Date(agora.getTime() + d * 86_400_000);

describe("situacaoDaConexao (RF-07)", () => {
  it.each([
    ["atualizada", emDias(90), "Conectado"],
    ["atualizando", emDias(90), "Sincronizando"],
    ["erro_de_login", emDias(90), "Precisa reconectar"],
    ["aguardando_usuario", emDias(90), "Precisa reconectar"],
    ["desatualizada", emDias(90), "Erro"],
    ["erro", emDias(90), "Erro"],
    ["atualizada", emDias(5), "Precisa reconectar"],
    ["atualizada", emDias(-1), "Precisa reconectar"],
    ["atualizando", null, "Sincronizando"],
  ] as const)("%s com consentimento %s → %s", (status, consentimentoExpiraEm, rotulo) => {
    expect(situacaoDaConexao({ status, consentimentoExpiraEm }, agora).rotulo).toBe(rotulo);
  });

  it("só oferece Reconectar quando faz sentido", () => {
    expect(situacaoDaConexao({ status: "atualizada", consentimentoExpiraEm: emDias(90) }, agora).reconectar).toBe(false);
    expect(situacaoDaConexao({ status: "erro_de_login", consentimentoExpiraEm: emDias(90) }, agora).reconectar).toBe(true);
  });
});

describe("aviso no cabeçalho (HU-04)", () => {
  it("avisa erro de login e autorização vencida, mas não a que só vai vencer", () => {
    expect(situacaoDaConexao({ status: "erro_de_login", consentimentoExpiraEm: emDias(90) }, agora).aviso).toBe(true);
    expect(situacaoDaConexao({ status: "atualizada", consentimentoExpiraEm: emDias(-1) }, agora).aviso).toBe(true);
    expect(situacaoDaConexao({ status: "atualizada", consentimentoExpiraEm: emDias(5) }, agora).aviso).toBe(false);
  });
});
