import "server-only";

// Leituras para Server Components. As Server Actions ficam em ./acoes ("use server"):
// componentes cliente importam "@/regras-de-negocio/interface-web/acoes" direto.
export {
  carregarCategoriasERegras,
  carregarCentrosDeCusto,
  carregarConexoes,
  carregarExtrato,
  carregarPainel,
  carregarRecursos,
  carregarTransacao,
} from "./leituras";
