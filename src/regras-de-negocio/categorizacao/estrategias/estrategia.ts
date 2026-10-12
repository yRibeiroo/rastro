import "server-only";
import type {
  Categoria,
  CentroDeCusto,
  Id,
  OrigemDaCategoria,
  Regra,
  Transacao,
} from "../../tipos";

export interface ContextoDeCategorizacao {
  empresaId: Id;
  regras: readonly Regra[]; // só ativas, já ordenadas por prioridade asc, criadaEm asc
  categorias: readonly Categoria[]; // não arquivadas
  centrosDeCusto: readonly CentroDeCusto[]; // não arquivados
}

export interface ResultadoDeCategorizacao {
  transacaoId: Id;
  categoriaId: Id;
  centroDeCustoId: Id | null;
  origem: Exclude<OrigemDaCategoria, "usuario">;
  regraId: Id | null;
  confianca: number | null; // só para 'ia'
}

export interface EstrategiaDeCategorizacao {
  readonly nome: "regras" | "provedor" | "ia";
  /** Retorna resultados apenas para as transações que conseguiu categorizar. */
  categorizar(
    transacoes: readonly Transacao[],
    contexto: ContextoDeCategorizacao,
  ): Promise<ResultadoDeCategorizacao[]>;
}

/** Uma categoria de entrada não serve para uma saída (e vice-versa); 'ambos' serve para as duas. */
export function categoriaCompativel(
  categoria: Pick<Categoria, "tipo">,
  transacao: Pick<Transacao, "valorCentavos">,
): boolean {
  if (categoria.tipo === "ambos") return true;
  return (categoria.tipo === "saida") === transacao.valorCentavos < 0;
}
