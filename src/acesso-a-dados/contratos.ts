import "server-only";
import type {
  ContaDoProvedor,
  TransacaoDoProvedor,
} from "@/regras-de-negocio/conexao-bancaria/provedor-bancario";
import type { ResultadoDeCategorizacao } from "@/regras-de-negocio/categorizacao/estrategias/estrategia";
import type { CandidatoAConciliacao } from "@/regras-de-negocio/comprovantes/conciliacao";
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
  Comprovante,
  Conexao,
  Conta,
  DataISO,
  ErroDaConexao,
  Id,
  ImportacaoDeExtrato,
  PapelNaEmpresa,
  Regra,
  SituacaoDoComprovante,
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
  provedor?: Conexao["provedor"]; // padrão 'pluggy'
}

export interface RepositorioDeConexoes {
  salvar(
    empresaId: Id,
    dados: DadosDaConexao,
    criadoPor: Id | null,
  ): Promise<Conexao>; // upsert por (provedor, id_externo)
  buscarPorIdExterno(
    idExterno: string,
    provedor?: Conexao["provedor"], // padrão 'pluggy'
  ): Promise<Conexao | null>; // sem filtro de empresa: só o caminho do sistema usa
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
  /** Quais desses id_externo já existem (para contar novas × atualizadas na importação). */
  listarIdsExternosExistentes(
    empresaId: Id,
    idsExternos: readonly string[],
  ): Promise<string[]>;
  /** rpc candidatos_para_conciliacao: mesmo valor absoluto, data em ± tolerância. */
  candidatosParaConciliacao(
    empresaId: Id,
    filtro: { valorCentavos: Centavos; data: DataISO; toleranciaDias: number },
  ): Promise<CandidatoAConciliacao[]>;
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
  /** Anexos da transação, inclusive os arquivos dos comprovantes conciliados com ela. */
  listar(empresaId: Id, transacaoId: Id): Promise<Anexo[]>;
  buscarPorId(empresaId: Id, anexoId: Id): Promise<Anexo | null>;
  buscarPorComprovante(empresaId: Id, comprovanteId: Id): Promise<Anexo | null>;
  remover(empresaId: Id, anexoId: Id): Promise<void>;
}

/** Storage (bucket 'anexos'). */
export interface ArmazenamentoDeArquivos {
  enviar(caminho: string, conteudo: Blob, tipoMime: string): Promise<void>;
  baixar(caminho: string): Promise<Uint8Array>;
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

export interface RepositorioDeImportacoes {
  /** Só o service role insere (histórico imutável). */
  criar(
    empresaId: Id,
    dados: Omit<ImportacaoDeExtrato, "id" | "empresaId" | "criadaEm">,
  ): Promise<ImportacaoDeExtrato>;
  listar(empresaId: Id): Promise<ImportacaoDeExtrato[]>; // mais recentes primeiro
  /** Maior periodo_ate já importado para a conta (para não regredir o saldo). */
  ultimoFimDePeriodo(empresaId: Id, contaId: Id): Promise<DataISO | null>;
}

export type DadosDoComprovanteNoBanco = Partial<
  Omit<Comprovante, "id" | "empresaId" | "criadoEm" | "atualizadoEm" | "alerta">
>;

export interface RepositorioDeComprovantes {
  /** Cria em 'lendo'. */
  criar(empresaId: Id, enviadoPor: Id): Promise<Comprovante>;
  buscarPorId(empresaId: Id, comprovanteId: Id): Promise<Comprovante | null>;
  buscarPorChave(
    empresaId: Id,
    chaveDeAcesso: string,
  ): Promise<Comprovante | null>;
  /** Leituras pela IA desde `desde` (RNF-26): rpc leituras_de_comprovante_desde (envios e releituras). */
  contarLeiturasDesde(empresaId: Id, desde: Date): Promise<number>;
  /** Acrescenta `em` a leituras_ia_em (conta para o teto mensal). */
  registrarLeitura(empresaId: Id, comprovanteId: Id, em: Date): Promise<void>;
  /** Só service role (cron): empresas com comprovantes 'pendente'. */
  empresasComPendentes(): Promise<Id[]>;
  /** Dessas transações, quais já têm comprovante conciliado (RF-39: não são candidatas). */
  listarTransacoesConciliadas(
    empresaId: Id,
    transacaoIds: readonly Id[],
  ): Promise<Id[]>;
  listar(
    empresaId: Id,
    filtros?: { situacao?: SituacaoDoComprovante },
  ): Promise<Comprovante[]>; // mais recentes primeiro
  /** 23505 na chave de acesso → ErroDeNegocio('comprovante_duplicado'). */
  atualizar(
    empresaId: Id,
    comprovanteId: Id,
    dados: DadosDoComprovanteNoBanco,
  ): Promise<Comprovante>;
  /** Apaga também a linha do anexo (cascade); o arquivo no Storage fica com o serviço. */
  remover(empresaId: Id, comprovanteId: Id): Promise<void>;
}
