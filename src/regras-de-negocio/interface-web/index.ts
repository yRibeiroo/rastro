import "server-only";

// Leituras para Server Components. As Server Actions ficam em ./acoes ("use server"):
// componentes cliente importam "@/regras-de-negocio/interface-web/acoes" direto.
export {
  carregarCandidatosParaConciliacao,
  carregarCategoriasERegras,
  carregarComprovantes,
  carregarCentrosDeCusto,
  carregarConexoes,
  carregarExtrato,
  carregarImportacoes,
  carregarPainel,
  carregarRecursos,
  carregarSituacaoDoExtrato,
  carregarTransacao,
  contarAlertas,
} from "./leituras";
