import "server-only";
import type {
  ContaDoProvedor,
  TransacaoDoProvedor,
} from "@/regras-de-negocio/conexao-bancaria/provedor-bancario";
import type { ResultadoDeCategorizacao } from "@/regras-de-negocio/categorizacao/estrategias/estrategia";
import type {
  FiltrosDoExtrato,
  PaginaDoExtrato,
} from "@/regras-de-negocio/extrato/servico-de-extrato";
import type {
  PeriodoDoPainel,
  ResumoDoPainel,
} from "@/regras-de-negocio/painel/servico";
import type {
  Anexo,
  Categoria,
  Centavos,
  CentroDeCusto,
  Conexao,
  Conta,
  DataISO,
  ErroDaConexao,
  Id,
  PapelNaEmpresa,
  Regra,
  StatusDaConexao,
  TipoDeCategoria,
  Transacao,
} from "@/regras-de-negocio/tipos";

// Contratos dos repositórios (contratos.md §10). Todo método recebe empresaId explicitamente.

export interface RepositorioDeEmpresas {
  garantirEmpresaDoUsuario(nomeSugerido: string): Promise<Id>; // rpc garantir_empresa
  obterMembershipDoUsuario(
    usuarioId: Id,
  ): Promise<{ empresaId: Id; papel: PapelNaEmpresa } | null>;
  existe(empresaId: Id): Promise<boolean>;
}

export interface DadosDaConexao {
  idExterno: string;
  banco: string | null;
  status: StatusDaConexao;
  erro: ErroDaConexao | null;
  consentimentoExpiraEm: Date | null;
}

export interface RepositorioDeConexoes {
  salvar(
    empresaId: Id,
    dados: DadosDaConexao,
    criadoPor: Id | null,
  ): Promise<Conexao>; // upsert por (provedor, id_externo)
  buscarPorIdExterno(idExterno: string): Promise<Conexao | null>; // sem filtro de empresa: só o caminho do sistema usa
  buscarPorId(empresaId: Id, conexaoId: Id): Promise<Conexao | null>;
  listar(empresaId: Id): Promise<Conexao[]>;
  listarTodas(): Promise<Conexao[]>; // só o cron (service role)
  atualizarStatus(
    empresaId: Id,
    conexaoId: Id,
    dados: Omit<DadosDaConexao, "idExterno" | "banco">,
  ): Promise<void>;
  marcarSincronizada(empresaId: Id, conexaoId: Id, em: Date): Promise<void>;
}

export interface RepositorioDeContas {
  salvarVarias(
    empresaId: Id,
    conexaoId: Id,
    contas: readonly ContaDoProvedor[],
  ): Promise<Conta[]>; // upsert por (conexao_id, id_externo)
  listar(empresaId: Id): Promise<Conta[]>;
  obterSaldoTotal(
    empresaId: Id,
  ): Promise<{ saldoCentavos: Centavos; atualizadoEm: Date | null }>; // corrente + poupança
}

export interface RepositorioDeTransacoes {
  /** Upsert por (empresa_id, id_externo); NUNCA altera colunas de categoria. Retorna quantas linhas gravou. */
  salvarDoProvedor(
    empresaId: Id,
    conexaoId: Id,
    linhas: ReadonlyArray<TransacaoDoProvedor & { contaId: Id }>,
  ): Promise<number>;
  removerPorIdsExternos(
    empresaId: Id,
    idsExternos: readonly string[],
  ): Promise<number>;
  listar(empresaId: Id, filtros: FiltrosDoExtrato): Promise<PaginaDoExtrato>;
  buscarPorId(empresaId: Id, transacaoId: Id): Promise<Transacao | null>;
  listarPendentesDeCategorizacao(
    empresaId: Id,
    limite: number,
  ): Promise<Transacao[]>;
  /** UPDATE ... WHERE categoria_definida_pelo_usuario = false. Também marca categorizacao_automatica_em = now(). */
  aplicarCategorizacaoAutomatica(
    empresaId: Id,
    resultados: readonly ResultadoDeCategorizacao[],
  ): Promise<number>;
  marcarCategorizacaoTentada(
    empresaId: Id,
    transacaoIds: readonly Id[],
  ): Promise<void>;
  definirCategoriaPeloUsuario(
    empresaId: Id,
    transacaoId: Id,
    dados: { categoriaId: Id | null; centroDeCustoId: Id | null },
  ): Promise<Transacao>;
  /** Transações não definidas pelo usuário cujo campo normalizado contém o padrão (para sugerir ou aplicar regra). */
  listarCorrespondentesARegra(
    empresaId: Id,
    regra: Pick<Regra, "padrao" | "campo">,
    opcoes: { excluirId?: Id; limite: number },
  ): Promise<Transacao[]>;
  contarSemCategoria(
    empresaId: Id,
    periodo?: { de: DataISO; ate: DataISO },
  ): Promise<number>;
}

export interface RepositorioDeCategorias {
  listar(
    empresaId: Id,
    opcoes?: { incluirArquivadas?: boolean },
  ): Promise<Categoria[]>;
  criar(
    empresaId: Id,
    dados: { nome: string; tipo: TipoDeCategoria; entraNoResultado: boolean },
  ): Promise<Categoria>;
  atualizar(
    empresaId: Id,
    categoriaId: Id,
    dados: Partial<
      Pick<Categoria, "nome" | "tipo" | "entraNoResultado" | "arquivada">
    >,
  ): Promise<Categoria>;
}

export interface RepositorioDeCentrosDeCusto {
  listar(
    empresaId: Id,
    opcoes?: { incluirArquivados?: boolean },
  ): Promise<CentroDeCusto[]>;
  criar(empresaId: Id, dados: { nome: string }): Promise<CentroDeCusto>;
  atualizar(
    empresaId: Id,
    centroDeCustoId: Id,
    dados: Partial<Pick<CentroDeCusto, "nome" | "arquivado">>,
  ): Promise<CentroDeCusto>;
}

export interface RepositorioDeRegras {
  listarAtivas(empresaId: Id): Promise<Regra[]>; // ordenadas por prioridade asc, criado_em asc
  listar(empresaId: Id): Promise<Regra[]>;
  criar(
    empresaId: Id,
    dados: Omit<Regra, "id" | "empresaId" | "criadaEm" | "ativa">,
  ): Promise<Regra>;
  atualizar(
    empresaId: Id,
    regraId: Id,
    dados: Partial<
      Pick<
        Regra,
        | "padrao"
        | "campo"
        | "prioridade"
        | "categoriaId"
        | "centroDeCustoId"
        | "ativa"
      >
    >,
  ): Promise<Regra>;
  remover(empresaId: Id, regraId: Id): Promise<void>;
}

export interface RepositorioDeAnexos {
  criar(
    empresaId: Id,
    dados: Omit<Anexo, "id" | "empresaId" | "criadoEm">,
    enviadoPor: Id,
  ): Promise<Anexo>;
  listar(empresaId: Id, transacaoId: Id): Promise<Anexo[]>;
  buscarPorId(empresaId: Id, anexoId: Id): Promise<Anexo | null>;
  remover(empresaId: Id, anexoId: Id): Promise<void>;
}

/** Storage (bucket 'anexos'). */
export interface ArmazenamentoDeArquivos {
  enviar(caminho: string, conteudo: Blob, tipoMime: string): Promise<void>;
  gerarUrlAssinada(caminho: string, segundos: number): Promise<string>;
  remover(caminhos: readonly string[]): Promise<void>;
}

export interface RepositorioDeEventosDeWebhook {
  /** INSERT ... ON CONFLICT (event_id) DO NOTHING. true = novo; false = duplicado. Lança em falha do banco (webhook responde 500). */
  registrar(
    eventoId: string,
    nomeOriginal: string,
    conexaoIdExterno: string | null,
  ): Promise<boolean>;
  marcarProcessado(
    eventoId: string,
    resultado: { empresaId: Id | null; erro: string | null },
  ): Promise<void>;
  removerAntigos(antesDe: Date): Promise<number>;
}

export interface RepositorioDoPainel {
  fluxoMensal(
    empresaId: Id,
    periodo: PeriodoDoPainel,
  ): Promise<ResumoDoPainel["fluxoMensal"]>;
  gastosPorCategoria(
    empresaId: Id,
    periodo: PeriodoDoPainel,
  ): Promise<ResumoDoPainel["gastosPorCategoria"]>;
  resultadoPorCentroDeCusto(
    empresaId: Id,
    periodo: PeriodoDoPainel,
  ): Promise<ResumoDoPainel["resultadoPorCentroDeCusto"]>;
}

export interface RepositorioDeLimites {
  consumir(
    chave: string,
    maximo: number,
    janelaEmSegundos: number,
  ): Promise<boolean>; // rpc consumir_limite_de_requisicao
  removerAntigos(antesDe: Date): Promise<number>;
}
