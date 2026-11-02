import "server-only";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";
import type {
  FrequenciaDaRecorrencia,
  Recorrencia,
  TipoDeConta,
} from "@/regras-de-negocio/tipos";
import type { RepositorioDeRecorrencias } from "./contratos";
import {
  dadosOuFalha,
  falhaDoBanco,
  paraCentavos,
  paraReais,
} from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

// Mensagens levantadas pelas RPCs (migração 20261102150000 e 20261102130000).
const MENSAGENS: Record<string, string> = {
  recorrencia_nao_encontrada: "Recorrência não encontrada ou encerrada.",
  data_invalida: "Essa data não é uma ocorrência desta recorrência.",
  ocorrencia_ja_baixada: "Essa ocorrência já foi marcada.",
  periodo_invalido: "Escolha um período de até dois anos.",
};

function erroDaRpc(erro: { code?: string; message?: string }): Error {
  const mensagem = erro.message ? MENSAGENS[erro.message] : undefined;
  return mensagem
    ? new ErroDeNegocio("entrada_invalida", mensagem)
    : falhaDoBanco(erro);
}

const paraRecorrencia = (l: Tables<"recorrencias">): Recorrencia => ({
  id: l.id,
  empresaId: l.empresa_id,
  contaId: l.conta_id,
  descricao: l.descricao,
  valorCentavos: paraCentavos(l.valor),
  categoriaId: l.categoria_id,
  frequencia: l.frequencia as FrequenciaDaRecorrencia,
  inicio: l.inicio,
  fim: l.fim,
  ativa: l.ativa,
});

export class RepositorioDeRecorrenciasSupabase implements RepositorioDeRecorrencias {
  constructor(private readonly banco: ClienteDoBanco) {}

  async listar(empresaId: string) {
    return dadosOuFalha(
      await this.banco
        .from("recorrencias")
        .select()
        .eq("empresa_id", empresaId)
        .eq("ativa", true)
        .order("inicio"),
    ).map(paraRecorrencia);
  }

  async criar(
    empresaId: string,
    dados: Parameters<RepositorioDeRecorrencias["criar"]>[1],
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("recorrencias")
        .insert({
          empresa_id: empresaId,
          conta_id: dados.contaId,
          descricao: dados.descricao,
          valor: paraReais(dados.valorCentavos),
          categoria_id: dados.categoriaId,
          frequencia: dados.frequencia,
          inicio: dados.inicio,
          fim: dados.fim,
        })
        .select()
        .single(),
      { referencia: "Conta ou categoria inválida." },
    );
    return paraRecorrencia(linha);
  }

  async encerrar(empresaId: string, recorrenciaId: string) {
    dadosOuFalha(
      await this.banco
        .from("recorrencias")
        .update({ ativa: false })
        .eq("empresa_id", empresaId)
        .eq("id", recorrenciaId)
        .select("id")
        .single(),
      { naoEncontrado: "Recorrência não encontrada." },
    );
  }

  async atualizar(
    empresaId: string,
    recorrenciaId: string,
    dados: Parameters<RepositorioDeRecorrencias["atualizar"]>[2],
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("recorrencias")
        .update({
          descricao: dados.descricao,
          valor: paraReais(dados.valorCentavos),
          fim: dados.fim,
        })
        .eq("empresa_id", empresaId)
        .eq("id", recorrenciaId)
        .eq("ativa", true)
        .select()
        .single(),
      {
        naoEncontrado: "Recorrência não encontrada ou encerrada.",
        referencia: "O fim não pode ser antes do início.",
      },
    );
    return paraRecorrencia(linha);
  }

  async ocorrencias(empresaId: string, de: string, ate: string) {
    const { data, error } = await this.banco.rpc("ocorrencias_previstas", {
      p_empresa: empresaId,
      p_de: de,
      p_ate: ate,
    });
    if (error) throw erroDaRpc(error);
    return (data ?? []).map((o) => ({
      recorrenciaId: o.recorrencia_id,
      data: o.data,
      descricao: o.descricao,
      valorCentavos: Number(o.valor_centavos),
      contaId: o.conta_id,
      tipoDaConta: (o.tipo_da_conta ?? "corrente") as TipoDeConta,
      contaManual: o.conta_manual,
      categoriaId: o.categoria_id,
    }));
  }

  async baixar(
    empresaId: string,
    recorrenciaId: string,
    data: string,
    lancar: boolean,
  ) {
    const r = await this.banco.rpc("baixar_ocorrencia", {
      p_empresa: empresaId,
      p_recorrencia: recorrenciaId,
      p_data: data,
      p_lancar: lancar,
    });
    if (r.error) throw erroDaRpc(r.error);
    return r.data ?? null;
  }
}
