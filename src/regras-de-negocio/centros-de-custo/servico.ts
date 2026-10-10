import "server-only";
import { z } from "zod";
import type { RepositorioDeCentrosDeCusto } from "@/acesso-a-dados/contratos";
import { ErroDeNegocio, entradaInvalida } from "../erros";
import type { CentroDeCusto, ContextoDoUsuario, Id } from "../tipos";

export interface ServicoDeCentrosDeCusto {
  listar(
    ctx: ContextoDoUsuario,
    opcoes?: { incluirArquivados?: boolean },
  ): Promise<CentroDeCusto[]>;
  criar(ctx: ContextoDoUsuario, dados: { nome: string }): Promise<CentroDeCusto>;
  atualizar(
    ctx: ContextoDoUsuario,
    centroDeCustoId: Id,
    dados: Partial<Pick<CentroDeCusto, "nome" | "arquivado">>,
  ): Promise<CentroDeCusto>;
}

const nome = z.string().trim().min(1).max(60);
const esquemaNovo = z.object({ nome });
const esquemaAtualizacao = z
  .object({ nome, arquivado: z.boolean() })
  .partial();

export function criarServicoDeCentrosDeCusto(deps: {
  centrosDeCusto: RepositorioDeCentrosDeCusto;
}): ServicoDeCentrosDeCusto {
  return {
    listar: (ctx, opcoes) => deps.centrosDeCusto.listar(ctx.empresaId, opcoes),

    async criar(ctx, dados) {
      const r = esquemaNovo.safeParse(dados);
      if (!r.success) throw entradaInvalida("Dê um nome para o centro de custo.");
      return deps.centrosDeCusto.criar(ctx.empresaId, r.data);
    },

    async atualizar(ctx, centroDeCustoId, dados) {
      if (!z.uuid().safeParse(centroDeCustoId).success)
        throw new ErroDeNegocio("nao_encontrado", "Centro de custo não encontrado.");
      const r = esquemaAtualizacao.safeParse(dados);
      if (!r.success) throw entradaInvalida("Dê um nome para o centro de custo.");
      return deps.centrosDeCusto.atualizar(ctx.empresaId, centroDeCustoId, r.data);
    },
  };
}
