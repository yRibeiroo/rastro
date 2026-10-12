import "server-only";
import type { ContaDoProvedor } from "@/regras-de-negocio/conexao-bancaria";
import type { Conta, TipoDeConta } from "@/regras-de-negocio/tipos";
import type { RepositorioDeContas } from "./contratos";
import { dadosOuFalha, paraCentavos, paraReais } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";
import type { Tables } from "./supabase/tipos-do-banco";

export function paraConta(linha: Tables<"contas">): Conta {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    conexaoId: linha.conexao_id,
    idExterno: linha.id_externo,
    nome: linha.nome,
    tipo: (linha.tipo ?? "corrente") as TipoDeConta,
    numeroFinal: linha.numero,
    saldoCentavos: paraCentavos(linha.saldo),
    saldoAtualizadoEm: new Date(linha.saldo_atualizado_em),
  };
}

export class RepositorioDeContasSupabase implements RepositorioDeContas {
  constructor(private readonly banco: ClienteDoBanco) {}

  async salvarVarias(
    empresaId: string,
    conexaoId: string,
    contas: readonly ContaDoProvedor[],
  ) {
    const agora = new Date().toISOString();
    const linhas = dadosOuFalha(
      await this.banco
        .from("contas")
        .upsert(
          contas.map((c) => ({
            empresa_id: empresaId,
            conexao_id: conexaoId,
            id_externo: c.idExterno,
            nome: c.nome.slice(0, 200),
            tipo: c.tipo,
            numero: c.numeroFinal,
            saldo: paraReais(c.saldoCentavos),
            saldo_atualizado_em: agora,
          })),
          { onConflict: "conexao_id,id_externo" },
        )
        .select(),
    );
    return linhas.map(paraConta);
  }

  async listar(empresaId: string) {
    const linhas = dadosOuFalha(
      await this.banco
        .from("contas")
        .select()
        .eq("empresa_id", empresaId)
        .order("criado_em"),
    );
    return linhas.map(paraConta);
  }

  async obterSaldoTotal(empresaId: string) {
    const linhas = dadosOuFalha(
      await this.banco
        .from("contas")
        .select("saldo, saldo_atualizado_em")
        .eq("empresa_id", empresaId)
        .in("tipo", ["corrente", "poupanca"]),
    );
    let atualizadoEm: Date | null = null;
    for (const linha of linhas) {
      const em = new Date(linha.saldo_atualizado_em);
      if (!atualizadoEm || em > atualizadoEm) atualizadoEm = em;
    }
    return {
      saldoCentavos: linhas.reduce((s, l) => s + paraCentavos(l.saldo), 0),
      atualizadoEm,
    };
  }
}
