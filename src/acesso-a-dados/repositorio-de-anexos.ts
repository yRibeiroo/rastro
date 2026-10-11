import "server-only";
import type { Anexo } from "@/regras-de-negocio/tipos";
import type { ArmazenamentoDeArquivos, RepositorioDeAnexos } from "./contratos";
import { dadosOuFalha, falhaDoBanco } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

export const BUCKET_DE_ANEXOS = "anexos";

export function paraAnexo(linha: Tables<"anexos">): Anexo {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    transacaoId: linha.transacao_id,
    comprovanteId: linha.comprovante_id,
    caminho: linha.caminho,
    nomeArquivo: linha.nome_arquivo,
    tipoMime: linha.tipo_mime as Anexo["tipoMime"],
    tamanhoBytes: linha.tamanho_bytes,
    criadoEm: new Date(linha.criado_em),
  };
}

export class RepositorioDeAnexosSupabase implements RepositorioDeAnexos {
  constructor(private readonly banco: ClienteDoBanco) {}

  async criar(
    empresaId: string,
    dados: Omit<Anexo, "id" | "empresaId" | "criadoEm">,
    enviadoPor: string,
  ) {
    const linha = dadosOuFalha(
      await this.banco
        .from("anexos")
        .insert({
          empresa_id: empresaId,
          transacao_id: dados.transacaoId,
          comprovante_id: dados.comprovanteId,
          caminho: dados.caminho,
          nome_arquivo: dados.nomeArquivo,
          tipo_mime: dados.tipoMime,
          tamanho_bytes: dados.tamanhoBytes,
          enviado_por: enviadoPor,
        })
        .select()
        .single(),
    );
    return paraAnexo(linha);
  }

  /** Anexos da transação + arquivos dos comprovantes conciliados com ela (ADR 0016). */
  async listar(empresaId: string, transacaoId: string) {
    const comprovantes = dadosOuFalha(
      await this.banco
        .from("comprovantes")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("transacao_id", transacaoId),
    ).map((c) => c.id);
    let consulta = this.banco
      .from("anexos")
      .select()
      .eq("empresa_id", empresaId);
    consulta = comprovantes.length
      ? consulta.or(
          `transacao_id.eq.${transacaoId},comprovante_id.in.(${comprovantes.join(",")})`,
        )
      : consulta.eq("transacao_id", transacaoId);
    return dadosOuFalha(await consulta.order("criado_em")).map(paraAnexo);
  }

  async buscarPorComprovante(empresaId: string, comprovanteId: string) {
    const { data, error } = await this.banco
      .from("anexos")
      .select()
      .eq("empresa_id", empresaId)
      .eq("comprovante_id", comprovanteId)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data ? paraAnexo(data) : null;
  }

  async buscarPorId(empresaId: string, anexoId: string) {
    const { data, error } = await this.banco
      .from("anexos")
      .select()
      .eq("empresa_id", empresaId)
      .eq("id", anexoId)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data ? paraAnexo(data) : null;
  }

  async remover(empresaId: string, anexoId: string) {
    const { error } = await this.banco
      .from("anexos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", anexoId);
    if (error) throw falhaDoBanco(error);
  }
}

/** Bucket privado 'anexos'. Com o cliente do usuário, a policy do Storage confere a empresa. */
export class ArmazenamentoDeArquivosSupabase implements ArmazenamentoDeArquivos {
  constructor(private readonly banco: ClienteDoBanco) {}

  private get bucket() {
    return this.banco.storage.from(BUCKET_DE_ANEXOS);
  }

  async enviar(caminho: string, conteudo: Blob, tipoMime: string) {
    const { error } = await this.bucket.upload(caminho, conteudo, {
      contentType: tipoMime,
      upsert: false,
    });
    if (error) throw falhaDoBanco({ code: "storage" });
  }

  async baixar(caminho: string) {
    const { data, error } = await this.bucket.download(caminho);
    if (error || !data) throw falhaDoBanco({ code: "storage" });
    return new Uint8Array(await data.arrayBuffer());
  }

  async gerarUrlAssinada(caminho: string, segundos: number) {
    const { data, error } = await this.bucket.createSignedUrl(
      caminho,
      segundos,
    );
    if (error || !data) throw falhaDoBanco({ code: "storage" });
    return data.signedUrl;
  }

  async remover(caminhos: readonly string[]) {
    if (!caminhos.length) return;
    const { error } = await this.bucket.remove([...caminhos]);
    if (error) throw falhaDoBanco({ code: "storage" });
  }
}
