import "server-only";

// Tipos de domínio compartilhados (contratos.md §1).

export type Id = string; // uuid
export type DataISO = string; // 'YYYY-MM-DD'
export type Centavos = number; // inteiro; negativo = saída

export type Sentido = "entrada" | "saida";
export type PapelNaEmpresa = "dono" | "membro";

export interface Empresa {
  id: Id;
  nome: string;
  criadaEm: Date;
}

export interface ContextoDoUsuario {
  usuarioId: Id;
  email: string;
  empresaId: Id;
  papel: PapelNaEmpresa;
}

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
  numeroFinal: string | null; // só os 4 últimos dígitos
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
  confiancaIa: number | null; // 0..1, só quando categoriaOrigem = 'ia'
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
  padrao: string; // já normalizado
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
