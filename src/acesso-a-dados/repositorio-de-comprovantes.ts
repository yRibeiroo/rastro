import "server-only";
import { comprovanteDuplicado } from "@/regras-de-negocio/comprovantes/servico";
import type {
  CampoCorrigivel,
  Comprovante,
  ItemDoComprovante,
  SituacaoDoComprovante,
  TipoDeComprovante,
} from "@/regras-de-negocio/tipos";
import type {
  DadosDoComprovanteNoBanco,
  RepositorioDeComprovantes,
} from "./contratos";
import {
  dadosOuFalha,
  falhaDoBanco,
  paraCentavos,
  paraReais,
} from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Json, Tables, TablesUpdate } from "./supabase/tipos-do-banco";

/** itens jsonb: valores em reais no banco (como as demais colunas), centavos no domínio. */
type ItemNoBanco = {
  descricao?: unknown;
  quantidade?: unknown;
  valor?: unknown;
};

export function paraComprovante(linha: Tables<"comprovantes">): Comprovante {
  const itens = Array.isArray(linha.itens)
    ? (linha.itens as ItemNoBanco[])
    : [];
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    transacaoId: linha.transacao_id,
    situacao: linha.situacao as SituacaoDoComprovante,
    tipo: linha.tipo as TipoDeComprovante | null,
    valorCentavos: linha.valor === null ? null : paraCentavos(linha.valor),
    data: linha.data,
    emissor: linha.emissor,
    documentoEmissor: linha.documento_emissor,
    chaveDeAcesso: linha.chave_de_acesso,
    itens: itens.map((i): ItemDoComprovante => ({
      descricao: String(i?.descricao ?? ""),
      quantidade: typeof i?.quantidade === "number" ? i.quantidade : null,
      valorCentavos:
        typeof i?.valor === "number" ? paraCentavos(i.valor) : null,
    })),
    confianca: linha.confianca === null ? null : Number(linha.confianca),
    erro: linha.erro,
    camposCorrigidos: linha.campos_corrigidos as CampoCorrigivel[],
    alerta: null,
    criadoEm: new Date(linha.criado_em),
    atualizadoEm: new Date(linha.atualizado_em),
  };
}

export function paraColunas(
  d: DadosDoComprovanteNoBanco,
): TablesUpdate<"comprovantes"> {
  const c: TablesUpdate<"comprovantes"> = {};
  if (d.situacao !== undefined) c.situacao = d.situacao;
  if (d.transacaoId !== undefined) c.transacao_id = d.transacaoId;
  if (d.tipo !== undefined) c.tipo = d.tipo;
  if (d.valorCentavos !== undefined)
    // valor > 0 no banco: guarda o absoluto.
    c.valor =
      d.valorCentavos === null ? null : paraReais(Math.abs(d.valorCentavos));
  if (d.data !== undefined) c.data = d.data;
  if (d.emissor !== undefined) c.emissor = d.emissor;
  if (d.documentoEmissor !== undefined)
    c.documento_emissor = d.documentoEmissor?.replace(/\D/g, "") || null;
  if (d.chaveDeAcesso !== undefined)
    c.chave_de_acesso = d.chaveDeAcesso?.replace(/\D/g, "") || null;
  if (d.itens !== undefined)
    c.itens = d.itens.map((i) => ({
      descricao: i.descricao,
      quantidade: i.quantidade,
      valor: i.valorCentavos === null ? null : paraReais(i.valorCentavos),
    })) as NonNullable<Json>;
  if (d.confianca !== undefined) c.confianca = d.confianca;
  if (d.erro !== undefined) c.erro = d.erro?.slice(0, 500) ?? null;
  if (d.camposCorrigidos !== undefined)
    c.campos_corrigidos = [...d.camposCorrigidos];
  return c;
}

/** Cliente da sessão (RLS por empresa): authenticated tem insert/update/delete em comprovantes. */
export class RepositorioDeComprovantesSupabase implements RepositorioDeComprovantes {
  constructor(private readonly banco: ClienteDoBanco) {}

  async criar(empresaId: string, enviadoPor: string) {
    const linha = dadosOuFalha(
      await this.banco
        .from("comprovantes")
        .insert({
          empresa_id: empresaId,
          situacao: "lendo",
          enviado_por: enviadoPor,
        })
        .select()
        .single(),
    );
    return paraComprovante(linha);
  }

  async buscarPorId(empresaId: string, comprovanteId: string) {
    const { data, error } = await this.banco
      .from("comprovantes")
      .select()
      .eq("empresa_id", empresaId)
      .eq("id", comprovanteId)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data ? paraComprovante(data) : null;
  }

  async buscarPorChave(empresaId: string, chaveDeAcesso: string) {
    const { data, error } = await this.banco
      .from("comprovantes")
      .select()
      .eq("empresa_id", empresaId)
      .eq("chave_de_acesso", chaveDeAcesso)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data ? paraComprovante(data) : null;
  }

  async contarLeiturasDesde(empresaId: string, desde: Date) {
    const { data, error } = await this.banco.rpc(
      "leituras_de_comprovante_desde",
      { p_empresa: empresaId, p_desde: desde.toISOString() },
    );
    if (error) throw falhaDoBanco(error);
    return Number(data ?? 0);
  }

  async registrarLeitura(empresaId: string, comprovanteId: string, em: Date) {
    // ponytail: ler-e-gravar (sem array_append no PostgREST); duas releituras simultâneas podem contar uma só.
    const { data, error } = await this.banco
      .from("comprovantes")
      .select("leituras_ia_em")
      .eq("empresa_id", empresaId)
      .eq("id", comprovanteId)
      .single();
    if (error) throw falhaDoBanco(error);
    const { error: falha } = await this.banco
      .from("comprovantes")
      .update({ leituras_ia_em: [...data.leituras_ia_em, em.toISOString()] })
      .eq("empresa_id", empresaId)
      .eq("id", comprovanteId);
    if (falha) throw falhaDoBanco(falha);
  }

  async empresasComPendentes() {
    const linhas = dadosOuFalha(
      await this.banco
        .from("comprovantes")
        .select("empresa_id")
        .eq("situacao", "pendente"),
    );
    return [...new Set(linhas.map((l) => l.empresa_id))];
  }

  async listarTransacoesConciliadas(
    empresaId: string,
    transacaoIds: readonly string[],
  ) {
    if (!transacaoIds.length) return [];
    return dadosOuFalha(
      await this.banco
        .from("comprovantes")
        .select("transacao_id")
        .eq("empresa_id", empresaId)
        .in("transacao_id", [...transacaoIds]),
    ).flatMap((l) => (l.transacao_id ? [l.transacao_id] : []));
  }

  async listar(
    empresaId: string,
    filtros?: { situacao?: SituacaoDoComprovante },
  ) {
    let consulta = this.banco
      .from("comprovantes")
      .select()
      .eq("empresa_id", empresaId);
    if (filtros?.situacao) consulta = consulta.eq("situacao", filtros.situacao);
    return dadosOuFalha(
      await consulta.order("criado_em", { ascending: false }).limit(500),
    ).map(paraComprovante);
  }

  async atualizar(
    empresaId: string,
    comprovanteId: string,
    dados: DadosDoComprovanteNoBanco,
  ) {
    const { data, error } = await this.banco
      .from("comprovantes")
      .update(paraColunas(dados))
      .eq("empresa_id", empresaId)
      .eq("id", comprovanteId)
      .select()
      .single();
    if (error?.code === "23505") {
      // Corrida: outra requisição gravou a mesma chave antes (unique (empresa_id, chave_de_acesso)).
      const existente = dados.chaveDeAcesso
        ? await this.buscarPorChave(empresaId, dados.chaveDeAcesso)
        : null;
      throw comprovanteDuplicado(existente?.criadoEm ?? new Date());
    }
    if (error)
      throw falhaDoBanco(error, {
        naoEncontrado: "Comprovante não encontrado.",
      });
    return paraComprovante(data);
  }

  async remover(empresaId: string, comprovanteId: string) {
    const { error } = await this.banco
      .from("comprovantes")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", comprovanteId);
    if (error) throw falhaDoBanco(error);
  }
}
