import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  ArmazenamentoDeArquivos,
  RepositorioDeAnexos,
  RepositorioDeTransacoes,
} from "@/acesso-a-dados/contratos";
import { exigirLimite, LIMITES, type ConsumirLimite } from "../acesso";
import { ErroDeNegocio, registrarFalha } from "../erros";
import type { Anexo, ContextoDoUsuario, Id } from "../tipos";

export interface ServicoDeAnexos {
  /** Requer RECURSO_ANEXOS. Valida tipo (pelos bytes iniciais, não só pelo MIME declarado) e tamanho ≤ 4 MB. Rate limit 30/h. */
  anexar(
    ctx: ContextoDoUsuario,
    transacaoId: Id,
    arquivo: File,
  ): Promise<Anexo>;
  listar(ctx: ContextoDoUsuario, transacaoId: Id): Promise<Anexo[]>;
  /** URL assinada válida por 60 s. */
  gerarLinkTemporario(
    ctx: ContextoDoUsuario,
    anexoId: Id,
  ): Promise<{ url: string; expiraEm: Date }>;
  remover(ctx: ContextoDoUsuario, anexoId: Id): Promise<void>;
}

export const TAMANHO_MAXIMO_DO_ANEXO = 4 * 1024 * 1024; // limite da Vercel: 4,5 MB por requisição
export const VALIDADE_DO_LINK_EM_SEGUNDOS = 60;

type TipoMime = Anexo["tipoMime"];
const EXTENSOES: Record<TipoMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const comeca = (bytes: Uint8Array, assinatura: number[], deslocamento = 0) =>
  assinatura.every((b, i) => bytes[deslocamento + i] === b);

/** Tipo real pelos "magic bytes". null = não é um dos formatos aceitos. */
export function detectarTipo(bytes: Uint8Array): TipoMime | null {
  if (comeca(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (
    comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && // RIFF
    comeca(bytes, [0x57, 0x45, 0x42, 0x50], 8) // WEBP
  )
    return "image/webp";
  return null;
}

/** Nome exibido: sem caminho nem caracteres de controle, até 255. */
export function limparNomeDoArquivo(nome: string, tipo: TipoMime): string {
  const limpo = nome
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  return limpo || `anexo.${EXTENSOES[tipo]}`;
}

const anexoInvalido = () =>
  new ErroDeNegocio(
    "anexo_invalido",
    "Arquivo não permitido (PDF, JPG, PNG ou WEBP de até 4 MB).",
  );
const naoEncontrado = (o: string) =>
  new ErroDeNegocio("nao_encontrado", `${o} não encontrado.`);

export function criarServicoDeAnexos(deps: {
  anexos: RepositorioDeAnexos;
  armazenamento: ArmazenamentoDeArquivos;
  transacoes: Pick<RepositorioDeTransacoes, "buscarPorId">;
  consumirLimite: ConsumirLimite;
  /** RECURSO_ANEXOS */
  anexosLigados: () => boolean;
  agora?: () => Date;
}): ServicoDeAnexos {
  const agora = deps.agora ?? (() => new Date());
  const valido = (id: unknown) => z.uuid().safeParse(id).success;

  async function exigirTransacao(ctx: ContextoDoUsuario, transacaoId: Id) {
    if (
      !valido(transacaoId) ||
      !(await deps.transacoes.buscarPorId(ctx.empresaId, transacaoId))
    )
      throw new ErroDeNegocio("nao_encontrado", "Transação não encontrada.");
  }

  async function exigirAnexo(ctx: ContextoDoUsuario, anexoId: Id) {
    const anexo = valido(anexoId)
      ? await deps.anexos.buscarPorId(ctx.empresaId, anexoId)
      : null;
    if (!anexo) throw naoEncontrado("Anexo");
    return anexo;
  }

  return {
    async anexar(ctx, transacaoId, arquivo) {
      if (!deps.anexosLigados())
        throw new ErroDeNegocio(
          "recurso_desligado",
          "Os anexos estão desligados no momento.",
        );
      if (
        !(arquivo instanceof Blob) ||
        arquivo.size < 1 ||
        arquivo.size > TAMANHO_MAXIMO_DO_ANEXO
      )
        throw anexoInvalido();
      await exigirTransacao(ctx, transacaoId);
      await exigirLimite(
        deps.consumirLimite,
        `anexo:usuario:${ctx.usuarioId}`,
        LIMITES.anexo,
      );

      const bytes = new Uint8Array(await arquivo.slice(0, 16).arrayBuffer());
      const tipo = detectarTipo(bytes);
      // O MIME declarado, se veio, precisa bater com o conteúdo real.
      if (!tipo || (arquivo.type && arquivo.type !== tipo))
        throw anexoInvalido();

      const caminho = `${ctx.empresaId}/${transacaoId}/${randomUUID()}.${EXTENSOES[tipo]}`;
      await deps.armazenamento.enviar(caminho, arquivo, tipo);
      try {
        return await deps.anexos.criar(
          ctx.empresaId,
          {
            transacaoId,
            comprovanteId: null,
            caminho,
            nomeArquivo: limparNomeDoArquivo(
              (arquivo as File).name ?? "",
              tipo,
            ),
            tipoMime: tipo,
            tamanhoBytes: arquivo.size,
          },
          ctx.usuarioId,
        );
      } catch (erro) {
        // Sem a linha, o arquivo vira órfão: remove (melhor esforço) e propaga.
        await deps.armazenamento
          .remover([caminho])
          .catch((e) => registrarFalha("remover anexo órfão", e));
        throw erro;
      }
    },

    async listar(ctx, transacaoId) {
      await exigirTransacao(ctx, transacaoId);
      return deps.anexos.listar(ctx.empresaId, transacaoId);
    },

    async gerarLinkTemporario(ctx, anexoId) {
      const anexo = await exigirAnexo(ctx, anexoId);
      const expiraEm = new Date(
        agora().getTime() + VALIDADE_DO_LINK_EM_SEGUNDOS * 1000,
      );
      const url = await deps.armazenamento.gerarUrlAssinada(
        anexo.caminho,
        VALIDADE_DO_LINK_EM_SEGUNDOS,
      );
      return { url, expiraEm };
    },

    async remover(ctx, anexoId) {
      const anexo = await exigirAnexo(ctx, anexoId);
      // O arquivo de um comprovante sai junto com ele, na tela de Comprovantes.
      if (anexo.comprovanteId)
        throw new ErroDeNegocio(
          "entrada_invalida",
          "Esse arquivo é de um comprovante: remova-o na tela de Comprovantes.",
        );
      await deps.anexos.remover(ctx.empresaId, anexo.id);
      await deps.armazenamento
        .remover([anexo.caminho])
        .catch((e) => registrarFalha("remover arquivo do anexo", e));
    },
  };
}
