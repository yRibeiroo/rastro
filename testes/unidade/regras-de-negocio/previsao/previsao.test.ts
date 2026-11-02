import { describe, expect, it, vi } from "vitest";
import { criarServicoDePrevisao } from "@/regras-de-negocio/previsao";
import type { OcorrenciaPrevista } from "@/regras-de-negocio/tipos";
import { ctx, EMPRESA, novoId } from "../falsos";

const conta = novoId();
const ocorrencia = (
  data: string,
  valorCentavos: number,
  parcial: Partial<OcorrenciaPrevista> = {},
): OcorrenciaPrevista => ({
  recorrenciaId: novoId(),
  data,
  descricao: "x",
  valorCentavos,
  contaId: conta,
  tipoDaConta: "corrente",
  contaManual: false,
  categoriaId: null,
  ...parcial,
});

function montar(ocorrencias: OcorrenciaPrevista[] = []) {
  const recorrencias = {
    listar: vi.fn(async () => []),
    criar: vi.fn(
      async (_e: string, d: object) =>
        ({ id: "r1", empresaId: EMPRESA, ativa: true, ...d }) as never,
    ),
    encerrar: vi.fn(async () => {}),
    atualizar: vi.fn(
      async (_e: string, id: string, d: object) => ({ id, ...d }) as never,
    ),
    ocorrencias: vi.fn(async () => ocorrencias),
    baixar: vi.fn(async (): Promise<string | null> => "t1"),
  };
  const contas = {
    obterSaldoTotal: vi.fn(async () => ({
      saldoCentavos: 100000,
      atualizadoEm: null,
    })),
  };
  const categorizacao = { categorizarPendentes: vi.fn(async () => ({})) };
  const servico = criarServicoDePrevisao({
    recorrencias,
    contas,
    categorizacao,
    hoje: () => "2026-11-10",
  });
  return { servico, recorrencias, categorizacao };
}

describe("saldo previsto", () => {
  it("soma as ocorrências em ordem, marca atrasadas e deixa o cartão fora do saldo", async () => {
    const { servico, recorrencias } = montar([
      ocorrencia("2026-11-05", -20000), // atrasada
      ocorrencia("2026-11-15", 400000),
      ocorrencia("2026-11-20", -9000, { tipoDaConta: "cartao_de_credito" }),
      ocorrencia("2026-11-30", -150000),
    ]);
    const p = await servico.prever(ctx, 30);
    expect(recorrencias.ocorrencias).toHaveBeenCalledWith(
      EMPRESA,
      "2026-09-11",
      "2026-12-10",
    ); // 60 dias de atraso
    expect(p).toMatchObject({
      hoje: "2026-11-10",
      ate: "2026-12-10",
      saldoAtualCentavos: 100000,
      saldoPrevistoCentavos: 330000,
    });
    expect(
      p.ocorrencias.map((o) => [o.atrasada, o.saldoDepoisCentavos]),
    ).toEqual([
      [true, 80000],
      [false, 480000],
      [false, null],
      [false, 330000],
    ]);
  });

  it("horizonte fora de 1..366 → entrada_invalida", async () => {
    const { servico } = montar();
    for (const dias of [0, 367, 1.5])
      await expect(servico.prever(ctx, dias)).rejects.toMatchObject({
        codigo: "entrada_invalida",
      });
  });
});

describe("recorrências", () => {
  const nova = {
    contaId: conta,
    descricao: " Aluguel ",
    valorCentavos: -150000,
    frequencia: "mensal" as const,
    inicio: "2026-11-05",
  };

  it("valida e cria na empresa do ctx (categoria e fim opcionais)", async () => {
    const { servico, recorrencias } = montar();
    await servico.criarRecorrencia(ctx, nova);
    expect(recorrencias.criar).toHaveBeenCalledWith(EMPRESA, {
      ...nova,
      descricao: "Aluguel",
      categoriaId: null,
      fim: null,
    });
  });

  it("recusa valor zero, frequência desconhecida, data inválida e fim antes do início", async () => {
    const { servico, recorrencias } = montar();
    for (const d of [
      { ...nova, valorCentavos: 0 },
      { ...nova, frequencia: "diaria" },
      { ...nova, inicio: "05/11/2026" },
      { ...nova, fim: "2026-11-01" },
    ])
      await expect(
        servico.criarRecorrencia(ctx, d as never),
      ).rejects.toMatchObject({ codigo: "entrada_invalida" });
    expect(recorrencias.criar).not.toHaveBeenCalled();
  });

  it("baixar: lança por padrão e categoriza; pular não lança; entrada inválida é recusada", async () => {
    const { servico, recorrencias, categorizacao } = montar();
    const recorrenciaId = novoId();
    expect(
      await servico.baixar(ctx, { recorrenciaId, data: "2026-11-05" }),
    ).toEqual({ transacaoId: "t1" });
    expect(recorrencias.baixar).toHaveBeenLastCalledWith(
      EMPRESA,
      recorrenciaId,
      "2026-11-05",
      true,
    );
    expect(categorizacao.categorizarPendentes).toHaveBeenCalledTimes(1);

    recorrencias.baixar.mockResolvedValueOnce(null);
    await servico.baixar(ctx, {
      recorrenciaId,
      data: "2026-12-05",
      lancar: false,
    });
    expect(recorrencias.baixar).toHaveBeenLastCalledWith(
      EMPRESA,
      recorrenciaId,
      "2026-12-05",
      false,
    );
    expect(categorizacao.categorizarPendentes).toHaveBeenCalledTimes(1); // sem lançamento, sem categorização

    await expect(
      servico.baixar(ctx, { recorrenciaId: "x", data: "2026-11-05" }),
    ).rejects.toMatchObject({ codigo: "entrada_invalida" });
    await expect(servico.encerrarRecorrencia(ctx, "x")).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
  });

  it("editar recorrência: valida e delega descrição, valor e fim", async () => {
    const { servico, recorrencias } = montar();
    const id = novoId();
    await servico.editarRecorrencia(ctx, id, {
      descricao: " Aluguel ",
      valorCentavos: -160000,
      fim: null,
    });
    expect(recorrencias.atualizar).toHaveBeenCalledWith(EMPRESA, id, {
      descricao: "Aluguel",
      valorCentavos: -160000,
      fim: null,
    });
    await expect(
      servico.editarRecorrencia(ctx, "x", {
        descricao: "A",
        valorCentavos: 1,
        fim: null,
      }),
    ).rejects.toMatchObject({ codigo: "nao_encontrado" });
    for (const d of [
      { descricao: " ", valorCentavos: 1, fim: null },
      { descricao: "A", valorCentavos: 0, fim: null },
      { descricao: "A", valorCentavos: 1, fim: "x" },
    ])
      await expect(servico.editarRecorrencia(ctx, id, d)).rejects.toMatchObject(
        { codigo: "entrada_invalida" },
      );
  });
});
