import "server-only";
import { z } from "zod";
import type { RepositorioDeTransacoes } from "@/acesso-a-dados/contratos";
import { ErroDeNegocio, entradaInvalida } from "../erros";
import type {
  ContextoDoUsuario,
  DataISO,
  Id,
  Sentido,
  Transacao,
} from "../tipos";

export interface FiltrosDoExtrato {
  dataDe?: DataISO;
  dataAte?: DataISO;
  categoriaId?: Id | "sem_categoria";
  centroDeCustoId?: Id | "sem_centro";
  sentido?: Sentido;
  busca?: string; // até 100 caracteres; ilike em descricao e contraparte
  contaId?: Id;
  cursor?: string; // opaco: base64url de `${data}|${id}`
  limite?: number; // padrão 50, máximo 200
}

export interface PaginaDoExtrato {
  itens: Transacao[];
  proximoCursor: string | null;
}

export interface ServicoDeExtrato {
  listar(
    ctx: ContextoDoUsuario,
    filtros: FiltrosDoExtrato,
  ): Promise<PaginaDoExtrato>;
  obter(ctx: ContextoDoUsuario, transacaoId: Id): Promise<Transacao>; // 'nao_encontrado'
}

export const LIMITE_PADRAO_DO_EXTRATO = 50;
export const LIMITE_MAXIMO_DO_EXTRATO = 200;

const dataISO = z.iso.date();
const DATA_E_ID = /^(\d{4}-\d{2}-\d{2})\|([0-9a-f-]{36})$/i;

/** Cursor opaco do extrato: base64url de `${data}|${id}` (ordem: data desc, id desc). */
export function codificarCursor(transacao: Pick<Transacao, "data" | "id">) {
  return Buffer.from(`${transacao.data}|${transacao.id}`).toString("base64url");
}

export function decodificarCursor(
  cursor: string,
): { data: DataISO; id: Id } | null {
  const texto = Buffer.from(cursor, "base64url").toString("utf8");
  const partes = DATA_E_ID.exec(texto);
  return partes ? { data: partes[1], id: partes[2] } : null;
}

const esquemaDosFiltros = z
  .object({
    dataDe: dataISO.optional(),
    dataAte: dataISO.optional(),
    categoriaId: z.union([z.uuid(), z.literal("sem_categoria")]).optional(),
    centroDeCustoId: z.union([z.uuid(), z.literal("sem_centro")]).optional(),
    sentido: z.enum(["entrada", "saida"]).optional(),
    busca: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((b) => b || undefined),
    contaId: z.uuid().optional(),
    cursor: z
      .string()
      .max(200)
      .refine((c) => decodificarCursor(c) !== null)
      .optional(),
    limite: z
      .number()
      .int()
      .min(1)
      .max(LIMITE_MAXIMO_DO_EXTRATO)
      .default(LIMITE_PADRAO_DO_EXTRATO),
  })
  .refine((f) => !f.dataDe || !f.dataAte || f.dataDe <= f.dataAte);

export function validarFiltrosDoExtrato(filtros: unknown): FiltrosDoExtrato {
  const r = esquemaDosFiltros.safeParse(filtros ?? {});
  if (!r.success) throw entradaInvalida("Confira os filtros do extrato.");
  return r.data;
}

export function criarServicoDeExtrato(deps: {
  transacoes: RepositorioDeTransacoes;
}): ServicoDeExtrato {
  return {
    async listar(ctx, filtros) {
      return deps.transacoes.listar(
        ctx.empresaId,
        validarFiltrosDoExtrato(filtros),
      );
    },

    async obter(ctx, transacaoId) {
      const transacao = z.uuid().safeParse(transacaoId).success
        ? await deps.transacoes.buscarPorId(ctx.empresaId, transacaoId)
        : null;
      if (!transacao)
        throw new ErroDeNegocio("nao_encontrado", "Transação não encontrada.");
      return transacao;
    },
  };
}
