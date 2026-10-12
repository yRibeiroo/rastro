import "server-only";
import { ErroDeNegocio } from "../erros";
import type {
  Centavos,
  DataISO,
  ErroDaConexao,
  StatusDaConexao,
  TipoDeConta,
} from "../tipos";

// Adaptador ProvedorBancario (contratos.md §3.1). Tipos neutros: nada do pluggy-sdk passa daqui.

export interface ConexaoDoProvedor {
  idExterno: string;
  banco: string | null;
  status: StatusDaConexao;
  erro: ErroDaConexao | null;
  consentimentoExpiraEm: Date | null;
  ultimaAtualizacaoEm: Date | null;
  identificadorDoUsuario: string | null; // clientUserId = empresaId
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
  valorCentavos: Centavos; // sinal pelo tipo: DEBIT => negativo, CREDIT => positivo
  pendente: boolean;
  contraparte: string | null;
  metodoDePagamento: string | null;
  categoriaDoProvedor: string | null;
}

/** `criadasDesde` e `dataDe` são mutuamente exclusivos (restrição da Pluggy). `ids`: até 500. */
export type FiltrosDeTransacoesDoProvedor =
  | {
      criadasDesde: Date;
      dataAte?: DataISO;
      ids?: undefined;
      dataDe?: undefined;
      cursor?: string;
    }
  | {
      dataDe?: DataISO;
      dataAte?: DataISO;
      ids?: undefined;
      criadasDesde?: undefined;
      cursor?: string;
    }
  | {
      ids: readonly string[];
      criadasDesde?: undefined;
      dataDe?: undefined;
      dataAte?: undefined;
      cursor?: string;
    };

export interface PaginaDeTransacoesDoProvedor {
  itens: TransacaoDoProvedor[];
  proximoCursor: string | null;
}

export const EVENTOS_DO_WEBHOOK = [
  "item/created",
  "item/updated",
  "item/error",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
] as const;
export type NomeDoEventoDoProvedor = (typeof EVENTOS_DO_WEBHOOK)[number];

export type EventoDeWebhook =
  | {
      tipo: "conexao_criada" | "conexao_atualizada";
      eventoId: string;
      nomeOriginal: string;
      conexaoIdExterno: string;
    }
  | {
      tipo: "conexao_com_erro";
      eventoId: string;
      nomeOriginal: string;
      conexaoIdExterno: string;
      erro: ErroDaConexao;
    }
  | {
      tipo: "transacoes_criadas";
      eventoId: string;
      nomeOriginal: string;
      conexaoIdExterno: string;
      contaIdExterno: string;
      criadasDesde: Date;
    }
  | {
      tipo: "transacoes_atualizadas" | "transacoes_removidas";
      eventoId: string;
      nomeOriginal: string;
      conexaoIdExterno: string;
      contaIdExterno: string;
      transacaoIdsExternos: string[];
    }
  | {
      tipo: "ignorado";
      eventoId: string;
      nomeOriginal: string;
      conexaoIdExterno: string | null;
    };

export interface ProvedorBancario {
  /** Sem webhookUrl (ADR 0007). Com idExternoParaReconectar, abre o widget em modo de atualização/reconsentimento. */
  criarTokenDeConexao(opcoes: {
    identificadorDoUsuario: string; // empresaId
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
    url: string; // https:// obrigatório
    eventos: readonly NomeDoEventoDoProvedor[];
    cabecalhos: Record<string, string>;
  }): Promise<{
    criados: NomeDoEventoDoProvedor[];
    atualizados: NomeDoEventoDoProvedor[];
  }>;

  /** Valida (Zod) e traduz o corpo do webhook. Retorna null se o corpo for inválido. */
  interpretarWebhook(corpo: unknown): EventoDeWebhook | null;
}

/** RECURSO_OPEN_FINANCE desligado (ADR 0016): a montagem usa este no lugar da Pluggy. */
export const provedorDesligado: ProvedorBancario = (() => {
  const desligado = async (): Promise<never> => {
    throw new ErroDeNegocio(
      "recurso_desligado",
      "A conexão direta com o banco está desligada. Importe o extrato em OFX.",
    );
  };
  return {
    criarTokenDeConexao: desligado,
    obterConexao: desligado,
    listarContas: desligado,
    listarTransacoes: desligado,
    registrarWebhooks: desligado,
    interpretarWebhook: () => null,
  };
})();
