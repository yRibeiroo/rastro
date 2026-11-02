import { describe, expect, it } from "vitest";
import {
  filtrosDaLeitura,
  lerFiltroDaLista,
  listarCamposCorrigidos,
  TAMANHO_MAXIMO_DO_ARQUIVO,
} from "@/componentes/comprovantes/comprovante";
import {
  TAMANHO_MAXIMO_DO_EXTRATO,
  textoDaSituacaoDoExtrato,
} from "@/componentes/importacao/extrato";
import { TAMANHO_MAXIMO_DO_ANEXO } from "@/regras-de-negocio/anexos/servico";
import { TAMANHO_MAXIMO_DO_COMPROVANTE } from "@/regras-de-negocio/comprovantes/servico";
import { TAMANHO_MAXIMO_DO_EXTRATO as DO_BACKEND } from "@/regras-de-negocio/importacao-de-extrato/servico";

describe("textoDaSituacaoDoExtrato (RF-34)", () => {
  it.each([
    [null, "Nenhum extrato importado ainda"],
    [0, "Última importação hoje"],
    [1, "Última importação ontem"],
    [6, "Última importação há 6 dias"],
    [8, "Última importação há 8 dias"],
  ])("%s dias → %s", (dias, texto) => {
    expect(textoDaSituacaoDoExtrato({ diasDesdeAUltima: dias })).toBe(texto);
  });
});

describe("filtro da lista de comprovantes (RF-42)", () => {
  it("?alerta=sem_transacao lista só os alertados, mesmo com situação na URL", () => {
    const f = lerFiltroDaLista({
      alerta: "sem_transacao",
      situacao: "conciliado",
    });
    expect(f).toEqual({ tipo: "sem_transacao" });
    expect(filtrosDaLeitura(f)).toEqual({ comAlerta: true });
  });
  it("situação válida filtra por situação; inválida ou ausente lista todos", () => {
    expect(filtrosDaLeitura(lerFiltroDaLista({ situacao: "ambiguo" }))).toEqual(
      { situacao: "ambiguo" },
    );
    expect(
      filtrosDaLeitura(lerFiltroDaLista({ situacao: "lendo" })),
    ).toBeUndefined();
    expect(
      filtrosDaLeitura(lerFiltroDaLista({ alerta: ["sem_transacao"] })),
    ).toBeUndefined();
    expect(filtrosDaLeitura(lerFiltroDaLista({}))).toBeUndefined();
  });
});

describe("listarCamposCorrigidos (RF-41)", () => {
  it("junta os nomes em português", () => {
    expect(listarCamposCorrigidos([])).toBe("");
    expect(listarCamposCorrigidos(["valorCentavos"])).toBe("valor");
    expect(listarCamposCorrigidos(["valorCentavos", "data", "emissor"])).toBe(
      "valor, data e emissor",
    );
  });
});

describe("limites de tamanho no navegador", () => {
  it("são os mesmos do backend: 4 MB para comprovante/anexo e 5 MB para OFX", () => {
    expect(TAMANHO_MAXIMO_DO_ARQUIVO).toBe(4 * 1024 * 1024);
    expect(TAMANHO_MAXIMO_DO_ARQUIVO).toBe(TAMANHO_MAXIMO_DO_COMPROVANTE);
    expect(TAMANHO_MAXIMO_DO_ARQUIVO).toBe(TAMANHO_MAXIMO_DO_ANEXO);
    expect(TAMANHO_MAXIMO_DO_EXTRATO).toBe(5 * 1024 * 1024);
    expect(TAMANHO_MAXIMO_DO_EXTRATO).toBe(DO_BACKEND);
  });
});
