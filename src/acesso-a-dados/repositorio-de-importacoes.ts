import "server-only";
import type { ImportacaoDeExtrato } from "@/regras-de-negocio/tipos";
import type { RepositorioDeImportacoes } from "./contratos";
import { dadosOuFalha, falhaDoBanco } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

export function paraImportacao(
  linha: Tables<"importacoes_de_extrato">,
): ImportacaoDeExtrato {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    conexaoId: linha.conexao_id,
    contaId: linha.conta_id,
    nomeDoArquivo: linha.nome_do_arquivo,
    periodo: { de: linha.periodo_de, ate: linha.periodo_ate },
    novas: linha.novas,
    atualizadas: linha.atualizadas,
    criadaEm: new Date(linha.criado_em),
  };
}

/** Insert só com service role (grants); leitura também pela sessão (RLS). */
export class RepositorioDeImportacoesSupabase implements RepositorioDeImportacoes {
  constructor(private readonly banco: ClienteDoBanco) {}

  async criar(
    empresaId: string,
    dados: Omit<ImportacaoDeExtrato, "id" | "empresaId" | "criadaEm">,
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("importacoes_de_extrato")
        .insert({
          empresa_id: empresaId,
          conexao_id: dados.conexaoId,
          conta_id: dados.contaId,
          nome_do_arquivo: dados.nomeDoArquivo,
          periodo_de: dados.periodo.de,
          periodo_ate: dados.periodo.ate,
          novas: dados.novas,
          atualizadas: dados.atualizadas,
        })
        .select()
        .single(),
    );
    return paraImportacao(linha);
  }

  async listar(empresaId: string) {
    return dadosOuFalha(
      await this.banco
        .from("importacoes_de_extrato")
        .select()
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false })
        .limit(200),
    ).map(paraImportacao);
  }

  async ultimoFimDePeriodo(empresaId: string, contaId: string) {
    const { data, error } = await this.banco
      .from("importacoes_de_extrato")
      .select("periodo_ate")
      .eq("empresa_id", empresaId)
      .eq("conta_id", contaId)
      .order("periodo_ate", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data?.periodo_ate ?? null;
  }
}
