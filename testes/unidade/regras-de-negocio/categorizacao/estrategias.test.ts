import { describe, expect, it, vi } from "vitest";
import {
  EstrategiaPorCategoriaDoProvedor,
  EstrategiaPorIa,
  EstrategiaPorRegras,
  mascararDadosPessoais,
  normalizarTexto,
  regraCorresponde,
  type Classificador,
  type ContextoDeCategorizacao,
} from "@/regras-de-negocio/categorizacao";
import { padraoSugerido } from "@/regras-de-negocio/categorizacao/normalizar-texto";
import { EMPRESA, novoId, umaCategoria, umaRegra, umaTransacao } from "../falsos";

describe("normalização e correspondência", () => {
  it("maiúsculas, sem acento, espaços colapsados", () => {
    expect(normalizarTexto("  Açougue   São  João\tLtda ")).toBe("ACOUGUE SAO JOAO LTDA");
    expect(normalizarTexto("Elétrica")).toBe("ELETRICA");
  });

  it("'contém' sobre o campo normalizado da regra", () => {
    const t = { descricao: "Compra no posto ipiranga", contraparte: "Elétrica Total" };
    expect(regraCorresponde({ padrao: "POSTO", campo: "descricao" }, t)).toBe(true);
    expect(regraCorresponde({ padrao: "ELETRICA", campo: "contraparte" }, t)).toBe(true);
    expect(regraCorresponde({ padrao: "ELETRICA", campo: "descricao" }, t)).toBe(false);
    expect(regraCorresponde({ padrao: "POSTO", campo: "contraparte" }, { descricao: "x", contraparte: null })).toBe(false);
    expect(regraCorresponde({ padrao: "", campo: "descricao" }, t)).toBe(false);
  });

  it("padrão sugerido: contraparte sem sufixo societário, senão descrição sem dígitos", () => {
    expect(padraoSugerido({ descricao: "PIX", contraparte: "Elétrica Total Ltda" })).toEqual({
      campo: "contraparte",
      padrao: "ELETRICA TOTAL",
    });
    expect(padraoSugerido({ descricao: "PAG BOLETO 123456 ENERGISA 09/10", contraparte: null })).toEqual({
      campo: "descricao",
      padrao: "PAG BOLETO",
    });
  });

  it("mascara CPF, CNPJ, telefone, e-mail e chave aleatória antes de ir para a IA", () => {
    const texto =
      "PIX JOAO 123.456.789-09 CNPJ 12.345.678/0001-90 tel (63) 99999-8888 joao@x.com 7c1d9a52-4c3e-4f8b-9a3e-2b6f0d1e5a01 NF 1234";
    const mascarado = mascararDadosPessoais(texto);
    expect(mascarado).not.toMatch(/123\.456|12\.345|99999|joao@x|7c1d9a52/);
    expect(mascarado).toContain("NF 1234"); // número curto (nota) fica
    expect(mascarado).toContain("[documento]");
    expect(mascarado).toContain("[email]");
    expect(mascarado).toContain("[chave]");
  });
});

function contexto(parcial: Partial<ContextoDeCategorizacao> = {}): ContextoDeCategorizacao {
  return { empresaId: EMPRESA, regras: [], categorias: [], centrosDeCusto: [], ...parcial };
}

describe("EstrategiaPorRegras", () => {
  it("aplica a primeira regra por prioridade e ignora regra de categoria arquivada", async () => {
    const combustivel = umaCategoria();
    const alimentacao = umaCategoria({ nome: "Alimentação" });
    const centro = { id: novoId(), empresaId: EMPRESA, nome: "Elétrica", padrao: true, arquivado: false };
    const regras = [
      umaRegra({ padrao: "IPIRANGA", prioridade: 10, categoriaId: "arquivada" }),
      umaRegra({ padrao: "POSTO", prioridade: 50, categoriaId: combustivel.id, centroDeCustoId: centro.id }),
      umaRegra({ padrao: "POSTO", prioridade: 100, categoriaId: alimentacao.id }),
      umaRegra({ padrao: "IFOOD", prioridade: 100, categoriaId: alimentacao.id, centroDeCustoId: "centro-arquivado" }),
    ];
    const posto = umaTransacao({ descricao: "COMPRA POSTO IPIRANGA" });
    const ifood = umaTransacao({ descricao: "IFOOD *RESTAURANTE" });
    const nada = umaTransacao({ descricao: "PIX RECEBIDO" });
    const r = await new EstrategiaPorRegras().categorizar(
      [posto, ifood, nada],
      contexto({ regras, categorias: [combustivel, alimentacao], centrosDeCusto: [centro] }),
    );
    expect(r).toEqual([
      { transacaoId: posto.id, categoriaId: combustivel.id, centroDeCustoId: centro.id, origem: "regra", regraId: regras[1].id, confianca: null },
      { transacaoId: ifood.id, categoriaId: alimentacao.id, centroDeCustoId: null, origem: "regra", regraId: regras[3].id, confianca: null },
    ]);
  });
});

describe("EstrategiaPorCategoriaDoProvedor", () => {
  it("só categorias inequívocas e com tipo compatível", async () => {
    const tarifas = umaCategoria({ nome: "Tarifas bancárias" });
    const transferencias = umaCategoria({ nome: "Transferências", tipo: "ambos" });
    const fee = umaTransacao({ categoriaDoProvedor: "Bank fees" });
    const mesmaPessoa = umaTransacao({ categoriaDoProvedor: "Same person transfer", valorCentavos: 5000 });
    const pix = umaTransacao({ categoriaDoProvedor: "Transfer - PIX" });
    const estorno = umaTransacao({ categoriaDoProvedor: "Bank fees", valorCentavos: 100 }); // entrada: tarifa é de saída
    const semCategoria = umaTransacao();
    const r = await new EstrategiaPorCategoriaDoProvedor().categorizar(
      [fee, mesmaPessoa, pix, estorno, semCategoria],
      contexto({ categorias: [tarifas, transferencias] }),
    );
    expect(r.map((x) => [x.transacaoId, x.categoriaId, x.origem])).toEqual([
      [fee.id, tarifas.id, "pluggy"],
      [mesmaPessoa.id, transferencias.id, "pluggy"],
    ]);
  });
});

describe("EstrategiaPorIa", () => {
  const combustivel = umaCategoria();
  const receita = umaCategoria({ nome: "Receita de serviços", tipo: "entrada" });
  const ctxIa = contexto({ categorias: [combustivel, receita] });

  function classificadorQueResponde(fn: Classificador["classificar"]) {
    return { classificar: vi.fn(fn) };
  }

  it("envia só descrição, valor e contraparte mascarados, com códigos curtos; aplica confiança ≥ 0,6", async () => {
    const a = umaTransacao({ descricao: "PIX 123.456.789-09 POSTO", contraparte: "Fulano 98765432100" });
    const b = umaTransacao({ descricao: "PIX RECEBIDO", valorCentavos: 50000 });
    const c = umaTransacao({ descricao: "DUVIDOSA" });
    const classificador = classificadorQueResponde(async () => [
      { referencia: "0", categoriaCodigo: "c1", centroDeCustoCodigo: "k9", confianca: 0.91234 },
      { referencia: "1", categoriaCodigo: "c2", centroDeCustoCodigo: null, confianca: 0.6 },
      { referencia: "2", categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 0.59 },
    ]);
    const r = await new EstrategiaPorIa(classificador).categorizar([a, b, c], ctxIa);
    const [lote, opcoes] = classificador.classificar.mock.calls[0];
    expect(lote).toEqual([
      { referencia: "0", descricao: "PIX [documento] POSTO", valorCentavos: -1000, contraparte: "Fulano [documento]" },
      { referencia: "1", descricao: "PIX RECEBIDO", valorCentavos: 50000, contraparte: null },
      { referencia: "2", descricao: "DUVIDOSA", valorCentavos: -1000, contraparte: null },
    ]);
    expect(JSON.stringify(lote)).not.toContain(a.id);
    expect(opcoes).toEqual({
      categorias: [
        { codigo: "c1", nome: "Combustível", tipo: "saida" },
        { codigo: "c2", nome: "Receita de serviços", tipo: "entrada" },
      ],
      centrosDeCusto: [], // P-12: a IA não escolhe centro de custo
    });
    expect(r).toEqual([
      { transacaoId: a.id, categoriaId: combustivel.id, centroDeCustoId: null, origem: "ia", regraId: null, confianca: 0.91 },
      { transacaoId: b.id, categoriaId: receita.id, centroDeCustoId: null, origem: "ia", regraId: null, confianca: 0.6 },
    ]);
  });

  it("descarta código inventado, referência desconhecida/repetida, tipo incompatível e confiança fora de 0..1", async () => {
    const a = umaTransacao();
    const b = umaTransacao();
    const classificador = classificadorQueResponde(async () => [
      { referencia: "0", categoriaCodigo: "c99", centroDeCustoCodigo: null, confianca: 0.99 },
      { referencia: "0", categoriaCodigo: null, centroDeCustoCodigo: null, confianca: 0.99 },
      { referencia: "7", categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 0.99 },
      { referencia: "x", categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 0.99 },
      { referencia: "0", categoriaCodigo: "c2", centroDeCustoCodigo: null, confianca: 0.99 }, // entrada p/ saída
      { referencia: "1", categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 1.5 },
      { referencia: "1", categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 0.8 },
      { referencia: "1", categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 0.9 }, // repetida
    ]);
    const r = await new EstrategiaPorIa(classificador).categorizar([a, b], ctxIa);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ transacaoId: b.id, confianca: 0.8 });
  });

  it("lotes de no máximo 50; nada a fazer sem transações ou sem categorias", async () => {
    const classificador = classificadorQueResponde(async () => []);
    const muitas = Array.from({ length: 120 }, () => umaTransacao());
    await new EstrategiaPorIa(classificador).categorizar(muitas, ctxIa);
    expect(classificador.classificar.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    expect(await new EstrategiaPorIa(classificador).categorizar([], ctxIa)).toEqual([]);
    expect(await new EstrategiaPorIa(classificador).categorizar(muitas, contexto())).toEqual([]);
    expect(classificador.classificar).toHaveBeenCalledTimes(3);
  });

  it("propaga a falha do classificador (quem chama decide)", async () => {
    const classificador = classificadorQueResponde(async () => {
      throw new Error("fora");
    });
    await expect(new EstrategiaPorIa(classificador).categorizar([umaTransacao()], ctxIa)).rejects.toThrow("fora");
  });
});
