import "server-only";

// Tipos públicos do domínio para a interface (use `import type`).
export type * from "./tipos";
export type { CodigoDeErro, ResultadoDaAcao } from "./erros";
export type { FiltrosDoExtrato, PaginaDoExtrato } from "./extrato";
export type { NovaRegra, SugestaoDeRegra } from "./categorizacao";
export type { PeriodoDoPainel, ResumoDoPainel } from "./painel";
export type { ServicosDoUsuario } from "./montagem";
