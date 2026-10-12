import { describe, expect, it, vi } from "vitest";
import {
  criarServicoDeConexaoBancaria,
  webhookAutorizado,
} from "@/regras-de-negocio/conexao-bancaria";
import {
  ConexoesEmMemoria,
  ctx,
  EMPRESA,
  ITEM,
  OUTRA_EMPRESA,
  ProvedorFalso,
  umaConexao,
} from "../falsos";

const SEGREDO = "s".repeat(40);

describe("webhookAutorizado", () => {
  it("aceita só 'Bearer <segredo>' exato", () => {
    expect(webhookAutorizado(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true);
    expect(webhookAutorizado(`Bearer ${SEGREDO}x`, SEGREDO)).toBe(false);
    expect(webhookAutorizado(`bearer ${SEGREDO}`, SEGREDO)).toBe(false);
    expect(webhookAutorizado(SEGREDO, SEGREDO)).toBe(false);
  });

  it("sem cabeçalho ou sem segredo configurado → false", () => {
    expect(webhookAutorizado(null, SEGREDO)).toBe(false);
    expect(webhookAutorizado("Bearer ", "")).toBe(false);
    expect(webhookAutorizado("Bearer undefined", undefined)).toBe(false);
  });
});

function montar(conexoes = new ConexoesEmMemoria()) {
  const provedor = new ProvedorFalso();
  const consumirLimite = vi.fn(async () => true);
  const servico = criarServicoDeConexaoBancaria({
    provedor,
    conexoes,
    consumirLimite,
  });
  return { provedor, conexoes, consumirLimite, servico };
}

describe("ServicoDeConexaoBancaria", () => {
  it("iniciarConexao: token com o empresaId e rate limit por usuário", async () => {
    const { servico, provedor, consumirLimite } = montar();
    expect(await servico.iniciarConexao(ctx)).toEqual({ token: "token-curto" });
    expect(provedor.criarTokenDeConexao).toHaveBeenCalledWith({
      identificadorDoUsuario: EMPRESA,
      idExternoParaReconectar: undefined,
    });
    expect(consumirLimite).toHaveBeenCalledWith(
      `conexao:usuario:${ctx.usuarioId}`,
      {
        maximo: 10,
        janelaEmSegundos: 3600,
      },
    );
  });

  it("iniciarConexao para reconectar usa o idExterno da conexão da própria empresa", async () => {
    const conexao = umaConexao();
    const { servico, provedor } = montar(new ConexoesEmMemoria([conexao]));
    await servico.iniciarConexao(ctx, { conexaoIdParaReconectar: conexao.id });
    expect(provedor.criarTokenDeConexao).toHaveBeenCalledWith({
      identificadorDoUsuario: EMPRESA,
      idExternoParaReconectar: ITEM,
    });
    await expect(
      servico.iniciarConexao(ctx, { conexaoIdParaReconectar: "nao-e-uuid" }),
    ).rejects.toMatchObject({ codigo: "conexao_nao_encontrada" });
    const deOutra = umaConexao({ empresaId: OUTRA_EMPRESA });
    const outro = montar(new ConexoesEmMemoria([deOutra]));
    await expect(
      outro.servico.iniciarConexao(ctx, {
        conexaoIdParaReconectar: deOutra.id,
      }),
    ).rejects.toMatchObject({ codigo: "conexao_nao_encontrada" });
  });

  it("iniciarConexao acima do limite → limite_excedido", async () => {
    const { servico, consumirLimite, provedor } = montar();
    consumirLimite.mockResolvedValue(false);
    await expect(servico.iniciarConexao(ctx)).rejects.toMatchObject({
      codigo: "limite_excedido",
    });
    expect(provedor.criarTokenDeConexao).not.toHaveBeenCalled();
  });

  it("registrarConexao valida o itemId na Pluggy e salva", async () => {
    const { servico, conexoes, provedor } = montar();
    const conexao = await servico.registrarConexao(ctx, ITEM);
    expect(provedor.obterConexao).toHaveBeenCalledWith(ITEM);
    expect(conexao).toMatchObject({
      empresaId: EMPRESA,
      idExterno: ITEM,
      status: "atualizada",
    });
    expect(await servico.listarConexoes(ctx)).toHaveLength(1);
    expect(conexoes.linhas).toHaveLength(1);
  });

  it("registrarConexao: id inválido, 404 na Pluggy ou item de outra empresa → erro", async () => {
    const { servico, provedor } = montar();
    await expect(servico.registrarConexao(ctx, "123")).rejects.toMatchObject({
      codigo: "entrada_invalida",
    });
    provedor.conexao = null; // 404
    await expect(servico.registrarConexao(ctx, ITEM)).rejects.toMatchObject({
      codigo: "conexao_nao_encontrada",
    });
    provedor.conexao = {
      ...new ProvedorFalso().conexao!,
      identificadorDoUsuario: OUTRA_EMPRESA,
    };
    await expect(servico.registrarConexao(ctx, ITEM)).rejects.toMatchObject({
      codigo: "conexao_nao_encontrada",
    });
  });

  it("registrarConexao não toma conexão já salva por outra empresa", async () => {
    const { servico } = montar(
      new ConexoesEmMemoria([umaConexao({ empresaId: OUTRA_EMPRESA })]),
    );
    await expect(servico.registrarConexao(ctx, ITEM)).rejects.toMatchObject({
      codigo: "conexao_nao_encontrada",
    });
  });
});
