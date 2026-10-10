import "server-only";
import type {
  PeriodoDoPainel,
  ResumoDoPainel,
} from "@/regras-de-negocio/painel";
import type {
  RepositorioDeEventosDeWebhook,
  RepositorioDeLimites,
  RepositorioDoPainel,
} from "./contratos";
import { dadosOuFalha, falhaDoBanco } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";

/** eventos_webhook: só service role. */
export class RepositorioDeEventosDeWebhookSupabase
  implements RepositorioDeEventosDeWebhook
{
  constructor(private readonly banco: ClienteDoBanco) {}

  async registrar(
    eventoId: string,
    nomeOriginal: string,
    conexaoIdExterno: string | null,
  ) {
    // INSERT ... ON CONFLICT (event_id) DO NOTHING: a linha volta só se for nova.
    const linhas = dadosOuFalha(
      await this.banco
        .from("eventos_webhook")
        .upsert(
          {
            event_id: eventoId,
            evento: nomeOriginal,
            id_externo_conexao: conexaoIdExterno,
          },
          { onConflict: "event_id", ignoreDuplicates: true },
        )
        .select("event_id"),
    );
    return linhas.length > 0;
  }

  async marcarProcessado(
    eventoId: string,
    resultado: { empresaId: string | null; erro: string | null },
  ) {
    const { error } = await this.banco
      .from("eventos_webhook")
      .update({
        processado_em: new Date().toISOString(),
        empresa_id: resultado.empresaId,
        erro: resultado.erro?.slice(0, 500) ?? null,
      })
      .eq("event_id", eventoId);
    if (error) throw falhaDoBanco(error);
  }

  async removerAntigos(antesDe: Date) {
    const { count, error } = await this.banco
      .from("eventos_webhook")
      .delete({ count: "exact" })
      .lt("recebido_em", antesDe.toISOString());
    if (error) throw falhaDoBanco(error);
    return count ?? 0;
  }
}

/** limites_de_requisicao: só service role (ADR 0011). */
export class RepositorioDeLimitesSupabase implements RepositorioDeLimites {
  constructor(private readonly banco: ClienteDoBanco) {}

  async consumir(chave: string, maximo: number, janelaEmSegundos: number) {
    return dadosOuFalha(
      await this.banco.rpc("consumir_limite_de_requisicao", {
        p_chave: chave,
        p_maximo: maximo,
        p_janela_segundos: janelaEmSegundos,
      }),
    );
  }

  async removerAntigos(antesDe: Date) {
    const { count, error } = await this.banco
      .from("limites_de_requisicao")
      .delete({ count: "exact" })
      .lt("janela", antesDe.toISOString());
    if (error) throw falhaDoBanco(error);
    return count ?? 0;
  }
}

/** Agregações em funções SQL (security invoker): já vêm em centavos. */
export class RepositorioDoPainelSupabase implements RepositorioDoPainel {
  constructor(private readonly banco: ClienteDoBanco) {}

  private parametros(empresaId: string, periodo: PeriodoDoPainel) {
    return { p_empresa: empresaId, p_de: periodo.de, p_ate: periodo.ate };
  }

  async fluxoMensal(
    empresaId: string,
    periodo: PeriodoDoPainel,
  ): Promise<ResumoDoPainel["fluxoMensal"]> {
    const linhas = dadosOuFalha(
      await this.banco.rpc(
        "painel_fluxo_mensal",
        this.parametros(empresaId, periodo),
      ),
    );
    return linhas.map((l) => {
      const entradas = Number(l.entradas_centavos);
      const saidas = Number(l.saidas_centavos);
      return {
        mes: l.mes,
        entradasCentavos: entradas,
        saidasCentavos: saidas,
        resultadoCentavos: entradas - saidas,
      };
    });
  }

  async gastosPorCategoria(
    empresaId: string,
    periodo: PeriodoDoPainel,
  ): Promise<ResumoDoPainel["gastosPorCategoria"]> {
    const linhas = dadosOuFalha(
      await this.banco.rpc(
        "painel_por_categoria",
        this.parametros(empresaId, periodo),
      ),
    );
    return linhas.map((l) => ({
      categoriaId: l.categoria_id,
      nome: l.nome,
      totalCentavos: Number(l.total_centavos),
      quantidade: Number(l.quantidade),
    }));
  }

  async resultadoPorCentroDeCusto(
    empresaId: string,
    periodo: PeriodoDoPainel,
  ): Promise<ResumoDoPainel["resultadoPorCentroDeCusto"]> {
    const linhas = dadosOuFalha(
      await this.banco.rpc(
        "painel_por_centro_de_custo",
        this.parametros(empresaId, periodo),
      ),
    );
    return linhas.map((l) => {
      const entradas = Number(l.entradas_centavos);
      const saidas = Number(l.saidas_centavos);
      return {
        centroDeCustoId: l.centro_de_custo_id,
        nome: l.nome,
        entradasCentavos: entradas,
        saidasCentavos: saidas,
        resultadoCentavos: entradas - saidas,
      };
    });
  }
}
