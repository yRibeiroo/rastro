import "server-only";

export type {
  NovaRegra,
  ServicoDeCategorizacao,
  SugestaoDeRegra,
} from "./servico";
export { criarServicoDeCategorizacao } from "./servico";
export type {
  ContextoDeCategorizacao,
  EstrategiaDeCategorizacao,
  ResultadoDeCategorizacao,
} from "./estrategias/estrategia";
export { EstrategiaPorRegras } from "./estrategias/por-regras";
export { EstrategiaPorCategoriaDoProvedor } from "./estrategias/por-categoria-do-provedor";
export { EstrategiaPorIa } from "./estrategias/por-ia";
export type {
  Classificador,
  ItemParaClassificar,
  OpcaoDeCategoria,
  OpcaoDeCentroDeCusto,
  SugestaoDeCategoria,
} from "./classificador";
export { LIMIAR_DE_CONFIANCA, TAMANHO_MAXIMO_DO_LOTE } from "./classificador";
export {
  mascararDadosPessoais,
  normalizarTexto,
  regraCorresponde,
} from "./normalizar-texto";
export {
  ClassificadorClaude,
  classificadorClaude,
  MODELO_DO_CLASSIFICADOR,
} from "./adaptadores/claude/classificador-claude";
