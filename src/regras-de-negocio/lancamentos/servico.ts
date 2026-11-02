import "server-only";
import { z } from "zod";
import type {
  RepositorioDeContas,
  RepositorioDeLancamentos,
} from "@/acesso-a-dados/contratos";
import { ErroDeNegocio, entradaInvalida, registrarFalha } from "../erros";
import type {
  Centavos,
  Conta,
  ContextoDoUsuario,
  DataISO,
  Id,
  TipoDeConta,
} from "../tipos";

// Contas e lançamentos manuais (Fase 2, ADR 0017). O saldo da conta manual é mantido pelo banco (RPC).

export interface NovaContaManual {
  nome: string;
  tipo: TipoDeConta;
  saldoInicialCentavos?: Centavos;
}

export interface NovoLancamento {
  contaId: Id;
  data: DataISO;
  descricao: string;
  /** Negativo = saída. */
  valorCentavos: Centavos;
  categoriaId?: Id | null;
  centroDeCustoId?: Id | null;
}

export interface ServicoDeLancamentos {
  /** Todas as contas da empresa (banco, extrato importado e manuais). */
  listarContas(ctx: ContextoDoUsuario): Promise<Conta[]>;
  criarConta(ctx: ContextoDoUsuario, dados: NovaContaManual): Promise<{ id: Id }>;
  lancar(ctx: ContextoDoUsuario, dados: NovoLancamento): Promise<{ id: Id }>;
  remover(ctx: ContextoDoUsuario, transacaoId: Id): Promise<void>;
  editar(ctx: ContextoDoUsuario, transacaoId: Id, dados: EdicaoDeLancamento): Promise<void>;
}

export type EdicaoDeLancamento = Pick<NovoLancamento, "data" | "descricao" | "valorCentavos">;

const LIMITE_EM_CENTAVOS = 1e14; // numeric(14,2)
const centavos = z.number().int().refine((v) => Math.abs(v) < LIMITE_EM_CENTAVOS);

const esquemaConta = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(["corrente", "poupanca", "cartao_de_credito", "dinheiro"]),
  saldoInicialCentavos: centavos.default(0),
});

const esquemaLancamento = z.object({
  contaId: z.uuid(),
  data: z.iso.date(),
  descricao: z.string().trim().min(1).max(500),
  valorCentavos: centavos.refine((v) => v !== 0),
  categoriaId: z.uuid().nullish(),
  centroDeCustoId: z.uuid().nullish(),
});

const esquemaEdicao = esquemaLancamento.pick({ data: true, descricao: true, valorCentavos: true });

export function criarServicoDeLancamentos(deps: {
  lancamentos: RepositorioDeLancamentos;
  contas: Pick<RepositorioDeContas, "listar">;
  categorizacao: { categorizarPendentes(empresaId: Id): Promise<unknown> };
}): ServicoDeLancamentos {
  return {
    listarContas: (ctx) => deps.contas.listar(ctx.empresaId),

    async criarConta(ctx, dados) {
      const r = esquemaConta.safeParse(dados);
      if (!r.success)
        throw entradaInvalida("Dê um nome e escolha o tipo da conta.");
      const id = await deps.lancamentos.criarContaManual(ctx.empresaId, r.data);
      return { id };
    },

    async lancar(ctx, dados) {
      const r = esquemaLancamento.safeParse(dados);
      if (!r.success)
        throw entradaInvalida(
          "Confira a conta, a data, a descrição e o valor (diferente de zero).",
        );
      const id = await deps.lancamentos.lancar(ctx.empresaId, {
        ...r.data,
        categoriaId: r.data.categoriaId ?? null,
        centroDeCustoId: r.data.centroDeCustoId ?? null,
      });
      // Sem categoria escolhida: regras e IA assumem. Falha aqui nunca derruba o lançamento.
      if (!r.data.categoriaId)
        await deps.categorizacao
          .categorizarPendentes(ctx.empresaId)
          .catch((erro) => registrarFalha("categorizar lançamento manual", erro));
      return { id };
    },

    async remover(ctx, transacaoId) {
      if (!z.uuid().safeParse(transacaoId).success)
        throw new ErroDeNegocio("nao_encontrado", "Lançamento não encontrado.");
      await deps.lancamentos.remover(ctx.empresaId, transacaoId);
    },

    async editar(ctx, transacaoId, dados) {
      if (!z.uuid().safeParse(transacaoId).success)
        throw new ErroDeNegocio("nao_encontrado", "Lançamento não encontrado.");
      const r = esquemaEdicao.safeParse(dados);
      if (!r.success)
        throw entradaInvalida("Confira a data, a descrição e o valor (diferente de zero).");
      await deps.lancamentos.editar(ctx.empresaId, transacaoId, r.data);
    },
  };
}
