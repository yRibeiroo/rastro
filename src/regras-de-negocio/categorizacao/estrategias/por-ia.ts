import "server-only";
import type { Transacao } from "../../tipos";
import {
  LIMIAR_DE_CONFIANCA,
  TAMANHO_MAXIMO_DO_LOTE,
  type Classificador,
} from "../classificador";
import { mascararDadosPessoais } from "../normalizar-texto";
import {
  categoriaCompativel,
  type ContextoDeCategorizacao,
  type EstrategiaDeCategorizacao,
  type ResultadoDeCategorizacao,
} from "./estrategia";

/**
 * Pede ao Classificador, em lotes de até 50, com códigos curtos (c1, c2…) no lugar dos ids.
 * Só descrição, valor e contraparte mascarados saem daqui (ADR 0004, P-12).
 * A IA sugere só a categoria: centro de custo vem de regra ou do usuário (P-12).
 * Propaga a falha do Classificador: quem chama decide (as transações ficam pendentes).
 */
export class EstrategiaPorIa implements EstrategiaDeCategorizacao {
  readonly nome = "ia" as const;

  constructor(private readonly classificador: Classificador) {}

  async categorizar(
    transacoes: readonly Transacao[],
    contexto: ContextoDeCategorizacao,
  ): Promise<ResultadoDeCategorizacao[]> {
    if (!transacoes.length || !contexto.categorias.length) return [];
    const porCodigo = new Map(
      contexto.categorias.map((c, i) => [`c${i + 1}`, c]),
    );
    const opcoes = {
      categorias: [...porCodigo].map(([codigo, c]) => ({
        codigo,
        nome: c.nome,
        tipo: c.tipo,
      })),
      centrosDeCusto: [],
    };
    const resultados: ResultadoDeCategorizacao[] = [];
    for (let i = 0; i < transacoes.length; i += TAMANHO_MAXIMO_DO_LOTE) {
      const lote = transacoes.slice(i, i + TAMANHO_MAXIMO_DO_LOTE);
      const sugestoes = await this.classificador.classificar(
        lote.map((t, indice) => ({
          referencia: String(indice),
          descricao: mascararDadosPessoais(t.descricao),
          valorCentavos: t.valorCentavos,
          contraparte: t.contraparte ? mascararDadosPessoais(t.contraparte) : null,
        })),
        opcoes,
      );
      const vistas = new Set<string>();
      for (const s of sugestoes) {
        const transacao = /^\d+$/.test(s.referencia)
          ? lote[Number(s.referencia)]
          : undefined;
        const categoria = s.categoriaCodigo
          ? porCodigo.get(s.categoriaCodigo)
          : undefined;
        if (
          !transacao ||
          !categoria ||
          vistas.has(s.referencia) ||
          !(s.confianca >= LIMIAR_DE_CONFIANCA && s.confianca <= 1) ||
          !categoriaCompativel(categoria, transacao)
        )
          continue;
        vistas.add(s.referencia);
        resultados.push({
          transacaoId: transacao.id,
          categoriaId: categoria.id,
          centroDeCustoId: null,
          origem: "ia",
          regraId: null,
          confianca: Math.round(s.confianca * 100) / 100,
        });
      }
    }
    return resultados;
  }
}
