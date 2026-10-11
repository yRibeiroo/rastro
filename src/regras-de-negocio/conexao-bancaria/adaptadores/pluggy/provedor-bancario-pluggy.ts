import "server-only";
import {
  PluggyClient,
  type Account,
  type Item,
  type Transaction,
  type TransactionCursorFilters,
} from "pluggy-sdk";
import { z } from "zod";
import { hojeISO } from "@/ferramentas-internas/formatar-data";
import { ErroDeNegocio, entradaInvalida } from "../../../erros";
import type { DataISO, StatusDaConexao, TipoDeConta } from "../../../tipos";
import {
  EVENTOS_DO_WEBHOOK,
  type ConexaoDoProvedor,
  type ContaDoProvedor,
  type EventoDeWebhook,
  type FiltrosDeTransacoesDoProvedor,
  type NomeDoEventoDoProvedor,
  type PaginaDeTransacoesDoProvedor,
  type ProvedorBancario,
  type TransacaoDoProvedor,
} from "../../provedor-bancario";

/** Só o que o adaptador usa do PluggyClient (facilita o falso nos testes). */
export type ClienteDaPluggy = Pick<
  PluggyClient,
  | "createConnectToken"
  | "fetchItem"
  | "fetchAccounts"
  | "fetchTransactionsCursor"
  | "fetchWebhooks"
  | "createWebhook"
  | "updateWebhook"
>;

// ── Mapeamentos fixos (contratos.md §12) ─────────────────────────────────────

const STATUS: Record<string, StatusDaConexao> = {
  UPDATED: "atualizada",
  UPDATING: "atualizando",
  MERGING: "atualizando",
  WAITING_USER_INPUT: "aguardando_usuario",
  WAITING_USER_ACTION: "aguardando_usuario",
  LOGIN_ERROR: "erro_de_login",
  OUTDATED: "desatualizada",
};

export function paraStatusDaConexao(status: string): StatusDaConexao {
  return STATUS[status] ?? "erro";
}

const TIPOS_DE_CONTA: Record<string, TipoDeConta> = {
  CHECKING_ACCOUNT: "corrente",
  SAVINGS_ACCOUNT: "poupanca",
  CREDIT_CARD: "cartao_de_credito",
};

export function paraCentavos(valor: number): number {
  return Math.round(valor * 100);
}

/**
 * Data contábil no fuso America/Araguaina (ADR 0013 item 7): um lançamento às 22h
 * em Palmas é 01h UTC do dia seguinte.
 */
export function paraDataContabil(data: Date | string): DataISO {
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const instante = typeof data === "string" ? new Date(data) : data;
  // ponytail: meia-noite UTC exata é tratada como "data sem hora" (vários conectores mandam
  // assim); converter jogaria para o dia anterior. Revisar se a Pluggy passar a mandar a hora real.
  if (instante.toISOString().endsWith("T00:00:00.000Z"))
    return instante.toISOString().slice(0, 10);
  return hojeISO(instante);
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Quem recebeu (saída) ou quem pagou (entrada); senão o estabelecimento. Nunca documento ou conta. */
export function contraparteDe(t: Transaction): string | null {
  const parte =
    t.type === "DEBIT" ? t.paymentData?.receiver : t.paymentData?.payer;
  return (
    textoOuNulo(parte?.name) ??
    textoOuNulo(t.merchant?.name) ??
    textoOuNulo(t.merchant?.businessName)
  );
}

export function paraTransacaoDoProvedor(t: Transaction): TransacaoDoProvedor {
  const sinal = t.type === "DEBIT" ? -1 : 1;
  return {
    // Alguns ids chegam como objeto/uuid em outros SDKs: o banco guarda texto.
    idExterno: String(t.id),
    contaIdExterno: String(t.accountId),
    data: paraDataContabil(t.date),
    descricao: (t.description ?? "").trim() || "(sem descrição)",
    descricaoOriginal: textoOuNulo(t.descriptionRaw),
    // Saída sempre negativa, mesmo se o conector mandar o débito com sinal positivo.
    valorCentavos: paraCentavos(Math.abs(Number(t.amount))) * sinal,
    pendente: t.status === "PENDING",
    contraparte: contraparteDe(t),
    metodoDePagamento: textoOuNulo(t.paymentData?.paymentMethod),
    categoriaDoProvedor: textoOuNulo(t.category),
  };
}

export function paraContaDoProvedor(a: Account): ContaDoProvedor | null {
  const tipo = TIPOS_DE_CONTA[a.subtype];
  if (!tipo) return null;
  const digitos = (a.number ?? "").replace(/\D/g, "").slice(-4);
  return {
    idExterno: String(a.id),
    nome: (a.marketingName ?? a.name ?? "").trim() || "Conta",
    tipo,
    numeroFinal: digitos || null,
    saldoCentavos: paraCentavos(Number(a.balance ?? 0)),
  };
}

function paraData(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function paraConexaoDoProvedor(item: Item): ConexaoDoProvedor {
  return {
    idExterno: String(item.id),
    banco: textoOuNulo(item.connector?.name),
    status: paraStatusDaConexao(item.status),
    erro: item.error
      ? {
          codigo: String(item.error.code ?? "desconhecido").slice(0, 100),
          mensagem: String(item.error.message ?? "").slice(0, 300),
        }
      : null,
    consentimentoExpiraEm: paraData(item.consentExpiresAt),
    ultimaAtualizacaoEm: paraData(item.lastUpdatedAt),
    identificadorDoUsuario: textoOuNulo(item.clientUserId),
  };
}

/** `next` é um link: o cursor é o parâmetro `after`. */
export function cursorDoProximo(next: string | null): string | null {
  if (!next) return null;
  return new URL(next, "https://api.pluggy.ai").searchParams.get("after");
}

// ── Erros: o SDK rejeita com o corpo da resposta ({ code, message }), não com Error ─────

export function codigoHttpDe(erro: unknown): number | null {
  if (!erro || typeof erro !== "object") return null;
  const bruto =
    (erro as { code?: unknown }).code ?? (erro as { status?: unknown }).status;
  const numero = typeof bruto === "string" ? Number(bruto) : bruto;
  return typeof numero === "number" && Number.isInteger(numero) ? numero : null;
}

function provedorIndisponivel(cause: unknown): ErroDeNegocio {
  return new ErroDeNegocio(
    "provedor_indisponivel",
    "O banco não respondeu agora. Tente de novo em alguns minutos.",
    { cause },
  );
}

async function chamar<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    throw provedorIndisponivel(erro);
  }
}

// ── Webhook ──────────────────────────────────────────────────────────────────

const idExterno = z.string().trim().min(1).max(100);
const esquemaBase = z.object({
  eventId: z.string().trim().min(1).max(200),
  event: z.string().trim().min(1).max(100),
});
const esquemaItem = z.object({ itemId: idExterno });
const esquemaErroDoItem = esquemaItem.extend({
  error: z
    .object({
      code: z.union([z.string(), z.number()]).optional(),
      message: z.string().optional(),
    })
    .nullish(),
});
const esquemaTransacoesCriadas = esquemaItem.extend({
  accountId: idExterno,
  transactionsCreatedAtFrom: z.iso.datetime({ offset: true }),
});
const esquemaTransacoesPorId = esquemaItem.extend({
  accountId: idExterno,
  transactionIds: z.array(idExterno).max(10_000),
});

export function interpretarEventoDaPluggy(
  corpo: unknown,
): EventoDeWebhook | null {
  const base = esquemaBase.safeParse(corpo);
  if (!base.success) return null;
  const { eventId: eventoId, event: nomeOriginal } = base.data;
  const comum = { eventoId, nomeOriginal };

  switch (nomeOriginal as NomeDoEventoDoProvedor) {
    case "item/created":
    case "item/updated": {
      const r = esquemaItem.safeParse(corpo);
      if (!r.success) return null;
      return {
        ...comum,
        tipo:
          nomeOriginal === "item/created"
            ? "conexao_criada"
            : "conexao_atualizada",
        conexaoIdExterno: r.data.itemId,
      };
    }
    case "item/error": {
      const r = esquemaErroDoItem.safeParse(corpo);
      if (!r.success) return null;
      return {
        ...comum,
        tipo: "conexao_com_erro",
        conexaoIdExterno: r.data.itemId,
        erro: {
          codigo: String(r.data.error?.code ?? "desconhecido").slice(0, 100),
          mensagem: (r.data.error?.message ?? "").slice(0, 300),
        },
      };
    }
    case "transactions/created": {
      const r = esquemaTransacoesCriadas.safeParse(corpo);
      if (!r.success) return null;
      return {
        ...comum,
        tipo: "transacoes_criadas",
        conexaoIdExterno: r.data.itemId,
        contaIdExterno: r.data.accountId,
        criadasDesde: new Date(r.data.transactionsCreatedAtFrom),
      };
    }
    case "transactions/updated":
    case "transactions/deleted": {
      const r = esquemaTransacoesPorId.safeParse(corpo);
      if (!r.success) return null;
      return {
        ...comum,
        tipo:
          nomeOriginal === "transactions/updated"
            ? "transacoes_atualizadas"
            : "transacoes_removidas",
        conexaoIdExterno: r.data.itemId,
        contaIdExterno: r.data.accountId,
        transacaoIdsExternos: r.data.transactionIds,
      };
    }
    default: {
      const r = esquemaItem.safeParse(corpo);
      return {
        ...comum,
        tipo: "ignorado",
        conexaoIdExterno: r.success ? r.data.itemId : null,
      };
    }
  }
}

// ── Adaptador ────────────────────────────────────────────────────────────────

export class ProvedorBancarioPluggy implements ProvedorBancario {
  private clienteCriado?: ClienteDaPluggy;

  /** Recebe uma fábrica: as credenciais só são lidas na primeira chamada à Pluggy. */
  constructor(private readonly criarCliente: () => ClienteDaPluggy) {}

  private get cliente(): ClienteDaPluggy {
    this.clienteCriado ??= this.criarCliente();
    return this.clienteCriado;
  }

  async criarTokenDeConexao(opcoes: {
    identificadorDoUsuario: string;
    idExternoParaReconectar?: string;
  }): Promise<{ token: string }> {
    // Sem webhookUrl: por ali o evento chegaria sem o cabeçalho secreto (ADR 0007).
    const { accessToken } = await chamar(() =>
      this.cliente.createConnectToken(opcoes.idExternoParaReconectar, {
        clientUserId: opcoes.identificadorDoUsuario,
        avoidDuplicates: true,
      }),
    );
    return { token: accessToken };
  }

  async obterConexao(idExterno: string): Promise<ConexaoDoProvedor | null> {
    try {
      return paraConexaoDoProvedor(await this.cliente.fetchItem(idExterno));
    } catch (erro) {
      const codigo = codigoHttpDe(erro);
      // 400: id malformado para a Pluggy, equivale a "não existe".
      if (codigo === 404 || codigo === 400) return null;
      throw provedorIndisponivel(erro);
    }
  }

  async listarContas(conexaoIdExterno: string): Promise<ContaDoProvedor[]> {
    const pagina = await chamar(() =>
      this.cliente.fetchAccounts(conexaoIdExterno),
    );
    return (pagina.results ?? [])
      .map(paraContaDoProvedor)
      .filter((c): c is ContaDoProvedor => c !== null);
  }

  async listarTransacoes(
    contaIdExterno: string,
    filtros: FiltrosDeTransacoesDoProvedor = {},
  ): Promise<PaginaDeTransacoesDoProvedor> {
    const opcoes: TransactionCursorFilters = {};
    if (filtros.criadasDesde)
      opcoes.createdAtFrom = filtros.criadasDesde.toISOString();
    if (filtros.dataDe) opcoes.dateFrom = filtros.dataDe;
    if (filtros.dataAte) opcoes.dateTo = filtros.dataAte;
    if (filtros.ids) opcoes.ids = [...filtros.ids].slice(0, 500);
    if (filtros.cursor) opcoes.after = filtros.cursor;
    const pagina = await chamar(() =>
      this.cliente.fetchTransactionsCursor(contaIdExterno, opcoes),
    );
    return {
      itens: (pagina.results ?? []).map(paraTransacaoDoProvedor),
      proximoCursor: cursorDoProximo(pagina.next),
    };
  }

  async registrarWebhooks(opcoes: {
    url: string;
    eventos: readonly NomeDoEventoDoProvedor[];
    cabecalhos: Record<string, string>;
  }): Promise<{
    criados: NomeDoEventoDoProvedor[];
    atualizados: NomeDoEventoDoProvedor[];
  }> {
    if (!opcoes.url.startsWith("https://"))
      throw entradaInvalida("A URL do webhook precisa ser https://.");
    const existentes = await chamar(() => this.cliente.fetchWebhooks());
    const porChave = new Map(
      (existentes.results ?? []).map((w) => [`${w.event} ${w.url}`, w]),
    );
    const criados: NomeDoEventoDoProvedor[] = [];
    const atualizados: NomeDoEventoDoProvedor[] = [];
    for (const evento of opcoes.eventos) {
      const atual = porChave.get(`${evento} ${opcoes.url}`);
      if (atual) {
        await chamar(() =>
          this.cliente.updateWebhook(atual.id, {
            url: opcoes.url,
            event: evento,
            headers: opcoes.cabecalhos,
            enabled: true,
          }),
        );
        atualizados.push(evento);
      } else {
        await chamar(() =>
          this.cliente.createWebhook(evento, opcoes.url, opcoes.cabecalhos),
        );
        criados.push(evento);
      }
    }
    return { criados, atualizados };
  }

  interpretarWebhook(corpo: unknown): EventoDeWebhook | null {
    return interpretarEventoDaPluggy(corpo);
  }
}

let unico: ProvedorBancarioPluggy | undefined;

/** Singleton preguiçoso: o PluggyClient guarda e renova a API Key sozinho. */
export function provedorPluggy(
  credenciais: () => { clientId: string; clientSecret: string },
): ProvedorBancarioPluggy {
  unico ??= new ProvedorBancarioPluggy(() => new PluggyClient(credenciais()));
  return unico;
}

export { EVENTOS_DO_WEBHOOK };
