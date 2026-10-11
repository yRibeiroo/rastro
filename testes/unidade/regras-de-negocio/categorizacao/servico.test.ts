import { describe, expect, it, vi } from "vitest";
import {
  criarServicoDeCategorizacao,
  EstrategiaPorCategoriaDoProvedor,
  EstrategiaPorIa,
  EstrategiaPorRegras,
  type ItemParaClassificar,
  type SugestaoDeCategoria,
} from "@/regras-de-negocio/categorizacao";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";
import {
  CategoriasEmMemoria,
  CentrosEmMemoria,
  ctx,
  EMPRESA,
  novoId,
  RegrasEmMemoria,
  TransacoesEmMemoria,
  umaCategoria,
  umaRegra,
  umaTransacao,
} from "../falsos";

const combustivel = umaCategoria();
const tarifas = umaCategoria({ nome: "Tarifas bancárias" });
const alimentacao = umaCategoria({ nome: "Alimentação" });

function montar(opcoes: {
  transacoes?: ReturnType<typeof umaTransacao>[];
  regras?: ReturnType<typeof umaRegra>[];
  ia?: (lote: readonly ItemParaClassificar[]) => Promise<SugestaoDeCategoria[]>;
  iaLigada?: boolean;
} = {}) {
  const transacoes = new TransacoesEmMemoria(opcoes.transacoes ?? []);
  const regras = new RegrasEmMemoria(opcoes.regras ?? []);
  const categorias = new CategoriasEmMemoria([combustivel, tarifas, alimentacao]);
  const centrosDeCusto = new CentrosEmMemoria();
  const classificar = vi.fn(
    opcoes.ia ?? (async (_lote: readonly ItemParaClassificar[]) => []),
  );
  const servico = criarServicoDeCategorizacao({
    transacoes,
    regras,
    categorias,
    centrosDeCusto,
    estrategias: [
      new EstrategiaPorRegras(),
      new EstrategiaPorCategoriaDoProvedor(),
      new EstrategiaPorIa({ classificar }),
    ],
    iaLigada: () => opcoes.iaLigada ?? true,
  });
  return { servico, transacoes, regras, categorias, centrosDeCusto, classificar };
}

describe("categorizarPendentes — corrente regras → provedor → IA", () => {
  it("cada estratégia recebe só o que as anteriores não resolveram", async () => {
    const posto = umaTransacao({ descricao: "POSTO IPIRANGA" });
    const tarifa = umaTransacao({ descricao: "DEB AUTOMATICO", categoriaDoProvedor: "Bank fees" });
    const restaurante = umaTransacao({ descricao: "RESTAURANTE DO ZE" });
    const misterio = umaTransacao({ descricao: "PIX ENVIADO" });
    const m = montar({
      transacoes: [posto, tarifa, restaurante, misterio],
      regras: [umaRegra({ padrao: "POSTO", categoriaId: combustivel.id })],
      ia: async (lote) =>
        lote.map((item, i) => ({
          referencia: item.referencia,
          categoriaCodigo: i === 0 ? "c3" : "c1", // c3 = Alimentação (ordem do repositório)
          centroDeCustoCodigo: null,
          confianca: i === 0 ? 0.95 : 0.3,
        })),
    });
    const r = await m.servico.categorizarPendentes(EMPRESA);
    expect(r).toEqual({ categorizadas: 3, semSugestao: 1 });
    expect(m.classificar).toHaveBeenCalledTimes(1);
    expect(m.classificar.mock.calls[0][0].map((i) => i.descricao)).toEqual(["RESTAURANTE DO ZE", "PIX ENVIADO"]);
    const porId = new Map(m.transacoes.linhas.map((t) => [t.id, t]));
    expect(porId.get(posto.id)).toMatchObject({ categoriaId: combustivel.id, categoriaOrigem: "regra" });
    expect(porId.get(tarifa.id)).toMatchObject({ categoriaId: tarifas.id, categoriaOrigem: "pluggy" });
    expect(porId.get(restaurante.id)).toMatchObject({ categoriaId: alimentacao.id, categoriaOrigem: "ia", confiancaIa: 0.95 });
    // confiança baixa: não aplica, mas marca como tentada (não volta à IA a cada sincronização)
    expect(porId.get(misterio.id)).toMatchObject({ categoriaId: null });
    expect(porId.get(misterio.id)?.categorizacaoAutomaticaEm).toBeInstanceOf(Date);
  });

  it("sem pendentes não consulta nada", async () => {
    const m = montar();
    expect(await m.servico.categorizarPendentes(EMPRESA)).toEqual({ categorizadas: 0, semSugestao: 0 });
    expect(m.classificar).not.toHaveBeenCalled();
  });

  it("todas resolvidas por regra: a IA nem é chamada", async () => {
    const m = montar({
      transacoes: [umaTransacao({ descricao: "POSTO" })],
      regras: [umaRegra({ padrao: "POSTO", categoriaId: combustivel.id })],
    });
    expect(await m.servico.categorizarPendentes(EMPRESA)).toEqual({ categorizadas: 1, semSugestao: 0 });
    expect(m.classificar).not.toHaveBeenCalled();
  });

  it("RECURSO_CATEGORIZACAO_IA desligado: pula a IA e deixa as restantes pendentes (sem marcar)", async () => {
    const t = umaTransacao({ descricao: "PIX ENVIADO" });
    const m = montar({ transacoes: [t], iaLigada: false });
    expect(await m.servico.categorizarPendentes(EMPRESA)).toEqual({ categorizadas: 0, semSugestao: 1 });
    expect(m.classificar).not.toHaveBeenCalled();
    expect(m.transacoes.linhas[0].categorizacaoAutomaticaEm).toBeNull();
  });

  it("falha da IA nunca quebra: o que as regras resolveram é aplicado e o resto fica pendente", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const posto = umaTransacao({ descricao: "POSTO" });
    const outra = umaTransacao({ descricao: "PIX" });
    const m = montar({
      transacoes: [posto, outra],
      regras: [umaRegra({ padrao: "POSTO", categoriaId: combustivel.id })],
      ia: async () => {
        throw new ErroDeNegocio("classificador_indisponivel", "fora");
      },
    });
    await expect(m.servico.categorizarPendentes(EMPRESA)).resolves.toEqual({ categorizadas: 1, semSugestao: 1 });
    const pendente = m.transacoes.linhas.find((t) => t.id === outra.id)!;
    expect(pendente.categorizacaoAutomaticaEm).toBeNull();
    expect(await m.transacoes.listarPendentesDeCategorizacao(EMPRESA, 10)).toHaveLength(1);
  });

  it("falha de estratégia que não é IA propaga (é bug, não indisponibilidade)", async () => {
    const m = montar({ transacoes: [umaTransacao()] });
    const quebrada = { nome: "regras" as const, categorizar: async () => Promise.reject(new Error("bug")) };
    const servico = criarServicoDeCategorizacao({
      transacoes: m.transacoes,
      regras: m.regras,
      categorias: m.categorias,
      centrosDeCusto: m.centrosDeCusto,
      estrategias: [quebrada],
      iaLigada: () => true,
    });
    await expect(servico.categorizarPendentes(EMPRESA)).rejects.toThrow("bug");
  });

  it("categoria definida pelo usuário nunca é sobrescrita, nem por regra nem por IA", async () => {
    const doUsuario = umaTransacao({
      descricao: "POSTO",
      categoriaId: alimentacao.id,
      categoriaOrigem: "usuario",
      categoriaDefinidaPeloUsuario: true,
    });
    const m = montar({
      transacoes: [doUsuario],
      regras: [umaRegra({ padrao: "POSTO", categoriaId: combustivel.id })],
    });
    expect(await m.servico.categorizarPendentes(EMPRESA)).toEqual({ categorizadas: 0, semSugestao: 0 });
    const aplicadas = await m.transacoes.aplicarCategorizacaoAutomatica(EMPRESA, [
      { transacaoId: doUsuario.id, categoriaId: combustivel.id, centroDeCustoId: null, origem: "regra", regraId: null, confianca: null },
    ]);
    expect(aplicadas).toBe(0);
    expect(m.transacoes.linhas[0].categoriaId).toBe(alimentacao.id);
  });
});

describe("corrigirCategoria → sugestão de regra", () => {
  it("marca como do usuário e sugere regra pela contraparte, contando as outras afetadas", async () => {
    const corrigida = umaTransacao({ descricao: "PIX ENVIADO", contraparte: "Elétrica Total Ltda" });
    const parecida = umaTransacao({ descricao: "PIX", contraparte: "ELETRICA TOTAL COMERCIO" });
    const jaDoUsuario = umaTransacao({ contraparte: "Eletrica Total", categoriaDefinidaPeloUsuario: true, categoriaOrigem: "usuario" });
    const m = montar({ transacoes: [corrigida, parecida, jaDoUsuario] });
    const centro = novoId();
    const r = await m.servico.corrigirCategoria(ctx, corrigida.id, { categoriaId: combustivel.id, centroDeCustoId: centro });
    expect(r.transacao).toMatchObject({
      categoriaId: combustivel.id,
      centroDeCustoId: centro,
      categoriaOrigem: "usuario",
      categoriaDefinidaPeloUsuario: true,
    });
    expect(r.sugestaoDeRegra).toEqual({
      padrao: "ELETRICA TOTAL",
      campo: "contraparte",
      categoriaId: combustivel.id,
      centroDeCustoId: centro,
      transacoesAfetadas: 1,
    });
  });

  it("sem contraparte usa a descrição sem dígitos; sem mudança de categoria não sugere", async () => {
    const t = umaTransacao({ descricao: "PAG BOLETO 1234 ENERGISA", categoriaId: tarifas.id });
    const m = montar({ transacoes: [t] });
    const r = await m.servico.corrigirCategoria(ctx, t.id, { categoriaId: combustivel.id, centroDeCustoId: null });
    expect(r.sugestaoDeRegra).toMatchObject({ padrao: "PAG BOLETO", campo: "descricao", transacoesAfetadas: 0 });
    const deNovo = await m.servico.corrigirCategoria(ctx, t.id, { categoriaId: combustivel.id, centroDeCustoId: novoId() });
    expect(deNovo.sugestaoDeRegra).toBeNull();
    const semCategoria = await m.servico.corrigirCategoria(ctx, t.id, { categoriaId: null, centroDeCustoId: null });
    expect(semCategoria.sugestaoDeRegra).toBeNull();
  });

  it("descrição sem letras não gera sugestão", async () => {
    const t = umaTransacao({ descricao: "123 456" });
    const m = montar({ transacoes: [t] });
    const r = await m.servico.corrigirCategoria(ctx, t.id, { categoriaId: combustivel.id, centroDeCustoId: null });
    expect(r.sugestaoDeRegra).toBeNull();
  });

  it("valida entrada e existência", async () => {
    const m = montar();
    await expect(m.servico.corrigirCategoria(ctx, "x", { categoriaId: null, centroDeCustoId: null })).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(m.servico.corrigirCategoria(ctx, novoId(), { categoriaId: "x", centroDeCustoId: null })).rejects.toMatchObject({ codigo: "entrada_invalida" });
    await expect(m.servico.corrigirCategoria(ctx, novoId(), { categoriaId: null, centroDeCustoId: null })).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });
});

describe("regras e categorias", () => {
  it("criarRegra normaliza, usa prioridade 50 e aplica nas existentes não definidas pelo usuário (P-14)", async () => {
    const porIa = umaTransacao({ contraparte: "Elétrica Total", categoriaId: alimentacao.id, categoriaOrigem: "ia", confiancaIa: 0.7, centroDeCustoId: "centro-antigo" });
    const doUsuario = umaTransacao({ contraparte: "ELETRICA TOTAL", categoriaDefinidaPeloUsuario: true, categoriaOrigem: "usuario" });
    const outra = umaTransacao({ contraparte: "Outro" });
    const m = montar({ transacoes: [porIa, doUsuario, outra] });
    const r = await m.servico.criarRegra(ctx, {
      padrao: "  elétrica   total ",
      campo: "contraparte",
      categoriaId: combustivel.id,
      origem: "correcao",
      aplicarNasExistentes: true,
    });
    expect(r.regra).toMatchObject({ padrao: "ELETRICA TOTAL", prioridade: 50, centroDeCustoId: null, origem: "correcao" });
    expect(r.transacoesAlteradas).toBe(1);
    const porId = new Map(m.transacoes.linhas.map((t) => [t.id, t]));
    expect(porId.get(porIa.id)).toMatchObject({
      categoriaId: combustivel.id,
      categoriaOrigem: "regra",
      regraId: r.regra.id,
      confiancaIa: null,
      centroDeCustoId: "centro-antigo", // regra sem centro mantém o centro que havia
    });
    expect(porId.get(doUsuario.id)?.categoriaOrigem).toBe("usuario");
  });

  it("criarRegra sem aplicar e com padrão curto demais", async () => {
    const m = montar({ transacoes: [umaTransacao({ descricao: "POSTO" })] });
    const r = await m.servico.criarRegra(ctx, { padrao: "posto", campo: "descricao", categoriaId: combustivel.id, origem: "usuario", aplicarNasExistentes: false, prioridade: 5 });
    expect(r).toMatchObject({ transacoesAlteradas: 0, regra: { prioridade: 5 } });
    const semNada = await m.servico.criarRegra(ctx, { padrao: "zzz", campo: "descricao", categoriaId: combustivel.id, origem: "usuario", aplicarNasExistentes: true });
    expect(semNada.transacoesAlteradas).toBe(0);
    await expect(
      m.servico.criarRegra(ctx, { padrao: " é ", campo: "descricao", categoriaId: combustivel.id, origem: "usuario", aplicarNasExistentes: false }),
    ).rejects.toMatchObject({ codigo: "entrada_invalida", mensagemParaUsuario: "A condição precisa de pelo menos 2 letras." });
    await expect(
      m.servico.criarRegra(ctx, { padrao: "ok", campo: "outro" as "descricao", categoriaId: combustivel.id, origem: "usuario", aplicarNasExistentes: false }),
    ).rejects.toMatchObject({ codigo: "entrada_invalida", mensagemParaUsuario: "Confira os dados informados." });
  });

  it("atualizarRegra normaliza o padrão; remover e listar", async () => {
    const regra = umaRegra({ categoriaId: combustivel.id });
    const m = montar({ regras: [regra] });
    await m.servico.atualizarRegra(ctx, regra.id, { padrao: "ipiranga", ativa: false });
    expect(m.regras.atualizar).toHaveBeenCalledWith(EMPRESA, regra.id, { padrao: "IPIRANGA", ativa: false });
    await expect(m.servico.atualizarRegra(ctx, "x", {})).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await m.servico.removerRegra(ctx, regra.id);
    expect(m.regras.remover).toHaveBeenCalledWith(EMPRESA, regra.id);
    await expect(m.servico.removerRegra(ctx, "x")).rejects.toMatchObject({ codigo: "nao_encontrado" });
    expect(await m.servico.listarRegras(ctx)).toHaveLength(1);
  });

  it("categorias: listar, criar e atualizar com validação", async () => {
    const m = montar();
    expect(await m.servico.listarCategorias(ctx)).toHaveLength(3);
    await m.servico.criarCategoria(ctx, { nome: "  Software ", tipo: "saida" });
    expect(m.categorias.criar).toHaveBeenCalledWith(EMPRESA, { nome: "Software", tipo: "saida", entraNoResultado: true });
    await expect(m.servico.criarCategoria(ctx, { nome: " ", tipo: "saida" })).rejects.toMatchObject({ codigo: "entrada_invalida" });
    await m.servico.atualizarCategoria(ctx, combustivel.id, { arquivada: true });
    expect(m.categorias.atualizar).toHaveBeenCalledWith(EMPRESA, combustivel.id, { arquivada: true });
    await expect(m.servico.atualizarCategoria(ctx, "x", {})).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(m.servico.atualizarCategoria(ctx, combustivel.id, { tipo: "x" as "saida" })).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });
});

describe("categorizarComDica — comprovante conciliado (RF-43)", () => {
  it("regra casa pelo texto dos itens, com o centro de custo da regra", async () => {
    const t = umaTransacao({ descricao: "PAG*LOJA 123" });
    const centro = novoId();
    const m = montar({
      transacoes: [t],
      regras: [umaRegra({ padrao: "R410A", categoriaId: combustivel.id, centroDeCustoId: centro })],
    });
    m.centrosDeCusto.linhas.push({ id: centro, empresaId: EMPRESA, nome: "Refrigeração", padrao: false, arquivado: false });
    expect(await m.servico.categorizarComDica(EMPRESA, t.id, "Loja | Gás R410A 1 kg, Tubo de cobre")).toBe(true);
    expect(m.transacoes.linhas[0]).toMatchObject({ categoriaId: combustivel.id, centroDeCustoId: centro, categoriaOrigem: "regra" });
    expect(m.transacoes.linhas[0].descricao).toBe("PAG*LOJA 123"); // a descrição gravada não muda
    expect(m.classificar).not.toHaveBeenCalled();
  });

  it("sem regra, a IA recebe os itens; categoria do usuário nunca é tocada; falha da IA → false", async () => {
    const t = umaTransacao({ descricao: "PAG*LOJA 123" });
    const m = montar({
      transacoes: [t],
      ia: async (lote) => lote.map((i) => ({ referencia: i.referencia, categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 0.9 })),
    });
    expect(await m.servico.categorizarComDica(EMPRESA, t.id, "Tubo de cobre")).toBe(true);
    expect(m.classificar.mock.calls[0][0][0].descricao).toContain("Tubo de cobre");
    expect(m.transacoes.linhas[0].categoriaOrigem).toBe("ia");

    const doUsuario = umaTransacao({ categoriaDefinidaPeloUsuario: true, categoriaOrigem: "usuario" });
    const u = montar({ transacoes: [doUsuario] });
    expect(await u.servico.categorizarComDica(EMPRESA, doUsuario.id, "x")).toBe(false);
    expect(await u.servico.categorizarComDica(EMPRESA, novoId(), "x")).toBe(false);
    expect(u.classificar).not.toHaveBeenCalled();

    vi.spyOn(console, "error").mockImplementation(() => {});
    const semNada = montar({ transacoes: [umaTransacao()] });
    expect(await semNada.servico.categorizarComDica(EMPRESA, semNada.transacoes.linhas[0].id, "x")).toBe(false);
    const quebrada = montar({ transacoes: [umaTransacao()] });
    quebrada.regras.listarAtivas = async () => {
      throw new Error("db");
    };
    expect(await quebrada.servico.categorizarComDica(EMPRESA, quebrada.transacoes.linhas[0].id, "x")).toBe(false);
  });
});
