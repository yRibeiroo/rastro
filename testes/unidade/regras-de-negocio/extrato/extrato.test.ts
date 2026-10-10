import { describe, expect, it } from "vitest";
import {
  codificarCursor,
  criarServicoDeExtrato,
  decodificarCursor,
} from "@/regras-de-negocio/extrato";
import { ctx, EMPRESA, novoId, TransacoesEmMemoria, umaTransacao } from "../falsos";

describe("ServicoDeExtrato", () => {
  it("valida e aplica os padrões dos filtros", async () => {
    const transacoes = new TransacoesEmMemoria();
    const servico = criarServicoDeExtrato({ transacoes });
    const cursor = codificarCursor({ data: "2026-10-01", id: novoId() });
    await servico.listar(ctx, { busca: "  posto ", sentido: "saida", cursor, categoriaId: "sem_categoria" });
    expect(transacoes.listar).toHaveBeenCalledWith(EMPRESA, {
      busca: "posto",
      sentido: "saida",
      cursor,
      categoriaId: "sem_categoria",
      limite: 50,
    });
    await servico.listar(ctx, { busca: "   " });
    expect(transacoes.listar).toHaveBeenLastCalledWith(EMPRESA, { busca: undefined, limite: 50 });
  });

  it.each([
    { limite: 201 },
    { limite: 0 },
    { dataDe: "2026-13-01" },
    { dataDe: "2026-10-02", dataAte: "2026-10-01" },
    { busca: "x".repeat(101) },
    { cursor: "lixo" },
    { categoriaId: "nao-uuid" },
    { sentido: "outro" },
  ])("filtro inválido %o → entrada_invalida", async (filtro) => {
    const servico = criarServicoDeExtrato({ transacoes: new TransacoesEmMemoria() });
    await expect(servico.listar(ctx, filtro as never)).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });

  it("obter: só da própria empresa; senão nao_encontrado", async () => {
    const t = umaTransacao();
    const servico = criarServicoDeExtrato({ transacoes: new TransacoesEmMemoria([t]) });
    expect((await servico.obter(ctx, t.id)).id).toBe(t.id);
    await expect(servico.obter(ctx, novoId())).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(servico.obter(ctx, "x")).rejects.toMatchObject({ codigo: "nao_encontrado" });
    await expect(servico.obter({ ...ctx, empresaId: novoId() }, t.id)).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("cursor opaco: base64url de data|id, ida e volta", () => {
    const id = "c4d5e6f7-0819-42a3-b4c5-d6e7f8091a2b";
    const cursor = codificarCursor({ data: "2026-10-06", id });
    expect(cursor).not.toContain("|");
    expect(decodificarCursor(cursor)).toEqual({ data: "2026-10-06", id });
    expect(decodificarCursor(Buffer.from("2026-10-06|x' or 1=1").toString("base64url"))).toBeNull();
  });
});
