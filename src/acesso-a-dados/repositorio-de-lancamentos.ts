import "server-only";
import { ErroDeNegocio } from "@/regras-de-negocio/erros";
import type { RepositorioDeLancamentos } from "./contratos";
import { dadosOuFalha, falhaDoBanco, paraReais } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";

// Mensagens levantadas pelas RPCs (migração 20261102130000) → texto para o usuário.
const MENSAGENS: Record<string, string> = {
  conta_nao_manual: "Escolha uma conta manual. Contas do banco recebem lançamentos só pelo extrato.",
  lancamento_nao_manual: "Só lançamentos manuais podem ser apagados. Os do extrato vêm do banco.",
  lancamento_com_anexos: "Remova os anexos deste lançamento antes de apagá-lo.",
  nome_invalido: "Dê um nome para a conta.",
  tipo_invalido: "Escolha o tipo da conta.",
  valor_invalido: "Informe um valor diferente de zero.",
  descricao_invalida: "Descreva o lançamento.",
  data_invalida: "Informe a data.",
};

type Resposta<T> = { data: T; error: { code?: string; message?: string } | null };

/** Erro conhecido da RPC vira mensagem específica; o resto segue o tratamento padrão. */
function resultado<T>(resposta: Resposta<T>): NonNullable<T> {
  const mensagem = resposta.error?.message ? MENSAGENS[resposta.error.message] : undefined;
  if (mensagem) throw new ErroDeNegocio("entrada_invalida", mensagem);
  return dadosOuFalha(resposta, {
    referencia: "Categoria ou centro de custo inválido.",
  });
}

/** Sessão do usuário (RLS + auth.uid()): as RPCs conferem a membership. */
export class RepositorioDeLancamentosSupabase implements RepositorioDeLancamentos {
  constructor(private readonly banco: ClienteDoBanco) {}

  async criarContaManual(
    empresaId: string,
    dados: Parameters<RepositorioDeLancamentos["criarContaManual"]>[1],
  ) {
    return resultado(
      await this.banco.rpc("criar_conta_manual", {
        p_empresa: empresaId,
        p_nome: dados.nome,
        p_tipo: dados.tipo,
        p_saldo_inicial: paraReais(dados.saldoInicialCentavos),
      }),
    );
  }

  async lancar(
    empresaId: string,
    dados: Parameters<RepositorioDeLancamentos["lancar"]>[1],
  ) {
    return resultado(
      await this.banco.rpc("lancar_manual", {
        p_empresa: empresaId,
        p_conta: dados.contaId,
        p_data: dados.data,
        p_descricao: dados.descricao,
        p_valor: paraReais(dados.valorCentavos),
        ...(dados.categoriaId ? { p_categoria: dados.categoriaId } : {}),
        ...(dados.centroDeCustoId ? { p_centro: dados.centroDeCustoId } : {}),
      }),
    );
  }

  async remover(empresaId: string, transacaoId: string) {
    const { error } = await this.banco.rpc("remover_lancamento_manual", {
      p_empresa: empresaId,
      p_transacao: transacaoId,
    });
    if (!error) return;
    const mensagem = error.message ? MENSAGENS[error.message] : undefined;
    if (mensagem) throw new ErroDeNegocio("entrada_invalida", mensagem);
    throw falhaDoBanco(error);
  }
}
