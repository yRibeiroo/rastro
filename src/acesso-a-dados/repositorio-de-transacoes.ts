import "server-only";
import {
  normalizarTexto,
  regraCorresponde,
  type ResultadoDeCategorizacao,
} from "@/regras-de-negocio/categorizacao";
import type { TransacaoDoProvedor } from "@/regras-de-negocio/conexao-bancaria";
import {
  codificarCursor,
  decodificarCursor,
  type FiltrosDoExtrato,
  type PaginaDoExtrato,
} from "@/regras-de-negocio/extrato";
import type {
  OrigemDaCategoria,
  Regra,
  Transacao,
} from "@/regras-de-negocio/tipos";
import type { RepositorioDeTransacoes } from "./contratos";
import {
  dadosOuFalha,
  falhaDoBanco,
  paraCentavos,
  paraDataOuNulo,
  paraReais,
} from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

export function paraTransacao(linha: Tables<"transacoes">): Transacao {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    conexaoId: linha.conexao_id,
    contaId: linha.conta_id,
    idExterno: linha.id_externo,
    data: linha.data,
    descricao: linha.descricao,
    descricaoOriginal: linha.descricao_original,
    valorCentavos: paraCentavos(linha.valor),
    pendente: linha.pendente,
    contraparte: linha.contraparte,
    metodoDePagamento: linha.metodo_de_pagamento,
    categoriaDoProvedor: linha.categoria_do_provedor,
    categoriaId: linha.categoria_id,
    centroDeCustoId: linha.centro_de_custo_id,
    categoriaOrigem: linha.categoria_origem as OrigemDaCategoria | null,
    categoriaDefinidaPeloUsuario: linha.categoria_definida_pelo_usuario,
    regraId: linha.regra_id,
    confiancaIa: linha.confianca_ia === null ? null : Number(linha.confianca_ia),
    categorizacaoAutomaticaEm: paraDataOuNulo(linha.categorizacao_automatica_em),
    criadaEm: new Date(linha.criado_em),
    atualizadaEm: new Date(linha.atualizado_em),
  };
}

const LOTE_DE_GRAVACAO = 500;
const LOTE_DE_IDS = 200; // ids vão na URL do PostgREST

const lotes = <T>(itens: readonly T[], tamanho: number): T[][] => {
  const saida: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho)
    saida.push(itens.slice(i, i + tamanho));
  return saida;
};

/** Termo de busca seguro para o filtro `or` do PostgREST (sem curingas nem separadores). */
const termoDeBusca = (texto: string) => texto.replace(/[%_\\"(),.:*]/g, " ").trim();

/**
 * Padrão `ilike` que tolera acento: vogais e C viram `_` (um caractere qualquer).
 * O resultado é refinado com regraCorresponde() (sem acento, de verdade) em memória.
 */
function padraoTolerante(padrao: string): string {
  return `%${normalizarTexto(padrao)
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/[AEIOUC]/g, "_")}%`;
}

export class RepositorioDeTransacoesSupabase implements RepositorioDeTransacoes {
  constructor(private readonly banco: ClienteDoBanco) {}

  async salvarDoProvedor(
    empresaId: string,
    conexaoId: string,
    linhas: ReadonlyArray<TransacaoDoProvedor & { contaId: string }>,
  ) {
    let gravadas = 0;
    for (const lote of lotes(linhas, LOTE_DE_GRAVACAO)) {
      // Upsert por (empresa_id, id_externo) SEM as colunas de categoria: o
      // ON CONFLICT DO UPDATE só altera o que foi enviado (a categoria do usuário fica).
      const { error } = await this.banco.from("transacoes").upsert(
        lote.map((t) => ({
          empresa_id: empresaId,
          conexao_id: conexaoId,
          conta_id: t.contaId,
          id_externo: t.idExterno,
          data: t.data,
          descricao: t.descricao,
          descricao_original: t.descricaoOriginal,
          valor: paraReais(t.valorCentavos),
          pendente: t.pendente,
          contraparte: t.contraparte,
          metodo_de_pagamento: t.metodoDePagamento,
          categoria_do_provedor: t.categoriaDoProvedor,
        })),
        { onConflict: "empresa_id,id_externo" },
      );
      if (error) throw falhaDoBanco(error);
      gravadas += lote.length;
    }
    return gravadas;
  }

  async removerPorIdsExternos(empresaId: string, idsExternos: readonly string[]) {
    let removidas = 0;
    for (const lote of lotes(idsExternos, LOTE_DE_IDS)) {
      const { count, error } = await this.banco
        .from("transacoes")
        .delete({ count: "exact" })
        .eq("empresa_id", empresaId)
        .in("id_externo", lote);
      if (error) throw falhaDoBanco(error);
      removidas += count ?? 0;
    }
    return removidas;
  }

  async listar(empresaId: string, f: FiltrosDoExtrato): Promise<PaginaDoExtrato> {
    const limite = f.limite ?? 50;
    let consulta = this.banco
      .from("transacoes")
      .select()
      .eq("empresa_id", empresaId);
    if (f.dataDe) consulta = consulta.gte("data", f.dataDe);
    if (f.dataAte) consulta = consulta.lte("data", f.dataAte);
    if (f.categoriaId === "sem_categoria")
      consulta = consulta.is("categoria_id", null);
    else if (f.categoriaId) consulta = consulta.eq("categoria_id", f.categoriaId);
    if (f.centroDeCustoId === "sem_centro")
      consulta = consulta.is("centro_de_custo_id", null);
    else if (f.centroDeCustoId)
      consulta = consulta.eq("centro_de_custo_id", f.centroDeCustoId);
    if (f.sentido === "entrada") consulta = consulta.gt("valor", 0);
    if (f.sentido === "saida") consulta = consulta.lt("valor", 0);
    if (f.contaId) consulta = consulta.eq("conta_id", f.contaId);
    if (f.busca) {
      // ponytail: sem a extensão unaccent, busca o termo como digitado e sem acento.
      const termos = [...new Set([termoDeBusca(f.busca), termoDeBusca(normalizarTexto(f.busca))])]
        .filter(Boolean);
      if (termos.length)
        consulta = consulta.or(
          termos
            .flatMap((t) => [`descricao.ilike."%${t}%"`, `contraparte.ilike."%${t}%"`])
            .join(","),
        );
    }
    const cursor = f.cursor ? decodificarCursor(f.cursor) : null;
    if (cursor)
      consulta = consulta.or(
        `data.lt.${cursor.data},and(data.eq.${cursor.data},id.lt.${cursor.id})`,
      );
    const linhas = dadosOuFalha(
      await consulta
        .order("data", { ascending: false })
        .order("id", { ascending: false })
        .limit(limite + 1),
    );
    const itens = linhas.slice(0, limite).map(paraTransacao);
    return {
      itens,
      proximoCursor:
        linhas.length > limite ? codificarCursor(itens[itens.length - 1]) : null,
    };
  }

  async buscarPorId(empresaId: string, transacaoId: string) {
    const { data, error } = await this.banco
      .from("transacoes")
      .select()
      .eq("empresa_id", empresaId)
      .eq("id", transacaoId)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data ? paraTransacao(data) : null;
  }

  async listarPendentesDeCategorizacao(empresaId: string, limite: number) {
    const linhas = dadosOuFalha(
      await this.banco
        .from("transacoes")
        .select()
        .eq("empresa_id", empresaId)
        .is("categoria_id", null)
        .is("categorizacao_automatica_em", null)
        .eq("categoria_definida_pelo_usuario", false)
        .order("data", { ascending: false })
        .limit(limite),
    );
    return linhas.map(paraTransacao);
  }

  async aplicarCategorizacaoAutomatica(
    empresaId: string,
    resultados: readonly ResultadoDeCategorizacao[],
  ) {
    if (!resultados.length) return 0;
    return dadosOuFalha(
      await this.banco.rpc("aplicar_categorizacao_automatica", {
        p_empresa: empresaId,
        p_resultados: resultados.map((r) => ({
          transacao_id: r.transacaoId,
          categoria_id: r.categoriaId,
          centro_de_custo_id: r.centroDeCustoId,
          origem: r.origem,
          regra_id: r.regraId,
          confianca: r.confianca,
        })),
      }),
    );
  }

  async marcarCategorizacaoTentada(empresaId: string, transacaoIds: readonly string[]) {
    const agora = new Date().toISOString();
    for (const lote of lotes(transacaoIds, LOTE_DE_IDS)) {
      const { error } = await this.banco
        .from("transacoes")
        .update({ categorizacao_automatica_em: agora })
        .eq("empresa_id", empresaId)
        .eq("categoria_definida_pelo_usuario", false)
        .in("id", lote);
      if (error) throw falhaDoBanco(error);
    }
  }

  async definirCategoriaPeloUsuario(
    empresaId: string,
    transacaoId: string,
    dados: { categoriaId: string | null; centroDeCustoId: string | null },
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("transacoes")
        .update({
          categoria_id: dados.categoriaId,
          centro_de_custo_id: dados.centroDeCustoId,
          categoria_origem: "usuario",
          categoria_definida_pelo_usuario: true,
          regra_id: null,
          confianca_ia: null,
        })
        .eq("empresa_id", empresaId)
        .eq("id", transacaoId)
        .select()
        .single(),
      {
        referencia: "Categoria ou centro de custo inválido.",
        naoEncontrado: "Transação não encontrada.",
      },
    );
    return paraTransacao(linha);
  }

  async listarCorrespondentesARegra(
    empresaId: string,
    regra: Pick<Regra, "padrao" | "campo">,
    opcoes: { excluirId?: string; limite: number },
  ) {
    const coluna = regra.campo === "contraparte" ? "contraparte" : "descricao";
    let consulta = this.banco
      .from("transacoes")
      .select()
      .eq("empresa_id", empresaId)
      .eq("categoria_definida_pelo_usuario", false)
      .ilike(coluna, padraoTolerante(regra.padrao));
    if (opcoes.excluirId) consulta = consulta.neq("id", opcoes.excluirId);
    const linhas = dadosOuFalha(
      await consulta.order("data", { ascending: false }).limit(opcoes.limite),
    );
    return linhas
      .map(paraTransacao)
      .filter((t) => regraCorresponde(regra, t))
      .slice(0, opcoes.limite);
  }

  async contarSemCategoria(empresaId: string, periodo?: { de: string; ate: string }) {
    let consulta = this.banco
      .from("transacoes")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .is("categoria_id", null)
      .eq("pendente", false);
    if (periodo)
      consulta = consulta.gte("data", periodo.de).lte("data", periodo.ate);
    const { count, error } = await consulta;
    if (error) throw falhaDoBanco(error);
    return count ?? 0;
  }
}
