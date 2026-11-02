import "server-only";
import { z } from "zod";
import type {
  RepositorioDeContas,
  RepositorioDeRecorrencias,
} from "@/acesso-a-dados/contratos";
import { somarDias } from "@/ferramentas-internas/formatar-data";
import { ErroDeNegocio, entradaInvalida, registrarFalha } from "../erros";
import type {
  Centavos,
  ContextoDoUsuario,
  DataISO,
  FrequenciaDaRecorrencia,
  Id,
  OcorrenciaPrevista,
  Recorrencia,
} from "../tipos";

// Recorrências (contas a pagar e a receber) e saldo previsto (Fase 4, ADR 0017).

/** Atrasadas não baixadas há mais que isso saem da previsão (provavelmente esquecidas). */
export const DIAS_DE_ATRASO_CONSIDERADOS = 60;

export interface NovaRecorrencia {
  contaId: Id;
  descricao: string;
  /** Negativo = a pagar. */
  valorCentavos: Centavos;
  categoriaId?: Id | null;
  frequencia: FrequenciaDaRecorrencia;
  inicio: DataISO;
  fim?: DataISO | null;
}

export type EdicaoDeRecorrencia = Pick<NovaRecorrencia, "descricao" | "valorCentavos"> & { fim: DataISO | null };

export interface OcorrenciaNaPrevisao extends OcorrenciaPrevista {
  atrasada: boolean;
  /** Saldo projetado logo depois desta ocorrência; null = cartão de crédito (fora do saldo). */
  saldoDepoisCentavos: Centavos | null;
}

export interface PrevisaoDeSaldo {
  hoje: DataISO;
  ate: DataISO;
  saldoAtualCentavos: Centavos;
  saldoPrevistoCentavos: Centavos;
  ocorrencias: OcorrenciaNaPrevisao[];
}

export interface ServicoDePrevisao {
  listarRecorrencias(ctx: ContextoDoUsuario): Promise<Recorrencia[]>;
  criarRecorrencia(ctx: ContextoDoUsuario, dados: NovaRecorrencia): Promise<Recorrencia>;
  encerrarRecorrencia(ctx: ContextoDoUsuario, recorrenciaId: Id): Promise<void>;
  /** Vale para as próximas ocorrências; as já baixadas ficam como estão. */
  editarRecorrencia(ctx: ContextoDoUsuario, recorrenciaId: Id, dados: EdicaoDeRecorrencia): Promise<Recorrencia>;
  /** lancar = false: "pular" (não gera lançamento). Em conta de banco nunca lança. */
  baixar(
    ctx: ContextoDoUsuario,
    dados: { recorrenciaId: Id; data: DataISO; lancar?: boolean },
  ): Promise<{ transacaoId: Id | null }>;
  /** Saldo de hoje + ocorrências não baixadas (inclusive atrasadas) até hoje + dias. */
  prever(ctx: ContextoDoUsuario, dias: number): Promise<PrevisaoDeSaldo>;
}

const LIMITE_EM_CENTAVOS = 1e14;
const data = z.iso.date();

const descricao = z.string().trim().min(1).max(200);
const valorCentavos = z
  .number()
  .int()
  .refine((v) => v !== 0 && Math.abs(v) < LIMITE_EM_CENTAVOS);

const esquemaEdicao = z.object({ descricao, valorCentavos, fim: data.nullable() });

const esquemaNova = z
  .object({
    contaId: z.uuid(),
    descricao,
    valorCentavos,
    categoriaId: z.uuid().nullish(),
    frequencia: z.enum(["semanal", "mensal", "anual"]),
    inicio: data,
    fim: data.nullish(),
  })
  .refine((d) => !d.fim || d.fim >= d.inicio);

export function criarServicoDePrevisao(deps: {
  recorrencias: RepositorioDeRecorrencias;
  contas: Pick<RepositorioDeContas, "obterSaldoTotal">;
  categorizacao: { categorizarPendentes(empresaId: Id): Promise<unknown> };
  hoje: () => DataISO;
}): ServicoDePrevisao {
  const idValido = (id: unknown) => z.uuid().safeParse(id).success;

  return {
    listarRecorrencias: (ctx) => deps.recorrencias.listar(ctx.empresaId),

    async criarRecorrencia(ctx, dados) {
      const r = esquemaNova.safeParse(dados);
      if (!r.success)
        throw entradaInvalida(
          "Confira a conta, a descrição, o valor (diferente de zero) e as datas (o fim não pode ser antes do início).",
        );
      return deps.recorrencias.criar(ctx.empresaId, {
        ...r.data,
        categoriaId: r.data.categoriaId ?? null,
        fim: r.data.fim ?? null,
      });
    },

    async encerrarRecorrencia(ctx, recorrenciaId) {
      if (!idValido(recorrenciaId))
        throw new ErroDeNegocio("nao_encontrado", "Recorrência não encontrada.");
      await deps.recorrencias.encerrar(ctx.empresaId, recorrenciaId);
    },

    async editarRecorrencia(ctx, recorrenciaId, dados) {
      if (!idValido(recorrenciaId))
        throw new ErroDeNegocio("nao_encontrado", "Recorrência não encontrada.");
      const r = esquemaEdicao.safeParse(dados);
      if (!r.success)
        throw entradaInvalida("Confira a descrição, o valor (diferente de zero) e a data de fim.");
      return deps.recorrencias.atualizar(ctx.empresaId, recorrenciaId, r.data);
    },

    async baixar(ctx, dados) {
      if (!idValido(dados?.recorrenciaId) || !data.safeParse(dados?.data).success)
        throw entradaInvalida("Ocorrência inválida.");
      const transacaoId = await deps.recorrencias.baixar(
        ctx.empresaId,
        dados.recorrenciaId,
        dados.data,
        dados.lancar !== false,
      );
      // Lançamento sem categoria: regras e IA assumem (falha não desfaz a baixa).
      if (transacaoId)
        await deps.categorizacao
          .categorizarPendentes(ctx.empresaId)
          .catch((erro) => registrarFalha("categorizar ocorrência baixada", erro));
      return { transacaoId };
    },

    async prever(ctx, dias) {
      if (!Number.isInteger(dias) || dias < 1 || dias > 366)
        throw entradaInvalida("Escolha um horizonte de 1 a 366 dias.");
      const hoje = deps.hoje();
      const ate = somarDias(hoje, dias);
      const [{ saldoCentavos }, ocorrencias] = await Promise.all([
        deps.contas.obterSaldoTotal(ctx.empresaId),
        deps.recorrencias.ocorrencias(
          ctx.empresaId,
          somarDias(hoje, -DIAS_DE_ATRASO_CONSIDERADOS),
          ate,
        ),
      ]);
      let saldo = saldoCentavos;
      const comSaldo = ocorrencias.map((o) => {
        const noSaldo = o.tipoDaConta !== "cartao_de_credito";
        if (noSaldo) saldo += o.valorCentavos;
        return { ...o, atrasada: o.data < hoje, saldoDepoisCentavos: noSaldo ? saldo : null };
      });
      return {
        hoje,
        ate,
        saldoAtualCentavos: saldoCentavos,
        saldoPrevistoCentavos: saldo,
        ocorrencias: comSaldo,
      };
    },
  };
}
