import "server-only";

// Leituras para Server Components. As Server Actions ficam em ./acoes ("use server"):
// componentes cliente importam "@/regras-de-negocio/interface-web/acoes" direto.
export {
  carregarCandidatosParaConciliacao,
  carregarCategoriasERegras,
  carregarComprovantes,
  carregarCentrosDeCusto,
  carregarConexoes,
  carregarContas,
  carregarExtrato,
  carregarImportacoes,
  carregarLimitesDeGasto,
  carregarPainel,
  carregarPrevisao,
  carregarRecursos,
  carregarSaldoPorMes,
  carregarSituacaoDoExtrato,
  carregarTransacao,
  contarAlertas,
} from "./leituras";
