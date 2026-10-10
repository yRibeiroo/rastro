import "server-only";
import { notFound, redirect } from "next/navigation";
import { ambiente } from "@/configuracao/ambiente";
import { ErroDeNegocio } from "../erros";
import type { FiltrosDoExtrato, PaginaDoExtrato } from "../extrato";
import { servicosDoUsuario, type ServicosDoUsuario } from "../montagem";
import type { PeriodoDoPainel, ResumoDoPainel } from "../painel";
import type {
  Anexo,
  Categoria,
  CentroDeCusto,
  Conexao,
  Id,
  Regra,
  Transacao,
} from "../tipos";

// Leituras para Server Components (dinâmicas: usam cookies). Sem sessão/allowlist => /entrar;
// recurso inexistente => notFound(); o resto propaga para o error.tsx da rota.

async function comServicos<T>(
  leitura: (s: ServicosDoUsuario) => Promise<T>,
): Promise<T> {
  let servicos: ServicosDoUsuario;
  try {
    servicos = await servicosDoUsuario();
  } catch (erro) {
    if (
      erro instanceof ErroDeNegocio &&
      (erro.codigo === "nao_autenticado" ||
        erro.codigo === "email_nao_autorizado")
    )
      redirect("/entrar");
    throw erro;
  }
  try {
    return await leitura(servicos);
  } catch (erro) {
    if (erro instanceof ErroDeNegocio && erro.codigo === "nao_encontrado")
      notFound();
    throw erro;
  }
}

/** Painel: período de até 24 meses (DataISO no fuso America/Araguaina). */
export async function carregarPainel(
  periodo: PeriodoDoPainel,
): Promise<ResumoDoPainel> {
  return comServicos((s) => s.painel.obterResumo(s.ctx, periodo));
}

/** Extrato paginado por cursor (limite padrão 50, máximo 200). */
export async function carregarExtrato(
  filtros: FiltrosDoExtrato,
): Promise<PaginaDoExtrato> {
  return comServicos((s) => s.extrato.listar(s.ctx, filtros));
}

/** Detalhe da transação com os anexos. Transação de outra empresa ou inexistente => notFound(). */
export async function carregarTransacao(
  transacaoId: Id,
): Promise<{ transacao: Transacao; anexos: Anexo[] }> {
  return comServicos(async (s) => {
    const transacao = await s.extrato.obter(s.ctx, transacaoId);
    const anexos = await s.anexos.listar(s.ctx, transacaoId);
    return { transacao, anexos };
  });
}

/** Tela de categorias: categorias (inclusive arquivadas), regras e centros de custo ativos. */
export async function carregarCategoriasERegras(): Promise<{
  categorias: Categoria[];
  regras: Regra[];
  centrosDeCusto: CentroDeCusto[];
}> {
  return comServicos(async (s) => {
    const [categorias, regras, centrosDeCusto] = await Promise.all([
      s.categorizacao.listarCategorias(s.ctx, { incluirArquivadas: true }),
      s.categorizacao.listarRegras(s.ctx),
      s.centrosDeCusto.listar(s.ctx),
    ]);
    return { categorias, regras, centrosDeCusto };
  });
}

export async function carregarCentrosDeCusto(opcoes?: {
  incluirArquivados?: boolean;
}): Promise<CentroDeCusto[]> {
  return comServicos((s) => s.centrosDeCusto.listar(s.ctx, opcoes));
}

export async function carregarConexoes(): Promise<Conexao[]> {
  return comServicos((s) => s.conexoes.listarConexoes(s.ctx));
}

/** Flags (ADR 0010) que a interface precisa, lidas no servidor e passadas como props. */
export async function carregarRecursos(): Promise<{
  anexos: boolean;
  categorizacaoIa: boolean;
  incluirSandbox: boolean;
}> {
  return {
    anexos: ambiente.RECURSO_ANEXOS,
    categorizacaoIa: ambiente.RECURSO_CATEGORIZACAO_IA,
    incluirSandbox: ambiente.PLUGGY_INCLUIR_SANDBOX,
  };
}
