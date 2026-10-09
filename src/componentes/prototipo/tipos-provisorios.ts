/**
 * Espelho EXATO dos tipos de documentos/arquitetura/contratos.md (§1, §2, §4, §5.3, §7).
 * Provisório: quando o backend publicar `@/regras-de-negocio`, troque os imports
 * `@/componentes/prototipo/tipos-provisorios` por `@/regras-de-negocio` e apague este arquivo.
 */

// §1 Tipos compartilhados
export type Id = string; // uuid
export type DataISO = string; // 'YYYY-MM-DD'
export type Centavos = number; // inteiro; negativo = saída

export type Sentido = "entrada" | "saida";

export type StatusDaConexao =
  | "atualizada"
  | "atualizando"
  | "aguardando_usuario"
  | "erro_de_login"
  | "desatualizada"
  | "erro";

export interface ErroDaConexao {
  codigo: string;
  mensagem: string;
}

export interface Conexao {
  id: Id;
  empresaId: Id;
  provedor: "pluggy";
  idExterno: string;
  banco: string | null;
  status: StatusDaConexao;
  erro: ErroDaConexao | null;
  consentimentoExpiraEm: Date | null;
  ultimaSincronizacaoEm: Date | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export type TipoDeConta = "corrente" | "poupanca" | "cartao_de_credito";

export interface Conta {
  id: Id;
  empresaId: Id;
  conexaoId: Id;
  idExterno: string;
  nome: string;
  tipo: TipoDeConta;
  numeroFinal: string | null;
  saldoCentavos: Centavos;
  saldoAtualizadoEm: Date;
}

export type OrigemDaCategoria = "regra" | "ia" | "usuario" | "pluggy";

export interface Transacao {
  id: Id;
  empresaId: Id;
  conexaoId: Id;
  contaId: Id;
  idExterno: string;
  data: DataISO;
  descricao: string;
  descricaoOriginal: string | null;
  valorCentavos: Centavos;
  pendente: boolean;
  contraparte: string | null;
  metodoDePagamento: string | null;
  categoriaDoProvedor: string | null;
  categoriaId: Id | null;
  centroDeCustoId: Id | null;
  categoriaOrigem: OrigemDaCategoria | null;
  categoriaDefinidaPeloUsuario: boolean;
  regraId: Id | null;
  confiancaIa: number | null;
  categorizacaoAutomaticaEm: Date | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export type TipoDeCategoria = "entrada" | "saida" | "ambos";

export interface Categoria {
  id: Id;
  empresaId: Id;
  nome: string;
  tipo: TipoDeCategoria;
  entraNoResultado: boolean;
  padrao: boolean;
  arquivada: boolean;
}

export interface CentroDeCusto {
  id: Id;
  empresaId: Id;
  nome: string;
  padrao: boolean;
  arquivado: boolean;
}

export type CampoDaRegra = "descricao" | "contraparte";
export type OrigemDaRegra = "padrao" | "usuario" | "correcao";

export interface Regra {
  id: Id;
  empresaId: Id;
  padrao: string;
  campo: CampoDaRegra;
  prioridade: number; // menor vence
  categoriaId: Id;
  centroDeCustoId: Id | null;
  origem: OrigemDaRegra;
  ativa: boolean;
  criadaEm: Date;
}

export interface Anexo {
  id: Id;
  empresaId: Id;
  transacaoId: Id;
  caminho: string;
  nomeArquivo: string;
  tipoMime: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  tamanhoBytes: number;
  criadoEm: Date;
}

// §2 Erros
export type CodigoDeErro =
  | "nao_autenticado"
  | "email_nao_autorizado"
  | "limite_excedido"
  | "entrada_invalida"
  | "nao_encontrado"
  | "conexao_nao_encontrada"
  | "provedor_indisponivel"
  | "classificador_indisponivel"
  | "recurso_desligado"
  | "anexo_invalido";

export type ResultadoDaAcao<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: { codigo: CodigoDeErro | "inesperado"; mensagem: string } };

// §4 Extrato
export interface FiltrosDoExtrato {
  dataDe?: DataISO;
  dataAte?: DataISO;
  categoriaId?: Id | "sem_categoria";
  centroDeCustoId?: Id | "sem_centro";
  sentido?: Sentido;
  busca?: string;
  contaId?: Id;
  cursor?: string;
  limite?: number;
}

export interface PaginaDoExtrato {
  itens: Transacao[];
  proximoCursor: string | null;
}

// §5.3 Categorização
export interface SugestaoDeRegra {
  padrao: string;
  campo: CampoDaRegra;
  categoriaId: Id;
  centroDeCustoId: Id | null;
  transacoesAfetadas: number;
}

export interface NovaRegra {
  padrao: string;
  campo: CampoDaRegra;
  categoriaId: Id;
  centroDeCustoId?: Id | null;
  prioridade?: number;
  origem: Exclude<OrigemDaRegra, "padrao">;
  aplicarNasExistentes: boolean;
}

// §7 Painel
export interface PeriodoDoPainel {
  de: DataISO;
  ate: DataISO;
}

export interface ResumoDoPainel {
  periodo: PeriodoDoPainel;
  saldoAtualCentavos: Centavos;
  saldoAtualizadoEm: Date | null;
  fluxoMensal: Array<{ mes: string; entradasCentavos: Centavos; saidasCentavos: Centavos; resultadoCentavos: Centavos }>;
  gastosPorCategoria: Array<{ categoriaId: Id | null; nome: string; totalCentavos: Centavos; quantidade: number }>;
  resultadoPorCentroDeCusto: Array<{
    centroDeCustoId: Id | null;
    nome: string;
    entradasCentavos: Centavos;
    saidasCentavos: Centavos;
    resultadoCentavos: Centavos;
  }>;
  transacoesSemCategoria: number;
}
