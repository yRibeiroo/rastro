import "server-only";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";
import type { Conexao, StatusDaConexao } from "@/regras-de-negocio/tipos";
import type { DadosDaConexao, RepositorioDeConexoes } from "./contratos";
import { dadosOuFalha, falhaDoBanco, paraDataOuNulo } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

export function paraConexao(linha: Tables<"conexoes">): Conexao {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    provedor: linha.provedor as Conexao["provedor"],
    idExterno: linha.id_externo,
    banco: linha.banco,
    status: linha.status as StatusDaConexao,
    erro: linha.erro_codigo
      ? { codigo: linha.erro_codigo, mensagem: linha.erro_mensagem ?? "" }
      : null,
    consentimentoExpiraEm: paraDataOuNulo(linha.consentimento_expira_em),
    ultimaSincronizacaoEm: paraDataOuNulo(linha.ultima_sincronizacao_em),
    criadaEm: new Date(linha.criado_em),
    atualizadaEm: new Date(linha.atualizado_em),
  };
}

function colunasDeStatus(dados: Omit<DadosDaConexao, "idExterno" | "banco">) {
  return {
    status: dados.status,
    erro_codigo: dados.erro?.codigo ?? null,
    erro_mensagem: dados.erro?.mensagem ?? null,
    consentimento_expira_em: dados.consentimentoExpiraEm?.toISOString() ?? null,
  };
}

export class RepositorioDeConexoesSupabase implements RepositorioDeConexoes {
  constructor(private readonly banco: ClienteDoBanco) {}

  async salvar(
    empresaId: string,
    dados: DadosDaConexao,
    criadoPor: string | null,
  ) {
    const provedor = dados.provedor ?? "pluggy";
    const existente = await this.buscarPorIdExterno(dados.idExterno, provedor);
    // Nunca muda a empresa de uma conexão existente (um upsert cego faria isso).
    if (existente && existente.empresaId !== empresaId)
      throw new ErroDeNegocio(
        "conexao_nao_encontrada",
        "Não encontramos essa conexão bancária.",
      );
    const colunas = { banco: dados.banco, ...colunasDeStatus(dados) };
    const resposta = existente
      ? await this.banco
          .from("conexoes")
          .update(colunas)
          .eq("empresa_id", empresaId)
          .eq("id", existente.id)
          .select()
          .single()
      : await this.banco
          .from("conexoes")
          .insert({
            ...colunas,
            empresa_id: empresaId,
            provedor,
            id_externo: dados.idExterno,
            criado_por: criadoPor,
          })
          .select()
          .single();
    return paraConexao(dadosOuFalha(resposta));
  }

  async buscarPorIdExterno(
    idExterno: string,
    provedor: Conexao["provedor"] = "pluggy",
  ) {
    const { data, error } = await this.banco
      .from("conexoes")
      .select()
      .eq("provedor", provedor)
      .eq("id_externo", idExterno)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data ? paraConexao(data) : null;
  }

  async buscarPorId(empresaId: string, conexaoId: string) {
    const { data, error } = await this.banco
      .from("conexoes")
      .select()
      .eq("empresa_id", empresaId)
      .eq("id", conexaoId)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data ? paraConexao(data) : null;
  }

  async listar(empresaId: string) {
    const linhas = dadosOuFalha(
      await this.banco
        .from("conexoes")
        .select()
        .eq("empresa_id", empresaId)
        .order("criado_em"),
    );
    return linhas.map(paraConexao);
  }

  async listarTodas() {
    const linhas = dadosOuFalha(
      await this.banco.from("conexoes").select().order("criado_em"),
    );
    return linhas.map(paraConexao);
  }

  async atualizarStatus(
    empresaId: string,
    conexaoId: string,
    dados: Omit<DadosDaConexao, "idExterno" | "banco">,
  ) {
    const { error } = await this.banco
      .from("conexoes")
      .update(colunasDeStatus(dados))
      .eq("empresa_id", empresaId)
      .eq("id", conexaoId);
    if (error) throw falhaDoBanco(error);
  }

  async marcarSincronizada(empresaId: string, conexaoId: string, em: Date) {
    const { error } = await this.banco
      .from("conexoes")
      .update({ ultima_sincronizacao_em: em.toISOString() })
      .eq("empresa_id", empresaId)
      .eq("id", conexaoId);
    if (error) throw falhaDoBanco(error);
  }
}
