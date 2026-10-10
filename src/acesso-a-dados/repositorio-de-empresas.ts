import "server-only";
import type { RepositorioDeEmpresas } from "./contratos";
import { dadosOuFalha, falhaDoBanco } from "./erros-do-banco";
import type { ClienteDoBanco } from "./supabase/cliente-do-usuario";

export class RepositorioDeEmpresasSupabase implements RepositorioDeEmpresas {
  constructor(private readonly banco: ClienteDoBanco) {}

  async garantirEmpresaDoUsuario(nomeSugerido: string) {
    return dadosOuFalha(
      await this.banco.rpc("garantir_empresa", { p_nome: nomeSugerido }),
    );
  }

  async obterMembershipDoUsuario(usuarioId: string) {
    const { data, error } = await this.banco
      .from("membros_empresa")
      .select("empresa_id, papel")
      .eq("user_id", usuarioId)
      .order("criado_em")
      .order("empresa_id")
      .limit(1)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    if (!data) return null;
    return {
      empresaId: data.empresa_id,
      papel: data.papel === "membro" ? ("membro" as const) : ("dono" as const),
    };
  }

  async existe(empresaId: string) {
    const { data, error } = await this.banco
      .from("empresas")
      .select("id")
      .eq("id", empresaId)
      .maybeSingle();
    if (error) throw falhaDoBanco(error);
    return data !== null;
  }
}
