import "server-only";
import type { Centavos, TipoDeCategoria } from "../tipos";

// Contrato do Classificador (contratos.md §5.2, ADR 0004).

export interface ItemParaClassificar {
  referencia: string; // opaco (índice do lote), NUNCA o id do banco
  descricao: string;
  valorCentavos: Centavos;
  contraparte: string | null;
}

export interface OpcaoDeCategoria {
  codigo: string;
  nome: string;
  tipo: TipoDeCategoria;
}
export interface OpcaoDeCentroDeCusto {
  codigo: string;
  nome: string;
}

export interface SugestaoDeCategoria {
  referencia: string;
  categoriaCodigo: string | null; // null = não sabe
  centroDeCustoCodigo: string | null;
  confianca: number; // 0..1
  /** Frase curta dizendo por quê (pode vir vazia). */
  justificativa?: string | null;
}

/** Transação que o usuário já classificou à mão: referência para casos parecidos. */
export interface ExemploDeClassificacao {
  descricao: string;
  valorCentavos: Centavos;
  contraparte: string | null;
  categoriaCodigo: string;
}

export interface Classificador {
  /** Até 50 itens por chamada. Lança ErroDeNegocio('classificador_indisponivel') em falha de rede/API. */
  classificar(
    lote: readonly ItemParaClassificar[],
    opcoes: {
      categorias: readonly OpcaoDeCategoria[];
      centrosDeCusto: readonly OpcaoDeCentroDeCusto[];
      /** Correções recentes do usuário, já mascaradas. */
      exemplos?: readonly ExemploDeClassificacao[];
    },
  ): Promise<SugestaoDeCategoria[]>;
}

export const LIMIAR_DE_CONFIANCA = 0.6;
export const TAMANHO_MAXIMO_DO_LOTE = 50;
/** Quantas correções recentes do usuário vão como exemplo em cada chamada. */
export const MAXIMO_DE_EXEMPLOS = 20;
export const TAMANHO_MAXIMO_DA_JUSTIFICATIVA = 200;
