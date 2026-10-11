import { describe, expect, it } from "vitest";
import {
  conciliar,
  semelhancaDeNome,
  type CandidatoAConciliacao,
} from "@/regras-de-negocio/comprovantes";

const candidato = (
  p: Partial<CandidatoAConciliacao> = {},
): CandidatoAConciliacao => ({
  id: "t1",
  data: "2026-10-05",
  valorCentavos: -15000,
  descricao: "PIX ENVIADO",
  contraparte: null,
  ...p,
});
const pix = {
  tipo: "pix" as const,
  valorCentavos: 15000,
  data: "2026-10-03",
  emissor: "Posto Ipiranga Palmas Ltda",
};

describe("conciliar (puro)", () => {
  it.each<[string, CandidatoAConciliacao[], unknown]>([
    [
      "1 candidato com o mesmo valor em D+2 → conciliado",
      [candidato()],
      { situacao: "conciliado", transacaoId: "t1" },
    ],
    [
      "D−3 ainda vale",
      [candidato({ data: "2026-09-30" })],
      { situacao: "conciliado", transacaoId: "t1" },
    ],
    [
      "mesmo valor em D+4 → pendente",
      [candidato({ data: "2026-10-07" })],
      { situacao: "pendente" },
    ],
    [
      "R$ 0,01 de diferença → pendente",
      [candidato({ valorCentavos: -15001 })],
      { situacao: "pendente" },
    ],
    [
      "entrada não serve para Pix pago → pendente",
      [candidato({ valorCentavos: 15000 })],
      { situacao: "pendente" },
    ],
    ["nenhum candidato → pendente", [], { situacao: "pendente" }],
    [
      "2 candidatos e só um com o nome do emissor → conciliado com ele",
      [
        candidato({ id: "a", descricao: "PIX ENVIADO FULANO" }),
        candidato({ id: "b", contraparte: "POSTO IPIRANGA" }),
      ],
      { situacao: "conciliado", transacaoId: "b" },
    ],
    [
      "2 candidatos sem desempate → ambíguo",
      [candidato({ id: "a" }), candidato({ id: "b" })],
      { situacao: "ambiguo", candidatos: ["a", "b"] },
    ],
  ])("%s", (_nome, candidatos, esperado) => {
    expect(conciliar(pix, candidatos)).toEqual(esperado);
  });

  it("recibo aceita entrada; sem data ou sem valor fica pendente", () => {
    expect(
      conciliar({ ...pix, tipo: "recibo" }, [
        candidato({ valorCentavos: 15000 }),
      ]),
    ).toMatchObject({ situacao: "conciliado" });
    expect(conciliar({ ...pix, data: null }, [candidato()])).toEqual({
      situacao: "pendente",
    });
    expect(conciliar({ ...pix, valorCentavos: null }, [candidato()])).toEqual({
      situacao: "pendente",
    });
  });

  it("semelhança de nome ignora acento, sufixo societário e termos genéricos", () => {
    expect(
      semelhancaDeNome("Açaí do Zé LTDA", {
        descricao: "PIX ENVIADO ACAI",
        contraparte: null,
      }),
    ).toBe(1);
    expect(semelhancaDeNome(null, { descricao: "X", contraparte: null })).toBe(
      0,
    );
    expect(
      semelhancaDeNome("PIX LTDA", { descricao: "PIX", contraparte: null }),
    ).toBe(0);
  });
});
