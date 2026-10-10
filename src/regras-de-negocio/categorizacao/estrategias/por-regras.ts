import "server-only";
import type { Transacao } from "../../tipos";
import { regraCorresponde } from "../normalizar-texto";
import type {
  ContextoDeCategorizacao,
  EstrategiaDeCategorizacao,
  ResultadoDeCategorizacao,
} from "./estrategia";

/** Primeira regra ativa (por prioridade) cujo padrão está contido no campo normalizado. */
export class EstrategiaPorRegras implements EstrategiaDeCategorizacao {
  readonly nome = "regras" as const;

  async categorizar(
    transacoes: readonly Transacao[],
    contexto: ContextoDeCategorizacao,
  ): Promise<ResultadoDeCategorizacao[]> {
    const categorias = new Set(contexto.categorias.map((c) => c.id));
    const centros = new Set(contexto.centrosDeCusto.map((c) => c.id));
    // Regra que aponta para categoria arquivada não se aplica.
    const regras = contexto.regras.filter(
      (r) => r.ativa && categorias.has(r.categoriaId),
    );
    const resultados: ResultadoDeCategorizacao[] = [];
    for (const transacao of transacoes) {
      const regra = regras.find((r) => regraCorresponde(r, transacao));
      if (!regra) continue;
      resultados.push({
        transacaoId: transacao.id,
        categoriaId: regra.categoriaId,
        centroDeCustoId:
          regra.centroDeCustoId && centros.has(regra.centroDeCustoId)
            ? regra.centroDeCustoId
            : null,
        origem: "regra",
        regraId: regra.id,
        confianca: null,
      });
    }
    return resultados;
  }
}
