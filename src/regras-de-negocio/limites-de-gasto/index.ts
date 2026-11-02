import "server-only";

export type { ServicoDeLimitesDeGasto } from "./servico";
export {
  criarServicoDeLimitesDeGasto,
  estadoDoLimite,
  LIMIAR_DE_ATENCAO,
} from "./servico";
