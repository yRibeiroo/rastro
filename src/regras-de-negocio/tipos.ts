import "server-only";

// Tipos de domínio compartilhados (contratos.md §1).

export type Id = string; // uuid
export type DataISO = string; // 'YYYY-MM-DD'
export type Centavos = number; // inteiro; negativo = saída

export type Sentido = "entrada" | "saida";
export type PapelNaEmpresa = "dono" | "membro";
/** ADR 0017: define as categorias e regras iniciais da conta. */
export type PerfilDaEmpresa = "pessoal" | "empresa";
export const PERFIS_DA_EMPRESA: readonly PerfilDaEmpresa[] = [
  "pessoal",
  "empresa",
];

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
  provedor: "pluggy" | "arquivo" | "manual"; // 'arquivo' = extrato importado (ADR 0016); 'manual' = contas manuais (ADR 0017)
  idExterno: string;
  banco: string | null;
  status: StatusDaConexao;
  erro: ErroDaConexao | null;
  consentimentoExpiraEm: Date | null;
  ultimaSincronizacaoEm: Date | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export type TipoDeConta =
  "corrente" | "poupanca" | "cartao_de_credito" | "dinheiro"; // dinheiro = carteira (manual)

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
  /** Fora dos totais do painel (continua no extrato e no saldo). */
  oculta: boolean;
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
  transacaoId: Id | null; // null = arquivo de um comprovante (ADR 0016)
  comprovanteId: Id | null;
  caminho: string;
  nomeArquivo: string;
  tipoMime: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  tamanhoBytes: number;
  criadoEm: Date;
}

// ── Extrato importado e comprovantes (ADR 0016) ─────────────────────────────

export interface ImportacaoDeExtrato {
  id: Id;
  empresaId: Id;
  conexaoId: Id;
  contaId: Id;
  nomeDoArquivo: string;
  periodo: { de: DataISO; ate: DataISO };
  novas: number;
  atualizadas: number;
  criadaEm: Date;
}

export type TipoDeComprovante =
  "pix" | "boleto" | "nfce" | "nfe" | "recibo" | "outro";

export type SituacaoDoComprovante =
  "lendo" | "conciliado" | "pendente" | "ambiguo" | "erro_de_leitura";

export interface ItemDoComprovante {
  descricao: string;
  quantidade: number | null;
  valorCentavos: Centavos | null;
}

/** O que o LeitorDeComprovantes extrai. valorCentavos é o valor absoluto (> 0). */
export interface DadosDoComprovante {
  tipo: TipoDeComprovante;
  valorCentavos: Centavos;
  data: DataISO | null;
  emissor: string | null;
  documentoEmissor: string | null; // CPF/CNPJ só dígitos (mascarar na interface)
  chaveDeAcesso: string | null; // 44 dígitos
  itens: ItemDoComprovante[];
  confianca: number; // 0..1
}

/** Campos que o usuário pode corrigir (RF-41); uma releitura não os sobrescreve. */
export type CampoCorrigivel = Exclude<keyof DadosDoComprovante, "confianca">;

/** RF-42: pendente há mais de 10 dias depois da importação que cobre a data dele. */
export type AlertaDoComprovante = "sem_transacao_no_extrato";

export interface Comprovante extends Omit<
  DadosDoComprovante,
  "tipo" | "valorCentavos" | "confianca"
> {
  id: Id;
  empresaId: Id;
  transacaoId: Id | null; // preenchido ao conciliar
  situacao: SituacaoDoComprovante;
  // Nulos enquanto 'lendo' ou em 'erro_de_leitura'.
  tipo: TipoDeComprovante | null;
  valorCentavos: Centavos | null;
  confianca: number | null;
  erro: string | null; // código curto, nunca conteúdo
  camposCorrigidos: CampoCorrigivel[];
  /** Calculado na listagem (não é coluna); null fora de listar/contarAlertas. */
  alerta: AlertaDoComprovante | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

// ── Recorrências e saldo previsto (Fase 4, ADR 0017) ─────────────────────────

export type FrequenciaDaRecorrencia = "semanal" | "mensal" | "anual";

export interface Recorrencia {
  id: Id;
  empresaId: Id;
  contaId: Id;
  descricao: string;
  /** Negativo = a pagar. */
  valorCentavos: Centavos;
  categoriaId: Id | null;
  frequencia: FrequenciaDaRecorrencia;
  inicio: DataISO;
  fim: DataISO | null;
  ativa: boolean;
}

/** Ocorrência ainda não baixada (calculada a partir da regra). */
export interface OcorrenciaPrevista {
  recorrenciaId: Id;
  data: DataISO;
  descricao: string;
  valorCentavos: Centavos;
  contaId: Id;
  tipoDaConta: TipoDeConta;
  contaManual: boolean;
  categoriaId: Id | null;
}

// ── Limites de gasto por categoria (Fase 6, ADR 0017) ────────────────────────

export interface LimiteDeGasto {
  categoriaId: Id;
  valorMensalCentavos: Centavos;
}

export type EstadoDoLimite = "ok" | "atencao" | "estourado";

export interface SituacaoDoLimite extends LimiteDeGasto {
  nome: string;
  /** Gasto do mês corrente (positivo), sem ocultas, pendentes e transferências. */
  gastoCentavos: Centavos;
  /** 0..∞ (1 = 100%). */
  proporcao: number;
  estado: EstadoDoLimite;
}
