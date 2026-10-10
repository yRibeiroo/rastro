// Falsos em memória (sem rede, sem banco) para os testes de unidade.
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import type {
  DadosDaConexao,
  RepositorioDeCategorias,
  RepositorioDeCentrosDeCusto,
  RepositorioDeConexoes,
  RepositorioDeContas,
  RepositorioDeEventosDeWebhook,
  RepositorioDeRegras,
  RepositorioDeTransacoes,
} from "@/acesso-a-dados/contratos";
import { regraCorresponde } from "@/regras-de-negocio/categorizacao";
import type {
  ConexaoDoProvedor,
  ContaDoProvedor,
  EventoDeWebhook,
  PaginaDeTransacoesDoProvedor,
  ProvedorBancario,
  TransacaoDoProvedor,
} from "@/regras-de-negocio/conexao-bancaria";
import type {
  Categoria,
  CentroDeCusto,
  Conexao,
  Conta,
  ContextoDoUsuario,
  Regra,
  Transacao,
} from "@/regras-de-negocio/tipos";

export const EMPRESA = "11111111-2222-4333-8444-555555555555";
export const OUTRA_EMPRESA = "99999999-2222-4333-8444-555555555555";
export const USUARIO = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
export const ITEM = "7c1d9a52-4c3e-4f8b-9a3e-2b6f0d1e5a01";
export const CONTA_EXTERNA = "0b4d6f3a-91c2-4e6a-8d7f-5a2c1b3e9f10";

export const ctx: ContextoDoUsuario = {
  usuarioId: USUARIO,
  email: "davi@hometec.com.br",
  empresaId: EMPRESA,
  papel: "dono",
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** Lê uma fixture como o pluggy-sdk entrega (datas ISO viram Date). */
export function fixture<T = unknown>(nome: string): T {
  const texto = readFileSync(
    new URL(`../../fixtures/pluggy/${nome}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(texto, (_c, v) =>
    typeof v === "string" && ISO.test(v) ? new Date(v) : v,
  ) as T;
}
/** Fixture crua (como chega no corpo do webhook). */
export function fixtureCrua<T = unknown>(nome: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../fixtures/pluggy/${nome}`, import.meta.url), "utf8"),
  ) as T;
}

let sequencia = 0;
export const novoId = () =>
  `00000000-0000-4000-8000-${String(++sequencia).padStart(12, "0")}`;

export function umaTransacao(parcial: Partial<Transacao> = {}): Transacao {
  return {
    id: novoId(),
    empresaId: EMPRESA,
    conexaoId: novoId(),
    contaId: novoId(),
    idExterno: novoId(),
    data: "2026-10-01",
    descricao: "PIX ENVIADO FULANO",
    descricaoOriginal: null,
    valorCentavos: -1000,
    pendente: false,
    contraparte: null,
    metodoDePagamento: null,
    categoriaDoProvedor: null,
    categoriaId: null,
    centroDeCustoId: null,
    categoriaOrigem: null,
    categoriaDefinidaPeloUsuario: false,
    regraId: null,
    confiancaIa: null,
    categorizacaoAutomaticaEm: null,
    criadaEm: new Date("2026-10-01T12:00:00Z"),
    atualizadaEm: new Date("2026-10-01T12:00:00Z"),
    ...parcial,
  };
}

export function umaCategoria(parcial: Partial<Categoria> = {}): Categoria {
  return {
    id: novoId(),
    empresaId: EMPRESA,
    nome: "Combustível",
    tipo: "saida",
    entraNoResultado: true,
    padrao: true,
    arquivada: false,
    ...parcial,
  };
}

export function umaRegra(parcial: Partial<Regra> = {}): Regra {
  return {
    id: novoId(),
    empresaId: EMPRESA,
    padrao: "POSTO",
    campo: "descricao",
    prioridade: 100,
    categoriaId: novoId(),
    centroDeCustoId: null,
    origem: "padrao",
    ativa: true,
    criadaEm: new Date("2026-10-01T00:00:00Z"),
    ...parcial,
  };
}

export function umaConexao(parcial: Partial<Conexao> = {}): Conexao {
  return {
    id: novoId(),
    empresaId: EMPRESA,
    provedor: "pluggy",
    idExterno: ITEM,
    banco: "Sicredi Empresas",
    status: "atualizada",
    erro: null,
    consentimentoExpiraEm: null,
    ultimaSincronizacaoEm: null,
    criadaEm: new Date("2026-10-01T00:00:00Z"),
    atualizadaEm: new Date("2026-10-01T00:00:00Z"),
    ...parcial,
  };
}

/** Transações em memória que respeitam a regra do banco: categoria do usuário nunca é sobrescrita. */
export class TransacoesEmMemoria implements RepositorioDeTransacoes {
  linhas: Transacao[] = [];
  constructor(iniciais: Transacao[] = []) {
    this.linhas = iniciais.map((t) => ({ ...t }));
  }
  async salvarDoProvedor(
    empresaId: string,
    conexaoId: string,
    linhas: ReadonlyArray<TransacaoDoProvedor & { contaId: string }>,
  ) {
    for (const l of linhas) {
      const atual = this.linhas.find(
        (t) => t.empresaId === empresaId && t.idExterno === l.idExterno,
      );
      const dados = {
        conexaoId,
        contaId: l.contaId,
        data: l.data,
        descricao: l.descricao,
        descricaoOriginal: l.descricaoOriginal,
        valorCentavos: l.valorCentavos,
        pendente: l.pendente,
        contraparte: l.contraparte,
        metodoDePagamento: l.metodoDePagamento,
        categoriaDoProvedor: l.categoriaDoProvedor,
      };
      if (atual) Object.assign(atual, dados);
      else
        this.linhas.push(
          umaTransacao({ empresaId, idExterno: l.idExterno, ...dados }),
        );
    }
    return linhas.length;
  }
  async removerPorIdsExternos(empresaId: string, ids: readonly string[]) {
    const antes = this.linhas.length;
    this.linhas = this.linhas.filter(
      (t) => !(t.empresaId === empresaId && ids.includes(t.idExterno)),
    );
    return antes - this.linhas.length;
  }
  listar = vi.fn(async () => ({ itens: this.linhas, proximoCursor: null }));
  async buscarPorId(empresaId: string, id: string) {
    const t = this.linhas.find((x) => x.empresaId === empresaId && x.id === id);
    return t ? { ...t } : null; // cópia, como o banco
  }
  async listarPendentesDeCategorizacao(empresaId: string, limite: number) {
    return this.linhas
      .filter(
        (t) =>
          t.empresaId === empresaId &&
          t.categoriaId === null &&
          t.categorizacaoAutomaticaEm === null &&
          !t.categoriaDefinidaPeloUsuario,
      )
      .slice(0, limite);
  }
  async aplicarCategorizacaoAutomatica(
    empresaId: string,
    resultados: readonly {
      transacaoId: string;
      categoriaId: string;
      centroDeCustoId: string | null;
      origem: "regra" | "ia" | "pluggy";
      regraId: string | null;
      confianca: number | null;
    }[],
  ) {
    let n = 0;
    for (const r of resultados) {
      const t = this.linhas.find(
        (x) => x.id === r.transacaoId && x.empresaId === empresaId,
      );
      if (!t || t.categoriaDefinidaPeloUsuario) continue;
      Object.assign(t, {
        categoriaId: r.categoriaId,
        centroDeCustoId: r.centroDeCustoId,
        categoriaOrigem: r.origem,
        regraId: r.regraId,
        confiancaIa: r.origem === "ia" ? r.confianca : null,
        categorizacaoAutomaticaEm: new Date(),
      });
      n++;
    }
    return n;
  }
  async marcarCategorizacaoTentada(empresaId: string, ids: readonly string[]) {
    for (const t of this.linhas)
      if (t.empresaId === empresaId && ids.includes(t.id) && !t.categoriaDefinidaPeloUsuario)
        t.categorizacaoAutomaticaEm = new Date();
  }
  async definirCategoriaPeloUsuario(
    empresaId: string,
    id: string,
    dados: { categoriaId: string | null; centroDeCustoId: string | null },
  ) {
    const t = this.linhas.find((x) => x.id === id && x.empresaId === empresaId)!;
    Object.assign(t, {
      ...dados,
      categoriaOrigem: "usuario",
      categoriaDefinidaPeloUsuario: true,
      regraId: null,
      confiancaIa: null,
    });
    return { ...t };
  }
  async listarCorrespondentesARegra(
    empresaId: string,
    regra: Pick<Regra, "padrao" | "campo">,
    opcoes: { excluirId?: string; limite: number },
  ) {
    return this.linhas
      .filter(
        (t) =>
          t.empresaId === empresaId &&
          !t.categoriaDefinidaPeloUsuario &&
          t.id !== opcoes.excluirId &&
          regraCorresponde(regra, t),
      )
      .slice(0, opcoes.limite);
  }
  contarSemCategoria = vi.fn(async () => 3);
}

export class ConexoesEmMemoria implements RepositorioDeConexoes {
  constructor(public linhas: Conexao[] = []) {}
  async salvar(empresaId: string, dados: DadosDaConexao, _criadoPor: string | null) {
    const atual = this.linhas.find((c) => c.idExterno === dados.idExterno);
    if (atual) {
      Object.assign(atual, dados);
      return atual;
    }
    const nova = umaConexao({ empresaId, ...dados });
    this.linhas.push(nova);
    return nova;
  }
  async buscarPorIdExterno(idExterno: string) {
    return this.linhas.find((c) => c.idExterno === idExterno) ?? null;
  }
  async buscarPorId(empresaId: string, id: string) {
    return this.linhas.find((c) => c.empresaId === empresaId && c.id === id) ?? null;
  }
  async listar(empresaId: string) {
    return this.linhas.filter((c) => c.empresaId === empresaId);
  }
  async listarTodas() {
    return this.linhas;
  }
  atualizarStatus = vi.fn(
    async (
      _e: string,
      id: string,
      dados: Omit<DadosDaConexao, "idExterno" | "banco">,
    ) => {
      Object.assign(this.linhas.find((c) => c.id === id)!, dados);
    },
  );
  marcarSincronizada = vi.fn(async (_e: string, id: string, em: Date) => {
    this.linhas.find((c) => c.id === id)!.ultimaSincronizacaoEm = em;
  });
}

export class ContasEmMemoria implements RepositorioDeContas {
  linhas: Conta[] = [];
  async salvarVarias(empresaId: string, conexaoId: string, contas: readonly ContaDoProvedor[]) {
    return contas.map((c) => {
      let conta = this.linhas.find(
        (x) => x.conexaoId === conexaoId && x.idExterno === c.idExterno,
      );
      if (!conta) {
        conta = {
          id: novoId(),
          empresaId,
          conexaoId,
          idExterno: c.idExterno,
          nome: c.nome,
          tipo: c.tipo,
          numeroFinal: c.numeroFinal,
          saldoCentavos: c.saldoCentavos,
          saldoAtualizadoEm: new Date(),
        };
        this.linhas.push(conta);
      } else conta.saldoCentavos = c.saldoCentavos;
      return conta;
    });
  }
  async listar(empresaId: string) {
    return this.linhas.filter((c) => c.empresaId === empresaId);
  }
  obterSaldoTotal = vi.fn(async () => ({
    saldoCentavos: 1523456,
    atualizadoEm: new Date("2026-10-09T11:00:00Z"),
  }));
}

export class EventosEmMemoria implements RepositorioDeEventosDeWebhook {
  vistos = new Map<string, { empresaId: string | null; erro: string | null } | null>();
  async registrar(eventoId: string) {
    if (this.vistos.has(eventoId)) return false;
    this.vistos.set(eventoId, null);
    return true;
  }
  marcarProcessado = vi.fn(
    async (eventoId: string, r: { empresaId: string | null; erro: string | null }) => {
      this.vistos.set(eventoId, r);
    },
  );
  removerAntigos = vi.fn(async () => 0);
}

export class RegrasEmMemoria implements RepositorioDeRegras {
  constructor(public linhas: Regra[] = []) {}
  async listarAtivas(empresaId: string) {
    return this.linhas
      .filter((r) => r.empresaId === empresaId && r.ativa)
      .sort((a, b) => a.prioridade - b.prioridade || +a.criadaEm - +b.criadaEm);
  }
  async listar(empresaId: string) {
    return this.linhas.filter((r) => r.empresaId === empresaId);
  }
  async criar(empresaId: string, dados: Omit<Regra, "id" | "empresaId" | "criadaEm" | "ativa">) {
    const regra = umaRegra({ empresaId, ...dados, criadaEm: new Date() });
    this.linhas.push(regra);
    return regra;
  }
  atualizar = vi.fn(async (_e: string, id: string, dados: Partial<Regra>) => {
    const r = this.linhas.find((x) => x.id === id)!;
    Object.assign(r, dados);
    return r;
  });
  remover = vi.fn(async () => {});
}

export class CategoriasEmMemoria implements RepositorioDeCategorias {
  constructor(public linhas: Categoria[] = []) {}
  async listar(empresaId: string, opcoes?: { incluirArquivadas?: boolean }) {
    return this.linhas.filter(
      (c) => c.empresaId === empresaId && (opcoes?.incluirArquivadas || !c.arquivada),
    );
  }
  criar = vi.fn(async (empresaId: string, dados: { nome: string; tipo: Categoria["tipo"]; entraNoResultado: boolean }) =>
    umaCategoria({ empresaId, ...dados, padrao: false }),
  );
  atualizar = vi.fn(async (_e: string, id: string, dados: Partial<Categoria>) => ({
    ...umaCategoria({ id }),
    ...dados,
  }));
}

export class CentrosEmMemoria implements RepositorioDeCentrosDeCusto {
  constructor(public linhas: CentroDeCusto[] = []) {}
  async listar(empresaId: string, opcoes?: { incluirArquivados?: boolean }) {
    return this.linhas.filter(
      (c) => c.empresaId === empresaId && (opcoes?.incluirArquivados || !c.arquivado),
    );
  }
  criar = vi.fn(async (empresaId: string, dados: { nome: string }) => ({
    id: novoId(),
    empresaId,
    nome: dados.nome,
    padrao: false,
    arquivado: false,
  }));
  atualizar = vi.fn(async (empresaId: string, id: string, dados: Partial<CentroDeCusto>) => ({
    id,
    empresaId,
    nome: "Elétrica",
    padrao: false,
    arquivado: false,
    ...dados,
  }));
}

/** Provedor falso: conexão, contas e páginas de transações configuráveis. */
export class ProvedorFalso implements ProvedorBancario {
  conexao: ConexaoDoProvedor | null = {
    idExterno: ITEM,
    banco: "Sicredi Empresas",
    status: "atualizada",
    erro: null,
    consentimentoExpiraEm: new Date("2027-10-01T00:00:00Z"),
    ultimaAtualizacaoEm: new Date("2026-10-09T11:00:00Z"),
    identificadorDoUsuario: EMPRESA,
  };
  contas: ContaDoProvedor[] = [
    { idExterno: CONTA_EXTERNA, nome: "Conta PJ", tipo: "corrente", numeroFinal: "3456", saldoCentavos: 1523456 },
    { idExterno: "poupanca-1", nome: "Poupança", tipo: "poupanca", numeroFinal: null, saldoCentavos: 100000 },
  ];
  paginas: PaginaDeTransacoesDoProvedor[] = [{ itens: [], proximoCursor: null }];
  criarTokenDeConexao = vi.fn(async () => ({ token: "token-curto" }));
  obterConexao = vi.fn(async () => this.conexao);
  listarContas = vi.fn(async () => this.contas);
  listarTransacoes = vi.fn(async (_conta: string, filtros?: { cursor?: string }) => {
    const indice = filtros?.cursor ? Number(filtros.cursor) : 0;
    return this.paginas[indice] ?? { itens: [], proximoCursor: null };
  });
  registrarWebhooks = vi.fn(async () => ({ criados: [], atualizados: [] }));
  interpretarWebhook = vi.fn((): EventoDeWebhook | null => null);
}

export function umaTransacaoDoProvedor(
  parcial: Partial<TransacaoDoProvedor> = {},
): TransacaoDoProvedor {
  return {
    idExterno: novoId(),
    contaIdExterno: CONTA_EXTERNA,
    data: "2026-10-08",
    descricao: "PIX ENVIADO POSTO IPIRANGA",
    descricaoOriginal: null,
    valorCentavos: -25090,
    pendente: false,
    contraparte: "Posto Ipiranga Palmas",
    metodoDePagamento: "PIX",
    categoriaDoProvedor: "Gas stations",
    ...parcial,
  };
}
