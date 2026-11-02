import "server-only";
import { z } from "zod";
import type {
  RepositorioDeCategorias,
  RepositorioDeLimitesDeGasto,
  RepositorioDoPainel,
} from "@/acesso-a-dados/contratos";
import { ErroDeNegocio, entradaInvalida } from "../erros";
import type {
  ContextoDoUsuario,
  DataISO,
  EstadoDoLimite,
  Id,
  LimiteDeGasto,
  SituacaoDoLimite,
} from "../tipos";

// Limites de gasto mensal por categoria (Fase 6, ADR 0017).

/** A partir daqui o limite fica em "atenção". */
export const LIMIAR_DE_ATENCAO = 0.8;

export interface ServicoDeLimitesDeGasto {
  listar(ctx: ContextoDoUsuario): Promise<LimiteDeGasto[]>;
  definir(
    ctx: ContextoDoUsuario,
    limite: LimiteDeGasto,
  ): Promise<LimiteDeGasto>;
  remover(ctx: ContextoDoUsuario, categoriaId: Id): Promise<void>;
  /** Gasto do mês corrente contra cada limite, do mais estourado para o mais folgado. */
  situacao(ctx: ContextoDoUsuario): Promise<SituacaoDoLimite[]>;
}

export const estadoDoLimite = (proporcao: number): EstadoDoLimite =>
  proporcao >= 1
    ? "estourado"
    : proporcao >= LIMIAR_DE_ATENCAO
      ? "atencao"
      : "ok";

const esquema = z.object({
  categoriaId: z.uuid(),
  valorMensalCentavos: z.number().int().positive().lt(1e14),
});

export function criarServicoDeLimitesDeGasto(deps: {
  limites: RepositorioDeLimitesDeGasto;
  categorias: Pick<RepositorioDeCategorias, "listar">;
  painel: Pick<RepositorioDoPainel, "gastosPorCategoria">;
  hoje: () => DataISO;
}): ServicoDeLimitesDeGasto {
  return {
    listar: (ctx) => deps.limites.listar(ctx.empresaId),

    async definir(ctx, limite) {
      const r = esquema.safeParse(limite);
      if (!r.success)
        throw entradaInvalida(
          "Escolha a categoria e um valor mensal maior que zero.",
        );
      return deps.limites.definir(ctx.empresaId, r.data);
    },

    async remover(ctx, categoriaId) {
      if (!z.uuid().safeParse(categoriaId).success)
        throw new ErroDeNegocio("nao_encontrado", "Limite não encontrado.");
      await deps.limites.remover(ctx.empresaId, categoriaId);
    },

    async situacao(ctx) {
      const limites = await deps.limites.listar(ctx.empresaId);
      if (!limites.length) return [];
      const hoje = deps.hoje();
      const [gastos, categorias] = await Promise.all([
        deps.painel.gastosPorCategoria(ctx.empresaId, {
          de: `${hoje.slice(0, 7)}-01`,
          ate: hoje,
        }),
        deps.categorias.listar(ctx.empresaId, { incluirArquivadas: true }),
      ]);
      const gastoPor = new Map(
        gastos.map((g) => [g.categoriaId, g.totalCentavos]),
      );
      const nomePor = new Map(categorias.map((c) => [c.id, c.nome]));
      return limites
        .map((l) => {
          const gastoCentavos = gastoPor.get(l.categoriaId) ?? 0;
          const proporcao = gastoCentavos / l.valorMensalCentavos;
          return {
            ...l,
            nome: nomePor.get(l.categoriaId) ?? "Categoria removida",
            gastoCentavos,
            proporcao,
            estado: estadoDoLimite(proporcao),
          };
        })
        .sort(
          (a, b) =>
            b.proporcao - a.proporcao || a.nome.localeCompare(b.nome, "pt-BR"),
        );
    },
  };
}
