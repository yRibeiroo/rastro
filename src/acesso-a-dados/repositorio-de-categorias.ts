import "server-only";
import type {
  Categoria,
  CentroDeCusto,
  TipoDeCategoria,
} from "@/regras-de-negocio/tipos";
import type {
  RepositorioDeCategorias,
  RepositorioDeCentrosDeCusto,
} from "./contratos";
import { dadosOuFalha } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

export function paraCategoria(linha: Tables<"categorias">): Categoria {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    nome: linha.nome,
    tipo: linha.tipo as TipoDeCategoria,
    entraNoResultado: linha.entra_no_resultado,
    padrao: linha.padrao,
    arquivada: linha.arquivada,
  };
}

const MENSAGENS_DA_CATEGORIA = {
  duplicado: "Já existe uma categoria com esse nome.",
  referencia: "Essa categoria é usada por uma regra.",
  naoEncontrado: "Categoria não encontrada.",
};

export class RepositorioDeCategoriasSupabase implements RepositorioDeCategorias {
  constructor(private readonly banco: ClienteDoBanco) {}

  async listar(empresaId: string, opcoes?: { incluirArquivadas?: boolean }) {
    let consulta = this.banco
      .from("categorias")
      .select()
      .eq("empresa_id", empresaId);
    if (!opcoes?.incluirArquivadas) consulta = consulta.eq("arquivada", false);
    return dadosOuFalha(await consulta.order("nome")).map(paraCategoria);
  }

  async criar(
    empresaId: string,
    dados: { nome: string; tipo: TipoDeCategoria; entraNoResultado: boolean },
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("categorias")
        .insert({
          empresa_id: empresaId,
          nome: dados.nome,
          tipo: dados.tipo,
          entra_no_resultado: dados.entraNoResultado,
        })
        .select()
        .single(),
      MENSAGENS_DA_CATEGORIA,
    );
    return paraCategoria(linha);
  }

  async atualizar(
    empresaId: string,
    categoriaId: string,
    dados: Partial<
      Pick<Categoria, "nome" | "tipo" | "entraNoResultado" | "arquivada">
    >,
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("categorias")
        .update({
          nome: dados.nome,
          tipo: dados.tipo,
          entra_no_resultado: dados.entraNoResultado,
          arquivada: dados.arquivada,
        })
        .eq("empresa_id", empresaId)
        .eq("id", categoriaId)
        .select()
        .single(),
      MENSAGENS_DA_CATEGORIA,
    );
    return paraCategoria(linha);
  }
}

export function paraCentroDeCusto(
  linha: Tables<"centros_de_custo">,
): CentroDeCusto {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    nome: linha.nome,
    padrao: linha.padrao,
    arquivado: linha.arquivado,
  };
}

const MENSAGENS_DO_CENTRO = {
  duplicado: "Já existe um centro de custo com esse nome.",
  naoEncontrado: "Centro de custo não encontrado.",
};

export class RepositorioDeCentrosDeCustoSupabase implements RepositorioDeCentrosDeCusto {
  constructor(private readonly banco: ClienteDoBanco) {}

  async listar(empresaId: string, opcoes?: { incluirArquivados?: boolean }) {
    let consulta = this.banco
      .from("centros_de_custo")
      .select()
      .eq("empresa_id", empresaId);
    if (!opcoes?.incluirArquivados) consulta = consulta.eq("arquivado", false);
    return dadosOuFalha(await consulta.order("nome")).map(paraCentroDeCusto);
  }

  async criar(empresaId: string, dados: { nome: string }) {
    const linha = dadosOuFalha(
      await this.banco
        .from("centros_de_custo")
        .insert({ empresa_id: empresaId, nome: dados.nome })
        .select()
        .single(),
      MENSAGENS_DO_CENTRO,
    );
    return paraCentroDeCusto(linha);
  }

  async atualizar(
    empresaId: string,
    centroDeCustoId: string,
    dados: Partial<Pick<CentroDeCusto, "nome" | "arquivado">>,
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("centros_de_custo")
        .update({ nome: dados.nome, arquivado: dados.arquivado })
        .eq("empresa_id", empresaId)
        .eq("id", centroDeCustoId)
        .select()
        .single(),
      MENSAGENS_DO_CENTRO,
    );
    return paraCentroDeCusto(linha);
  }
}
