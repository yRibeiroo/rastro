import "server-only";
import type { Transacao } from "../../tipos";
import { normalizarTexto } from "../normalizar-texto";
import {
  categoriaCompativel,
  type ContextoDeCategorizacao,
  type EstrategiaDeCategorizacao,
  type ResultadoDeCategorizacao,
} from "./estrategia";

/**
 * Categorias da Pluggy inequívocas → categoria padrão de mesmo significado (ADR 0003).
 * Transferência para terceiros NÃO entra: pode ser pagamento a fornecedor.
 */
export const MAPA_DE_CATEGORIAS_DO_PROVEDOR: Readonly<Record<string, string>> =
  {
    "BANK FEES": "Tarifas bancárias",
    TAXES: "Impostos e taxas",
    "INCOME TAXES": "Impostos e taxas",
    "TAX ON FINANCIAL OPERATIONS": "Impostos e taxas",
    "SAME PERSON TRANSFER": "Transferências",
    "GAS STATIONS": "Combustível",
    RENT: "Aluguel",
  };

export class EstrategiaPorCategoriaDoProvedor implements EstrategiaDeCategorizacao {
  readonly nome = "provedor" as const;

  async categorizar(
    transacoes: readonly Transacao[],
    contexto: ContextoDeCategorizacao,
  ): Promise<ResultadoDeCategorizacao[]> {
    const porNome = new Map(
      contexto.categorias.map((c) => [normalizarTexto(c.nome), c]),
    );
    const resultados: ResultadoDeCategorizacao[] = [];
    for (const transacao of transacoes) {
      if (!transacao.categoriaDoProvedor) continue;
      const nome =
        MAPA_DE_CATEGORIAS_DO_PROVEDOR[
          normalizarTexto(transacao.categoriaDoProvedor)
        ];
      const categoria = nome ? porNome.get(normalizarTexto(nome)) : undefined;
      if (!categoria || !categoriaCompativel(categoria, transacao)) continue;
      resultados.push({
        transacaoId: transacao.id,
        categoriaId: categoria.id,
        centroDeCustoId: null,
        origem: "pluggy",
        regraId: null,
        confianca: null,
      });
    }
    return resultados;
  }
}
