import "server-only";
import type { LimiteDeGasto } from "@/regras-de-negocio/tipos";
import type { RepositorioDeLimitesDeGasto } from "./contratos";
import {
  dadosOuFalha,
  falhaDoBanco,
  paraCentavos,
  paraReais,
} from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";

const paraLimite = (l: {
  categoria_id: string;
  valor_mensal: number;
}): LimiteDeGasto => ({
  categoriaId: l.categoria_id,
  valorMensalCentavos: paraCentavos(l.valor_mensal),
});

const MENSAGENS = {
  referencia: "Categoria inválida.",
  duplicado: "Essa categoria já tem limite.",
};

export class RepositorioDeLimitesDeGastoSupabase implements RepositorioDeLimitesDeGasto {
  constructor(private readonly banco: ClienteDoBanco) {}

  async listar(empresaId: string) {
    return dadosOuFalha(
      await this.banco
        .from("limites_de_gasto")
        .select("categoria_id, valor_mensal")
        .eq("empresa_id", empresaId),
    ).map(paraLimite);
  }

  async definir(empresaId: string, limite: LimiteDeGasto) {
    // Sem upsert: o usuário só tem UPDATE em valor_mensal (o upsert reescreveria a chave).
    const atualizado = await this.banco
      .from("limites_de_gasto")
      .update({ valor_mensal: paraReais(limite.valorMensalCentavos) })
      .eq("empresa_id", empresaId)
      .eq("categoria_id", limite.categoriaId)
      .select("categoria_id, valor_mensal");
    if (atualizado.error) throw falhaDoBanco(atualizado.error, MENSAGENS);
    if (atualizado.data.length) return paraLimite(atualizado.data[0]);
    return paraLimite(
      dadosOuFalha(
        await this.banco
          .from("limites_de_gasto")
          .insert({
            empresa_id: empresaId,
            categoria_id: limite.categoriaId,
            valor_mensal: paraReais(limite.valorMensalCentavos),
          })
          .select("categoria_id, valor_mensal")
          .single(),
        MENSAGENS,
      ),
    );
  }

  async remover(empresaId: string, categoriaId: string) {
    const { error } = await this.banco
      .from("limites_de_gasto")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("categoria_id", categoriaId);
    if (error) throw falhaDoBanco(error);
  }
}
