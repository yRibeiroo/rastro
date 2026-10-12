import "server-only";
import { unstable_rethrow } from "next/navigation";
import {
  ErroDeNegocio,
  MENSAGEM_INESPERADA,
  registrarFalha,
  type ResultadoDaAcao,
} from "../erros";

/**
 * Converte o resultado de uma Server Action em ResultadoDaAcao<T>.
 * ErroDeNegocio vira mensagem segura; qualquer outro erro é logado (sem dados) e vira "Algo deu errado".
 * redirect()/notFound() do Next passam direto.
 */
export async function executarAcao<T>(
  nome: string,
  operacao: () => Promise<T>,
): Promise<ResultadoDaAcao<T>> {
  try {
    return { ok: true, dados: await operacao() };
  } catch (erro) {
    unstable_rethrow(erro);
    if (erro instanceof ErroDeNegocio)
      return {
        ok: false,
        erro: { codigo: erro.codigo, mensagem: erro.mensagemParaUsuario },
      };
    registrarFalha(`ação ${nome}`, erro);
    return {
      ok: false,
      erro: { codigo: "inesperado", mensagem: MENSAGEM_INESPERADA },
    };
  }
}

/** IP do cliente: primeiro valor de x-forwarded-for (definido pela Vercel). */
export function ipDaRequisicao(cabecalhos: Headers): string | null {
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || cabecalhos.get("x-real-ip")?.trim() || null;
}
