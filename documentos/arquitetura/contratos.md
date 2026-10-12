# Contratos dos módulos (TypeScript)

Estas interfaces são **implementadas literalmente** pelo engenheiro-backend. Mudar uma assinatura exige atualizar este documento (e, se mudar uma decisão, um ADR).

Regras gerais:
- Todo arquivo em `src/regras-de-negocio/**` e `src/acesso-a-dados/**` começa com `import 'server-only'`.
- Cada módulo expõe **somente** o que está no seu `index.ts`. Ninguém importa arquivos internos de outro módulo.
- Valores em dinheiro são `Centavos` (inteiro, negativo = saída). A conversão de/para `numeric(14,2)` acontece só nos repositórios.
- Datas contábeis são `DataISO` (`'YYYY-MM-DD'`). Instantes são `Date`.
- Erros esperados são `ErroDeNegocio`. Qualquer outro erro é falha inesperada: é logado sem dados sensíveis e vira "Algo deu errado" na interface.
- Repositórios recebem `empresaId` explicitamente em todo método (ver [visão geral §5](visao-geral.md#5-contexto-de-execução-e-clientes-do-supabase)).

---

## 1. Tipos compartilhados — `src/regras-de-negocio/tipos.ts`

```ts
export type Id = string;          // uuid
export type DataISO = string;     // 'YYYY-MM-DD'
export type Centavos = number;    // inteiro; negativo = saída

export type Sentido = 'entrada' | 'saida';
export type PapelNaEmpresa = 'dono' | 'membro';

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
  | 'atualizada'
  | 'atualizando'
  | 'aguardando_usuario'
  | 'erro_de_login'
  | 'desatualizada'
  | 'erro';

export interface ErroDaConexao {
  codigo: string;
  mensagem: string;
}

export interface Conexao {
  id: Id;
  empresaId: Id;
  provedor: 'pluggy';
  idExterno: string;
  banco: string | null;
  status: StatusDaConexao;
  erro: ErroDaConexao | null;
  consentimentoExpiraEm: Date | null;
  ultimaSincronizacaoEm: Date | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export type TipoDeConta = 'corrente' | 'poupanca' | 'cartao_de_credito';

export interface Conta {
  id: Id;
  empresaId: Id;
  conexaoId: Id;
  idExterno: string;
  nome: string;
  tipo: TipoDeConta;
  numeroFinal: string | null;   // só os 4 últimos dígitos
  saldoCentavos: Centavos;
  saldoAtualizadoEm: Date;
}

export type OrigemDaCategoria = 'regra' | 'ia' | 'usuario' | 'pluggy';

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
  confiancaIa: number | null;    // 0..1, só quando categoriaOrigem = 'ia'
  categorizacaoAutomaticaEm: Date | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export type TipoDeCategoria = 'entrada' | 'saida' | 'ambos';

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

export type CampoDaRegra = 'descricao' | 'contraparte';
export type OrigemDaRegra = 'padrao' | 'usuario' | 'correcao';

export interface Regra {
  id: Id;
  empresaId: Id;
  padrao: string;               // já normalizado
  campo: CampoDaRegra;
  prioridade: number;           // menor vence
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
  tipoMime: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  tamanhoBytes: number;
  criadoEm: Date;
}
```

## 2. Erros — `src/regras-de-negocio/erros.ts`

```ts
export type CodigoDeErro =
  | 'nao_autenticado'
  | 'email_nao_autorizado'
  | 'limite_excedido'
  | 'entrada_invalida'
  | 'nao_encontrado'
  | 'conexao_nao_encontrada'      // itemId não existe na aplicação Pluggy ou é de outra empresa
  | 'provedor_indisponivel'       // Pluggy fora ou erro 5xx
  | 'classificador_indisponivel'
  | 'recurso_desligado'           // feature flag
  | 'anexo_invalido';

export class ErroDeNegocio extends Error {
  constructor(
    readonly codigo: CodigoDeErro,
    readonly mensagemParaUsuario: string,  // pt-BR, segura para exibir
    options?: { cause?: unknown },
  ) {
    super(codigo, options);
    this.name = 'ErroDeNegocio';
  }
}

/** Retorno padrão de toda Server Action (src/app/**/acoes.ts). */
export type ResultadoDaAcao<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: { codigo: CodigoDeErro | 'inesperado'; mensagem: string } };
```

---

## 3. Conexão bancária — `src/regras-de-negocio/conexao-bancaria/`

### 3.1 Adaptador `ProvedorBancario` (`provedor-bancario.ts`)

Tipos neutros: nenhum tipo do `pluggy-sdk` atravessa esta interface.

```ts
import type { Centavos, DataISO, ErroDaConexao, StatusDaConexao, TipoDeConta } from '../tipos';

export interface ConexaoDoProvedor {
  idExterno: string;
  banco: string | null;
  status: StatusDaConexao;
  erro: ErroDaConexao | null;
  consentimentoExpiraEm: Date | null;
  ultimaAtualizacaoEm: Date | null;
  identificadorDoUsuario: string | null;   // clientUserId = empresaId
}

export interface ContaDoProvedor {
  idExterno: string;
  nome: string;
  tipo: TipoDeConta;
  numeroFinal: string | null;
  saldoCentavos: Centavos;
}

export interface TransacaoDoProvedor {
  idExterno: string;
  contaIdExterno: string;
  data: DataISO;
  descricao: string;
  descricaoOriginal: string | null;
  valorCentavos: Centavos;            // sinal pelo tipo: DEBIT => negativo, CREDIT => positivo
  pendente: boolean;
  contraparte: string | null;
  metodoDePagamento: string | null;
  categoriaDoProvedor: string | null;
}

/** `criadasDesde` e `dataDe` são mutuamente exclusivos (restrição da Pluggy). `ids`: até 500. */
export type FiltrosDeTransacoesDoProvedor =
  | { criadasDesde: Date; dataAte?: DataISO; ids?: undefined; dataDe?: undefined; cursor?: string }
  | { dataDe?: DataISO; dataAte?: DataISO; ids?: undefined; criadasDesde?: undefined; cursor?: string }
  | { ids: readonly string[]; criadasDesde?: undefined; dataDe?: undefined; dataAte?: undefined; cursor?: string };

export interface PaginaDeTransacoesDoProvedor {
  itens: TransacaoDoProvedor[];
  proximoCursor: string | null;
}

export const EVENTOS_DO_WEBHOOK = [
  'item/created',
  'item/updated',
  'item/error',
  'transactions/created',
  'transactions/updated',
  'transactions/deleted',
] as const;
export type NomeDoEventoDoProvedor = (typeof EVENTOS_DO_WEBHOOK)[number];

export type EventoDeWebhook =
  | { tipo: 'conexao_criada' | 'conexao_atualizada'; eventoId: string; nomeOriginal: string; conexaoIdExterno: string }
  | { tipo: 'conexao_com_erro'; eventoId: string; nomeOriginal: string; conexaoIdExterno: string; erro: ErroDaConexao }
  | { tipo: 'transacoes_criadas'; eventoId: string; nomeOriginal: string; conexaoIdExterno: string; contaIdExterno: string; criadasDesde: Date }
  | { tipo: 'transacoes_atualizadas' | 'transacoes_removidas'; eventoId: string; nomeOriginal: string; conexaoIdExterno: string; contaIdExterno: string; transacaoIdsExternos: string[] }
  | { tipo: 'ignorado'; eventoId: string; nomeOriginal: string; conexaoIdExterno: string | null };

export interface ProvedorBancario {
  /** Sem webhookUrl (ADR 0007). Com idExternoParaReconectar, abre o widget em modo de atualização/reconsentimento. */
  criarTokenDeConexao(opcoes: {
    identificadorDoUsuario: string;          // empresaId
    idExternoParaReconectar?: string;
  }): Promise<{ token: string }>;

  /** GET /items/{id}. Retorna null se o provedor responder 404 (não pertence à aplicação). */
  obterConexao(idExterno: string): Promise<ConexaoDoProvedor | null>;

  listarContas(conexaoIdExterno: string): Promise<ContaDoProvedor[]>;

  /** Uma página (paginação por cursor). Quem chama itera até proximoCursor === null. */
  listarTransacoes(
    contaIdExterno: string,
    filtros?: FiltrosDeTransacoesDoProvedor,
  ): Promise<PaginaDeTransacoesDoProvedor>;

  /** Cria ou atualiza (mesmo evento + mesma URL) os webhooks com os cabeçalhos secretos. Idempotente. */
  registrarWebhooks(opcoes: {
    url: string;                             // https:// obrigatório
    eventos: readonly NomeDoEventoDoProvedor[];
    cabecalhos: Record<string, string>;
  }): Promise<{ criados: NomeDoEventoDoProvedor[]; atualizados: NomeDoEventoDoProvedor[] }>;

  /** Valida (Zod) e traduz o corpo do webhook. Retorna null se o corpo for inválido. */
  interpretarWebhook(corpo: unknown): EventoDeWebhook | null;
}
```

Erros do adaptador: 404 → `null` (só em `obterConexao`). 401/403/5xx/rede → `ErroDeNegocio('provedor_indisponivel', …, { cause })`. O SDK rejeita com o **corpo da resposta** (objeto `{ code, message }`), não com `Error`, então o adaptador normaliza (ver [§10](#10-pluggy-sdk-0920-apis-reais-verificadas)).

### 3.2 Autenticação do webhook (`webhook.ts`)

```ts
/** Compara 'Bearer <segredo>' em tempo constante (crypto.timingSafeEqual sobre buffers de mesmo tamanho). Segredo vazio => false. */
export function webhookAutorizado(cabecalhoAuthorization: string | null, segredo: string | undefined): boolean;
```

### 3.3 Serviço (`servico.ts`)

```ts
export interface ServicoDeConexaoBancaria {
  /** Rate limit: 10/h por usuário. */
  iniciarConexao(ctx: ContextoDoUsuario, opcoes?: { conexaoIdParaReconectar?: Id }): Promise<{ token: string }>;

  /** Valida idExterno (uuid) e chama obterConexao: null => 'conexao_nao_encontrada';
   *  identificadorDoUsuario !== ctx.empresaId => 'conexao_nao_encontrada'. Upsert e retorno. */
  registrarConexao(ctx: ContextoDoUsuario, idExterno: string): Promise<Conexao>;

  listarConexoes(ctx: ContextoDoUsuario): Promise<Conexao[]>;
}

// index.ts
export type { ServicoDeConexaoBancaria, ProvedorBancario, EventoDeWebhook /* … */ };
export { webhookAutorizado, EVENTOS_DO_WEBHOOK };
```

---

## 4. Extrato — `src/regras-de-negocio/extrato/`

```ts
export interface ServicoDeSincronizacao {
  /** Chamado dentro de after() no webhook. Nunca lança: registra erro em eventos_webhook e no log. */
  processarEvento(evento: EventoDeWebhook): Promise<void>;

  /** Sincroniza contas (saldo) e transações de uma conexão. Sem criadasDesde => histórico completo.
   *  Ao final: marcarSincronizada e categorizacao.categorizarPendentes(empresaId). */
  sincronizarConexao(conexaoIdExterno: string, opcoes?: { criadasDesde?: Date }): Promise<{ transacoesGravadas: number }>;

  /** Usado pelo cron diário: todas as conexões, criadasDesde = agora − 7 dias. */
  ressincronizarTodas(): Promise<{ conexoes: number; falhas: number }>;

  /** Botão "Sincronizar agora". Rate limit 6/h por usuário. */
  sincronizarAgora(ctx: ContextoDoUsuario, conexaoId: Id): Promise<{ transacoesGravadas: number }>;
}

export interface FiltrosDoExtrato {
  dataDe?: DataISO;
  dataAte?: DataISO;
  categoriaId?: Id | 'sem_categoria';
  centroDeCustoId?: Id | 'sem_centro';
  sentido?: Sentido;
  busca?: string;          // até 100 caracteres; ilike em descricao e contraparte
  contaId?: Id;
  cursor?: string;         // opaco: base64url de `${data}|${id}`
  limite?: number;         // padrão 50, máximo 200
}

export interface PaginaDoExtrato {
  itens: Transacao[];
  proximoCursor: string | null;
}

export interface ServicoDeExtrato {
  listar(ctx: ContextoDoUsuario, filtros: FiltrosDoExtrato): Promise<PaginaDoExtrato>;
  obter(ctx: ContextoDoUsuario, transacaoId: Id): Promise<Transacao>;   // 'nao_encontrado'
}
```

---

## 5. Categorização — `src/regras-de-negocio/categorizacao/`

### 5.1 Strategy (`estrategias/estrategia.ts`)

```ts
export interface ContextoDeCategorizacao {
  empresaId: Id;
  regras: readonly Regra[];                 // só ativas, já ordenadas por prioridade asc, criadaEm asc
  categorias: readonly Categoria[];         // não arquivadas
  centrosDeCusto: readonly CentroDeCusto[]; // não arquivados
}

export interface ResultadoDeCategorizacao {
  transacaoId: Id;
  categoriaId: Id;
  centroDeCustoId: Id | null;
  origem: Exclude<OrigemDaCategoria, 'usuario'>;
  regraId: Id | null;
  confianca: number | null;   // só para 'ia'
}

export interface EstrategiaDeCategorizacao {
  readonly nome: 'regras' | 'provedor' | 'ia';
  /** Retorna resultados apenas para as transações que conseguiu categorizar. */
  categorizar(
    transacoes: readonly Transacao[],
    contexto: ContextoDeCategorizacao,
  ): Promise<ResultadoDeCategorizacao[]>;
}
```

Implementações, em ordem: `EstrategiaPorRegras`, `EstrategiaPorCategoriaDoProvedor` e `EstrategiaPorIa` (usa `Classificador`). Função pura auxiliar (`normalizar-texto.ts`):

```ts
/** Maiúsculas, sem acento (NFD + remoção de \p{M}), espaços colapsados, trim. */
export function normalizarTexto(texto: string): string;

/** true se normalizarTexto(campo da transação) contém regra.padrao. */
export function regraCorresponde(regra: Pick<Regra, 'padrao' | 'campo'>, transacao: Pick<Transacao, 'descricao' | 'contraparte'>): boolean;
```

### 5.2 `Classificador` (`classificador.ts`)

```ts
export interface ItemParaClassificar {
  referencia: string;        // opaco (índice do lote), NUNCA o id do banco
  descricao: string;
  valorCentavos: Centavos;
  contraparte: string | null;
}

export interface OpcaoDeCategoria { codigo: string; nome: string; tipo: TipoDeCategoria }
export interface OpcaoDeCentroDeCusto { codigo: string; nome: string }

export interface SugestaoDeCategoria {
  referencia: string;
  categoriaCodigo: string | null;      // null = não sabe
  centroDeCustoCodigo: string | null;
  confianca: number;                   // 0..1
}

export interface Classificador {
  /** Até 50 itens por chamada. Lança ErroDeNegocio('classificador_indisponivel') em falha de rede/API. */
  classificar(
    lote: readonly ItemParaClassificar[],
    opcoes: {
      categorias: readonly OpcaoDeCategoria[];
      centrosDeCusto: readonly OpcaoDeCentroDeCusto[];
    },
  ): Promise<SugestaoDeCategoria[]>;
}

export const LIMIAR_DE_CONFIANCA = 0.6;
export const TAMANHO_MAXIMO_DO_LOTE = 50;
```

Os `codigo` são curtos (`c1`, `c2`…, `k1`…) e montados pela `EstrategiaPorIa`, que mapeia de volta para `Id`. Assim a IA não vê nem inventa uuids e o lote gasta menos tokens. Uma sugestão com código desconhecido é descartada. A implementação está em `adaptadores/classificador-claude.ts` (ADR 0004).

### 5.3 Serviço (`servico.ts`)

```ts
export interface SugestaoDeRegra {
  padrao: string;                 // normalizado; contraparte se existir, senão a descrição sem dígitos
  campo: CampoDaRegra;
  categoriaId: Id;
  centroDeCustoId: Id | null;
  transacoesAfetadas: number;     // quantas outras não definidas pelo usuário seriam alteradas
}

export interface NovaRegra {
  padrao: string;                 // será normalizado
  campo: CampoDaRegra;
  categoriaId: Id;
  centroDeCustoId?: Id | null;
  prioridade?: number;            // padrão 50 para origem 'usuario'/'correcao'
  origem: Exclude<OrigemDaRegra, 'padrao'>;
  aplicarNasExistentes: boolean;  // reaplica em transações com categoria_definida_pelo_usuario = false
}

export interface ServicoDeCategorizacao {
  /** Pendentes = categoria_id null, categorizacao_automatica_em null, não definidas pelo usuário.
   *  Corrente: regras -> provedor -> IA (se RECURSO_CATEGORIZACAO_IA). Marca categorizacao_automatica_em em todas as processadas.
   *  Nunca lança por falha da IA: as transações ficam pendentes para a próxima vez (sem marcar). */
  categorizarPendentes(empresaId: Id, opcoes?: { limite?: number /* padrão 200 */ }): Promise<{ categorizadas: number; semSugestao: number }>;

  /** Define categoria e/ou centro de custo como usuário (categoria_origem = 'usuario', categoria_definida_pelo_usuario = true). */
  corrigirCategoria(
    ctx: ContextoDoUsuario,
    transacaoId: Id,
    dados: { categoriaId: Id | null; centroDeCustoId: Id | null },
  ): Promise<{ transacao: Transacao; sugestaoDeRegra: SugestaoDeRegra | null }>;

  criarRegra(ctx: ContextoDoUsuario, dados: NovaRegra): Promise<{ regra: Regra; transacoesAlteradas: number }>;
  atualizarRegra(ctx: ContextoDoUsuario, regraId: Id, dados: Partial<Pick<Regra, 'padrao' | 'campo' | 'prioridade' | 'categoriaId' | 'centroDeCustoId' | 'ativa'>>): Promise<Regra>;
  removerRegra(ctx: ContextoDoUsuario, regraId: Id): Promise<void>;
  listarRegras(ctx: ContextoDoUsuario): Promise<Regra[]>;

  listarCategorias(ctx: ContextoDoUsuario, opcoes?: { incluirArquivadas?: boolean }): Promise<Categoria[]>;
  criarCategoria(ctx: ContextoDoUsuario, dados: { nome: string; tipo: TipoDeCategoria; entraNoResultado?: boolean }): Promise<Categoria>;
  atualizarCategoria(ctx: ContextoDoUsuario, categoriaId: Id, dados: Partial<Pick<Categoria, 'nome' | 'tipo' | 'entraNoResultado' | 'arquivada'>>): Promise<Categoria>;
}
```

---

## 6. Centros de custo — `src/regras-de-negocio/centros-de-custo/`

```ts
export interface ServicoDeCentrosDeCusto {
  listar(ctx: ContextoDoUsuario, opcoes?: { incluirArquivados?: boolean }): Promise<CentroDeCusto[]>;
  criar(ctx: ContextoDoUsuario, dados: { nome: string }): Promise<CentroDeCusto>;
  atualizar(ctx: ContextoDoUsuario, centroDeCustoId: Id, dados: Partial<Pick<CentroDeCusto, 'nome' | 'arquivado'>>): Promise<CentroDeCusto>;
}
```

## 7. Painel — `src/regras-de-negocio/painel/`

```ts
export interface PeriodoDoPainel { de: DataISO; ate: DataISO }   // máximo de 24 meses

export interface ResumoDoPainel {
  periodo: PeriodoDoPainel;
  saldoAtualCentavos: Centavos;
  saldoAtualizadoEm: Date | null;
  fluxoMensal: Array<{ mes: string /* 'YYYY-MM' */; entradasCentavos: Centavos; saidasCentavos: Centavos /* positivo */; resultadoCentavos: Centavos }>;
  gastosPorCategoria: Array<{ categoriaId: Id | null; nome: string; totalCentavos: Centavos /* positivo */; quantidade: number }>;
  resultadoPorCentroDeCusto: Array<{ centroDeCustoId: Id | null; nome: string; entradasCentavos: Centavos; saidasCentavos: Centavos; resultadoCentavos: Centavos }>;
  transacoesSemCategoria: number;
}

export interface ServicoDoPainel {
  obterResumo(ctx: ContextoDoUsuario, periodo: PeriodoDoPainel): Promise<ResumoDoPainel>;
}
```

Regras: exclui transações `pendente = true` e categorias com `entraNoResultado = false`. `null` = "Sem categoria" / "Sem centro de custo". Os meses sem movimento aparecem com zeros.

## 8. Anexos — `src/regras-de-negocio/anexos/`

```ts
export interface ServicoDeAnexos {
  /** Requer RECURSO_ANEXOS. Valida tipo (pelos bytes iniciais, não só pelo MIME declarado) e tamanho ≤ 10 MB. Rate limit 30/h. */
  anexar(ctx: ContextoDoUsuario, transacaoId: Id, arquivo: File): Promise<Anexo>;
  listar(ctx: ContextoDoUsuario, transacaoId: Id): Promise<Anexo[]>;
  /** URL assinada válida por 60 s. */
  gerarLinkTemporario(ctx: ContextoDoUsuario, anexoId: Id): Promise<{ url: string; expiraEm: Date }>;
  remover(ctx: ContextoDoUsuario, anexoId: Id): Promise<void>;
}
```

## 9. Acesso — `src/regras-de-negocio/acesso/`

```ts
/** Lê a sessão (supabase.auth.getClaims()), confere a allowlist e resolve a empresa.
 *  Lança 'nao_autenticado' ou 'email_nao_autorizado'. Chamada em TODA Server Action, Route Handler e página protegida. */
export function obterContextoDoUsuario(): Promise<ContextoDoUsuario>;

/** EMAIL_AUTORIZADO aceita uma lista separada por vírgulas; comparação case-insensitive após trim. */
export function emailAutorizado(email: string | null | undefined): boolean;

/** Envia o link mágico só se emailAutorizado(email). Para e-mail não autorizado, responde igual (sem revelar a allowlist).
 *  Rate limit: 5/15 min por IP e 3/15 min por e-mail. */
export function enviarLinkMagico(email: string, ip: string | null): Promise<void>;

/** Callback: troca o code pela sessão, confere a allowlist (se falhar: signOut + 'email_nao_autorizado'), chama garantir_empresa. */
export function confirmarEntrada(code: string): Promise<{ empresaId: Id }>;

export function sair(): Promise<void>;

/** true = pode seguir. A chave é montada com hash SHA-256 de IP/e-mail (nunca em texto puro). */
export function consumirLimite(chave: string, limite: { maximo: number; janelaEmSegundos: number }): Promise<boolean>;
```

## 10. Repositórios — `src/acesso-a-dados/`

Implementados sobre `SupabaseClient<BancoDeDados>` (tipos gerados com `supabase gen types typescript` em `src/acesso-a-dados/supabase/tipos-do-banco.ts`). Cada repositório recebe o cliente no construtor: o do usuário (RLS) ou o do sistema (service role).

```ts
export interface RepositorioDeEmpresas {
  garantirEmpresaDoUsuario(nomeSugerido: string): Promise<Id>;            // rpc garantir_empresa
  obterMembershipDoUsuario(usuarioId: Id): Promise<{ empresaId: Id; papel: PapelNaEmpresa } | null>;
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
  salvar(empresaId: Id, dados: DadosDaConexao, criadoPor: Id | null): Promise<Conexao>;   // upsert por (provedor, id_externo)
  buscarPorIdExterno(idExterno: string): Promise<Conexao | null>;                           // sem filtro de empresa: só o caminho do sistema usa
  buscarPorId(empresaId: Id, conexaoId: Id): Promise<Conexao | null>;
  listar(empresaId: Id): Promise<Conexao[]>;
  listarTodas(): Promise<Conexao[]>;                                                       // só o cron (service role)
  atualizarStatus(empresaId: Id, conexaoId: Id, dados: Omit<DadosDaConexao, 'idExterno' | 'banco'>): Promise<void>;
  marcarSincronizada(empresaId: Id, conexaoId: Id, em: Date): Promise<void>;
}

export interface RepositorioDeContas {
  salvarVarias(empresaId: Id, conexaoId: Id, contas: readonly ContaDoProvedor[]): Promise<Conta[]>;   // upsert por (conexao_id, id_externo)
  listar(empresaId: Id): Promise<Conta[]>;
  obterSaldoTotal(empresaId: Id): Promise<{ saldoCentavos: Centavos; atualizadoEm: Date | null }>;     // corrente + poupança
}

export interface RepositorioDeTransacoes {
  /** Upsert por (empresa_id, id_externo); NUNCA altera colunas de categoria. Retorna quantas linhas gravou. */
  salvarDoProvedor(
    empresaId: Id,
    conexaoId: Id,
    linhas: ReadonlyArray<TransacaoDoProvedor & { contaId: Id }>,
  ): Promise<number>;
  removerPorIdsExternos(empresaId: Id, idsExternos: readonly string[]): Promise<number>;
  listar(empresaId: Id, filtros: FiltrosDoExtrato): Promise<PaginaDoExtrato>;
  buscarPorId(empresaId: Id, transacaoId: Id): Promise<Transacao | null>;
  listarPendentesDeCategorizacao(empresaId: Id, limite: number): Promise<Transacao[]>;
  /** UPDATE ... WHERE categoria_definida_pelo_usuario = false. Também marca categorizacao_automatica_em = now(). */
  aplicarCategorizacaoAutomatica(empresaId: Id, resultados: readonly ResultadoDeCategorizacao[]): Promise<number>;
  marcarCategorizacaoTentada(empresaId: Id, transacaoIds: readonly Id[]): Promise<void>;
  definirCategoriaPeloUsuario(empresaId: Id, transacaoId: Id, dados: { categoriaId: Id | null; centroDeCustoId: Id | null }): Promise<Transacao>;
  /** Transações não definidas pelo usuário cujo campo normalizado contém o padrão (para sugerir ou aplicar regra). */
  listarCorrespondentesARegra(empresaId: Id, regra: Pick<Regra, 'padrao' | 'campo'>, opcoes: { excluirId?: Id; limite: number }): Promise<Transacao[]>;
  contarSemCategoria(empresaId: Id, periodo?: { de: DataISO; ate: DataISO }): Promise<number>;
}

export interface RepositorioDeCategorias {
  listar(empresaId: Id, opcoes?: { incluirArquivadas?: boolean }): Promise<Categoria[]>;
  criar(empresaId: Id, dados: { nome: string; tipo: TipoDeCategoria; entraNoResultado: boolean }): Promise<Categoria>;
  atualizar(empresaId: Id, categoriaId: Id, dados: Partial<Pick<Categoria, 'nome' | 'tipo' | 'entraNoResultado' | 'arquivada'>>): Promise<Categoria>;
}

export interface RepositorioDeCentrosDeCusto {
  listar(empresaId: Id, opcoes?: { incluirArquivados?: boolean }): Promise<CentroDeCusto[]>;
  criar(empresaId: Id, dados: { nome: string }): Promise<CentroDeCusto>;
  atualizar(empresaId: Id, centroDeCustoId: Id, dados: Partial<Pick<CentroDeCusto, 'nome' | 'arquivado'>>): Promise<CentroDeCusto>;
}

export interface RepositorioDeRegras {
  listarAtivas(empresaId: Id): Promise<Regra[]>;       // ordenadas por prioridade asc, criado_em asc
  listar(empresaId: Id): Promise<Regra[]>;
  criar(empresaId: Id, dados: Omit<Regra, 'id' | 'empresaId' | 'criadaEm' | 'ativa'>): Promise<Regra>;
  atualizar(empresaId: Id, regraId: Id, dados: Partial<Pick<Regra, 'padrao' | 'campo' | 'prioridade' | 'categoriaId' | 'centroDeCustoId' | 'ativa'>>): Promise<Regra>;
  remover(empresaId: Id, regraId: Id): Promise<void>;
}

export interface RepositorioDeAnexos {
  criar(empresaId: Id, dados: Omit<Anexo, 'id' | 'empresaId' | 'criadoEm'>, enviadoPor: Id): Promise<Anexo>;
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
  registrar(eventoId: string, nomeOriginal: string, conexaoIdExterno: string | null): Promise<boolean>;
  marcarProcessado(eventoId: string, resultado: { empresaId: Id | null; erro: string | null }): Promise<void>;
  removerAntigos(antesDe: Date): Promise<number>;
}

export interface RepositorioDoPainel {
  fluxoMensal(empresaId: Id, periodo: PeriodoDoPainel): Promise<ResumoDoPainel['fluxoMensal']>;
  gastosPorCategoria(empresaId: Id, periodo: PeriodoDoPainel): Promise<ResumoDoPainel['gastosPorCategoria']>;
  resultadoPorCentroDeCusto(empresaId: Id, periodo: PeriodoDoPainel): Promise<ResumoDoPainel['resultadoPorCentroDeCusto']>;
}

export interface RepositorioDeLimites {
  consumir(chave: string, maximo: number, janelaEmSegundos: number): Promise<boolean>;   // rpc consumir_limite_de_requisicao
  removerAntigos(antesDe: Date): Promise<number>;
}
```

## 11. Raiz de composição — `src/regras-de-negocio/montagem.ts`

```ts
export interface ServicosDoUsuario {
  ctx: ContextoDoUsuario;
  conexoes: ServicoDeConexaoBancaria;
  extrato: ServicoDeExtrato;
  sincronizacao: Pick<ServicoDeSincronizacao, 'sincronizarAgora'>;
  categorizacao: ServicoDeCategorizacao;
  centrosDeCusto: ServicoDeCentrosDeCusto;
  painel: ServicoDoPainel;
  anexos: ServicoDeAnexos;
}

/** Cliente com cookies (RLS). Chama obterContextoDoUsuario() — lança se não autenticado/autorizado. */
export function servicosDoUsuario(): Promise<ServicosDoUsuario>;

export interface ServicosDoSistema {
  provedor: ProvedorBancario;
  eventos: RepositorioDeEventosDeWebhook;
  sincronizacao: ServicoDeSincronizacao;
  limites: RepositorioDeLimites;
  limpeza(): Promise<void>;   // eventos > 90 dias, limites > 1 dia
}

/** Service role. Só para webhook, cron e rate limit. */
export function servicosDoSistema(): ServicosDoSistema;
```

Uso esperado no webhook (`src/app/api/webhooks/pluggy/route.ts`):

```ts
import { after } from 'next/server';
export const maxDuration = 60;

export async function POST(requisicao: Request) {
  if (!webhookAutorizado(requisicao.headers.get('authorization'), ambiente.PLUGGY_WEBHOOK_SECRET))
    return Response.json({ erro: 'não autorizado' }, { status: 401 });
  const sistema = servicosDoSistema();
  const evento = sistema.provedor.interpretarWebhook(await requisicao.json().catch(() => null));
  if (!evento) return Response.json({ erro: 'payload inválido' }, { status: 400 });
  const novo = await sistema.eventos.registrar(evento.eventoId, evento.nomeOriginal, evento.conexaoIdExterno); // falha => 500 (reenvio)
  if (!novo) return Response.json({ recebido: true, duplicado: true });
  after(() => sistema.sincronizacao.processarEvento(evento));
  return Response.json({ recebido: true });
}
```

---

## 12. `pluggy-sdk` 0.92.0: APIs reais verificadas

Verificado em `node_modules/pluggy-sdk/dist/*.d.ts` e `baseApi.js`. **Diferente do SDK Python**: no Node **existe** `PluggyClient`, e ele cuida sozinho da API Key.

| Necessidade | API real (Node) | Observações |
|---|---|---|
| Autenticação | `new PluggyClient({ clientId, clientSecret, baseUrl? })` | `BaseApi.getApiKey()` faz `POST /auth` e guarda a API Key em memória, renovando quando o JWT expira (`isJwtExpired`). Não precisa de cache manual. Crie **um cliente por módulo** (singleton preguiçoso) |
| Connect token | `createConnectToken(itemId?: string, options?: ConnectTokenOptions): Promise<{ accessToken: string }>` | `ConnectTokenOptions = { webhookUrl?, clientUserId?, oauthRedirectUri?, avoidDuplicates?, connectorSortAlphabetically? }`. Usamos `createConnectToken(idExternoParaReconectar, { clientUserId: empresaId, avoidDuplicates: true })`, **sem `webhookUrl`**. Passar `itemId` gera um token para atualizar ou reconsentir aquele item |
| Item (conexão) | `fetchItem(id: string): Promise<Item>` | `Item.status: 'UPDATED' \| 'UPDATING' \| 'WAITING_USER_INPUT' \| 'WAITING_USER_ACTION' \| 'MERGING' \| 'LOGIN_ERROR' \| 'OUTDATED'`; `executionStatus`; `error: { code, message } \| null`; `connector.name`; `clientUserId`; `consentExpiresAt: Date \| null`; `lastUpdatedAt`. `fetchItemsCursor`/`fetchAllItems` só existem em plano pago com liberação: **não usar** |
| Contas | `fetchAccounts(itemId: string, type?: 'BANK' \| 'CREDIT'): Promise<PageResponse<Account>>` | `Account: { id, itemId, type, subtype: 'CHECKING_ACCOUNT' \| 'SAVINGS_ACCOUNT' \| 'CREDIT_CARD', number, balance, name, marketingName, currencyCode, … }` |
| Transações (recomendado) | `fetchTransactionsCursor(accountId, options?: TransactionCursorFilters): Promise<CursorPageResponse<Transaction>>` | `TransactionCursorFilters = { dateFrom?, dateTo?, createdAtFrom?, after?, ids? }`. **`createdAtFrom` e `dateFrom` são mutuamente exclusivos**, e `ids` aceita no máximo 500. `CursorPageResponse = { results, next: string \| null }`, em que `next` é um link/querystring: extraia `after` com `new URL(next, 'https://x').searchParams.get('after')` |
| Transações (todas) | `fetchAllTransactions(accountId, options?)` | Segue o cursor sozinho. Útil para sincronização completa |
| Transações (legado) | `fetchTransactions(accountId, TransactionFilters)` | **`@deprecated`** (por página). Não usar |
| Transação | `Transaction: { id, accountId, date: Date, description, descriptionRaw, type: 'DEBIT' \| 'CREDIT', amount, balance, currencyCode, category, categoryId, status?: 'PENDING' \| 'POSTED', paymentData?: { payer?, receiver?, paymentMethod?, … }, merchant?: { name?, businessName, cnpj }, operationType, createdAt, updatedAt }` | Contraparte: `type === 'DEBIT' ? paymentData.receiver.name : paymentData.payer.name`, com fallback `merchant.name ?? merchant.businessName`. **Não** persistir `documentNumber`, `accountNumber`, `cnpj` |
| Webhooks | `fetchWebhooks(): Promise<PageResponse<Webhook>>`, `createWebhook(event, url, headers?)`, `updateWebhook(id, { url?, event?, headers?, enabled? })`, `deleteWebhook(id)` | Atenção: `createWebhook` recebe **argumentos posicionais**, não um objeto. `Webhook: { id, url, event, createdAt, updatedAt, disabledAt }` |
| Payload do webhook | tipo `WebhookEventPayload` (união discriminada por `event`) | Campos: `eventId` (use este, `id` é deprecated), `itemId`; `item/error` tem `error: { code, message }`; `transactions/created` tem `accountId`, `transactionsCreatedAtFrom` (ISO) e `createdTransactionsLink`; `transactions/updated` e `transactions/deleted` têm `accountId`, `transactionIds[]` e `clientId`. A constante `WEBHOOK_EVENTS` lista todos os eventos |
| Erros | promessa rejeitada com o **corpo** da resposta HTTP (objeto, normalmente `{ code: number, message: string }`), não com `Error` | O SDK também faz `console.error('[Pluggy SDK] HTTP request failed…', body)`: o corpo não contém credenciais, mas o adaptador não deve logar de novo. 404 em `fetchItem` → `code === 404` |

Mapeamentos fixos do adaptador:

```ts
// ItemStatus -> StatusDaConexao
UPDATED -> 'atualizada'; UPDATING | MERGING -> 'atualizando';
WAITING_USER_INPUT | WAITING_USER_ACTION -> 'aguardando_usuario';
LOGIN_ERROR -> 'erro_de_login'; OUTDATED -> 'desatualizada'
// (evento item/error sem status mais específico -> 'erro')

// Account.subtype -> TipoDeConta
CHECKING_ACCOUNT -> 'corrente'; SAVINGS_ACCOUNT -> 'poupanca'; CREDIT_CARD -> 'cartao_de_credito'

// valor
valorCentavos = Math.round(Math.abs(amount) * 100) * (type === 'DEBIT' ? -1 : 1)

// data
data = date.toISOString().slice(0, 10)

// numeroFinal
numeroFinal = number ? number.replace(/\D/g, '').slice(-4) || null : null
```

`react-pluggy-connect` 2.12.0 (cliente; props de `PluggyConnectProps` de `pluggy-connect-sdk`, conferidas): `<PluggyConnect connectToken includeSandbox? updateItem? connectorIds? selectedConnectorId? onSuccess={({ item }) => …} onError onClose onLoadError />`. Para reconectar, passe o token criado com `itemId` e `updateItem={idExterno}`. Em produção, `selectedConnectorId={627}` (Sicredi Empresas, Open Finance, segundo o `CONTEXTO.md`) pula a escolha do banco. Confirme o id do conector no sandbox antes de fixar o valor.
