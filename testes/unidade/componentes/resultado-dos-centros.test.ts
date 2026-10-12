import { expect, test } from "vitest";
import { comTodosOsCentros } from "@/componentes/centros-de-custo/resultado";

test("centros ativos sem movimento entram zerados, sem repetir os que já têm", () => {
  const linhas = comTodosOsCentros(
    [
      {
        centroDeCustoId: "a",
        nome: "Administrativo",
        entradasCentavos: 0,
        saidasCentavos: 500,
        resultadoCentavos: -500,
      },
      {
        centroDeCustoId: null,
        nome: "Sem centro de custo",
        entradasCentavos: 100,
        saidasCentavos: 0,
        resultadoCentavos: 100,
      },
    ],
    [
      { id: "a", nome: "Administrativo" },
      { id: "e", nome: "Elétrica" },
    ],
  );
  expect(linhas.map((l) => [l.nome, l.resultadoCentavos])).toEqual([
    ["Administrativo", -500],
    ["Sem centro de custo", 100],
    ["Elétrica", 0],
  ]);
});
