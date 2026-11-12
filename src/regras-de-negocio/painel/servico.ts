import "server-only";
import { z } from "zod";
import type {
  RepositorioDeContas,
  RepositorioDeTransacoes,
  RepositorioDoPainel,
} from "@/acesso-a-dados/contratos";
import { entradaInvalida } from "../erros";
import type { Centavos, ContextoDoUsuario, DataISO, Id } from "../tipos";

export interface PeriodoDoPainel {
  de: DataISO;
  ate: DataISO;
} // máximo de 24 meses

export interface ResumoDoPainel {
  periodo: PeriodoDoPainel;
  saldoAtualCentavos: Centavos;
  saldoAtualizadoEm: Date | null;
  fluxoMensal: Array<{
    mes: string; // 'YYYY-MM'
    entradasCentavos: Centavos;
    saidasCentavos: Centavos; // positivo
    resultadoCentavos: Centavos;
  }>;
  gastosPorCategoria: Array<{
    categoriaId: Id | null;
    nome: string;
    totalCentavos: Centavos; // positivo
    quantidade: number;
  }>;
  resultadoPorCentroDeCusto: Array<{
    centroDeCustoId: Id | null;
    nome: string;
    entradasCentavos: Centavos;
    saidasCentavos: Centavos;
    resultadoCentavos: Centavos;
  }>;
  transacoesSemCategoria: number;
}

export interface SaldoDoMes {
  mes: string; // 'YYYY-MM'
  /** Saldo das contas no fim do mês (no mês atual, o saldo de hoje). */
  saldoCentavos: Centavos;
}

export interface ServicoDoPainel {
  /**
   * Saldo no fim de cada mês do período. O período precisa terminar hoje: a conta parte do saldo
   * atual e desfaz o movimento de cada mês, do mais recente para o mais antigo.
   */
  saldoPorMes(
    ctx: ContextoDoUsuario,
    periodo: PeriodoDoPainel,
  ): Promise<SaldoDoMes[]>;
  obterResumo(
    ctx: ContextoDoUsuario,
    periodo: PeriodoDoPainel,
  ): Promise<ResumoDoPainel>;
}

export const MESES_MAXIMOS_DO_PAINEL = 24;

const mesesEntre = (de: DataISO, ate: DataISO) =>
  (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 +
  (Number(ate.slice(5, 7)) - Number(de.slice(5, 7)));

const esquemaDoPeriodo = z
  .object({ de: z.iso.date(), ate: z.iso.date() })
  .refine(
    (p) => p.de <= p.ate && mesesEntre(p.de, p.ate) <= MESES_MAXIMOS_DO_PAINEL,
  );

export function criarServicoDoPainel(deps: {
  painel: RepositorioDoPainel;
  contas: RepositorioDeContas;
  transacoes: RepositorioDeTransacoes;
}): ServicoDoPainel {
  const validar = (periodoInformado: PeriodoDoPainel) => {
    const r = esquemaDoPeriodo.safeParse(periodoInformado);
    if (!r.success)
      throw entradaInvalida("Escolha um período de até 24 meses.");
    return { de: r.data.de, ate: r.data.ate };
  };

  return {
    async saldoPorMes(ctx, periodoInformado) {
      const periodo = validar(periodoInformado);
      const [movimento, saldo] = await Promise.all([
        deps.painel.movimentoMensal(ctx.empresaId, periodo),
        deps.contas.obterSaldoTotal(ctx.empresaId),
      ]);
      // Do mês mais recente para trás: saldo no fim do mês anterior = saldo no fim deste − movimento deste.
      let corrente = saldo.saldoCentavos;
      const saldos: SaldoDoMes[] = [];
      for (const m of movimento.toReversed()) {
        saldos.unshift({ mes: m.mes, saldoCentavos: corrente });
        corrente -= m.liquidoCentavos;
      }
      return saldos;
    },

    async obterResumo(ctx, periodoInformado) {
      const r = { data: validar(periodoInformado) };
      const periodo = { de: r.data.de, ate: r.data.ate };
      const [
        fluxoMensal,
        gastosPorCategoria,
        resultadoPorCentroDeCusto,
        saldo,
        semCategoria,
      ] = await Promise.all([
        deps.painel.fluxoMensal(ctx.empresaId, periodo),
        deps.painel.gastosPorCategoria(ctx.empresaId, periodo),
        deps.painel.resultadoPorCentroDeCusto(ctx.empresaId, periodo),
        deps.contas.obterSaldoTotal(ctx.empresaId),
        deps.transacoes.contarSemCategoria(ctx.empresaId, periodo),
      ]);
      return {
        periodo,
        saldoAtualCentavos: saldo.saldoCentavos,
        saldoAtualizadoEm: saldo.atualizadoEm,
        fluxoMensal,
        gastosPorCategoria,
        resultadoPorCentroDeCusto,
        transacoesSemCategoria: semCategoria,
      };
    },
  };
}
