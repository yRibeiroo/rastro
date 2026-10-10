import "server-only";
import type {
  CampoDaRegra,
  OrigemDaRegra,
  Regra,
} from "@/regras-de-negocio/tipos";
import type { RepositorioDeRegras } from "./contratos";
import { dadosOuFalha, falhaDoBanco } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

export function paraRegra(linha: Tables<"regras_categorizacao">): Regra {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    padrao: linha.padrao,
    campo: linha.campo as CampoDaRegra,
    prioridade: linha.prioridade,
    categoriaId: linha.categoria_id,
    centroDeCustoId: linha.centro_de_custo_id,
    origem: linha.origem as OrigemDaRegra,
    ativa: linha.ativa,
    criadaEm: new Date(linha.criado_em),
  };
}

const MENSAGENS = {
  duplicado: "Já existe uma regra com essa condição.",
  referencia: "Categoria ou centro de custo inválido.",
  naoEncontrado: "Regra não encontrada.",
};

type Alteracoes = Partial<
  Pick<
    Regra,
    "padrao" | "campo" | "prioridade" | "categoriaId" | "centroDeCustoId" | "ativa"
  >
>;

export class RepositorioDeRegrasSupabase implements RepositorioDeRegras {
  constructor(private readonly banco: ClienteDoBanco) {}

  async listarAtivas(empresaId: string) {
    return dadosOuFalha(
      await this.banco
        .from("regras_categorizacao")
        .select()
        .eq("empresa_id", empresaId)
        .eq("ativa", true)
        .order("prioridade")
        .order("criado_em"),
    ).map(paraRegra);
  }

  async listar(empresaId: string) {
    return dadosOuFalha(
      await this.banco
        .from("regras_categorizacao")
        .select()
        .eq("empresa_id", empresaId)
        .order("prioridade")
        .order("criado_em"),
    ).map(paraRegra);
  }

  async criar(
    empresaId: string,
    dados: Omit<Regra, "id" | "empresaId" | "criadaEm" | "ativa">,
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("regras_categorizacao")
        .insert({
          empresa_id: empresaId,
          padrao: dados.padrao,
          campo: dados.campo,
          prioridade: dados.prioridade,
          categoria_id: dados.categoriaId,
          centro_de_custo_id: dados.centroDeCustoId,
          origem: dados.origem,
        })
        .select()
        .single(),
      MENSAGENS,
    );
    return paraRegra(linha);
  }

  async atualizar(empresaId: string, regraId: string, dados: Alteracoes) {
    const linha = dadosOuFalha(
      await this.banco
        .from("regras_categorizacao")
        .update({
          padrao: dados.padrao,
          campo: dados.campo,
          prioridade: dados.prioridade,
          categoria_id: dados.categoriaId,
          centro_de_custo_id: dados.centroDeCustoId,
          ativa: dados.ativa,
        })
        .eq("empresa_id", empresaId)
        .eq("id", regraId)
        .select()
        .single(),
      MENSAGENS,
    );
    return paraRegra(linha);
  }

  async remover(empresaId: string, regraId: string) {
    const { error } = await this.banco
      .from("regras_categorizacao")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", regraId);
    if (error) throw falhaDoBanco(error, MENSAGENS);
  }
}
