import "server-only";

export type {
  FiltrosDoExtrato,
  PaginaDoExtrato,
  ServicoDeExtrato,
} from "./servico-de-extrato";
export {
  codificarCursor,
  criarServicoDeExtrato,
  decodificarCursor,
  LIMITE_MAXIMO_DO_EXTRATO,
  LIMITE_PADRAO_DO_EXTRATO,
} from "./servico-de-extrato";
export type { ServicoDeSincronizacao } from "./servico-de-sincronizacao";
export { criarServicoDeSincronizacao } from "./servico-de-sincronizacao";
