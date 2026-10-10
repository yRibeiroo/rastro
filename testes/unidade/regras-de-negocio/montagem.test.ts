import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPRESA, USUARIO } from "./falsos";

// Supabase falso: toda consulta encadeada resolve com a resposta configurada para a tabela/RPC.
const estado = vi.hoisted(() => ({
  respostas: {} as Record<string, { data: unknown; error: unknown; count?: number }>,
  claims: null as null | { sub: string; email: string },
  chamadas: [] as string[],
}));

function bancoFalso() {
  const consulta = (tabela: string): unknown => {
    const construtor: unknown = new Proxy(
      {},
      {
        get(_alvo, metodo) {
          if (metodo === "then")
            return (resolver: (v: unknown) => void) =>
              resolver(estado.respostas[tabela] ?? { data: [], error: null, count: 0 });
          return (..._args: unknown[]) => {
            estado.chamadas.push(`${tabela}.${String(metodo)}`);
            return construtor;
          };
        },
      },
    );
    return construtor;
  };
  return {
    from: consulta,
    rpc: async (nome: string) => estado.respostas[nome] ?? { data: null, error: null },
    auth: {
      getClaims: async () => ({ data: estado.claims ? { claims: estado.claims } : null, error: null }),
      signOut: async () => ({ error: null }),
      verifyOtp: async () => ({ data: { user: null }, error: { code: "otp_expired" } }),
    },
    storage: { from: () => ({}) },
  };
}

vi.mock("@/acesso-a-dados/supabase/cliente-do-usuario", () => ({
  clienteDoUsuario: async () => bancoFalso(),
}));
vi.mock("@/acesso-a-dados/supabase/cliente-do-sistema", () => ({
  clienteDoSistema: () => bancoFalso(),
}));

const montagem = await import("@/regras-de-negocio/montagem");
const acesso = await import("@/regras-de-negocio/acesso");

beforeEach(() => {
  vi.stubEnv("EMAIL_AUTORIZADO", "davi@hometec.com.br");
  estado.respostas = {
    membros_empresa: { data: { empresa_id: EMPRESA, papel: "dono" }, error: null },
  };
  estado.claims = { sub: USUARIO, email: "davi@hometec.com.br" };
  estado.chamadas = [];
});

describe("montagem (raiz de composição)", () => {
  it("servicosDoUsuario resolve o ctx pela sessão + allowlist + membership e expõe todos os serviços", async () => {
    const s = await montagem.servicosDoUsuario();
    expect(s.ctx).toEqual({ usuarioId: USUARIO, email: "davi@hometec.com.br", empresaId: EMPRESA, papel: "dono" });
    expect(Object.keys(s).sort()).toEqual(
      ["anexos", "categorizacao", "centrosDeCusto", "conexoes", "ctx", "extrato", "painel", "sincronizacao"].sort(),
    );
    expect(await s.categorizacao.listarRegras(s.ctx)).toEqual([]);
    expect(await s.centrosDeCusto.listar(s.ctx)).toEqual([]);
    expect(await s.conexoes.listarConexoes(s.ctx)).toEqual([]);
    await expect(s.sincronizacao.sincronizarAgora(s.ctx, "x")).rejects.toMatchObject({ codigo: "conexao_nao_encontrada" });
    expect(estado.chamadas).toContain("regras_categorizacao.eq");
  });

  it("sem sessão: servicosDoUsuario lança nao_autenticado (as funções do contrato §9 também)", async () => {
    estado.claims = null;
    await expect(montagem.servicosDoUsuario()).rejects.toMatchObject({ codigo: "nao_autenticado" });
    await expect(acesso.obterContextoDoUsuario()).rejects.toMatchObject({ codigo: "nao_autenticado" });
  });

  it("funções do contrato §9 delegam para o serviço de acesso desta requisição", async () => {
    estado.respostas.consumir_limite_de_requisicao = { data: true, error: null };
    estado.respostas.garantir_empresa = { data: EMPRESA, error: null };
    expect(await acesso.consumirLimite("k", { maximo: 1, janelaEmSegundos: 60 })).toBe(true);
    await expect(acesso.enviarLinkMagico("intruso@x.com", null)).resolves.toBeUndefined();
    await expect(acesso.confirmarEntrada({ tokenHash: "h", tipo: "magiclink" })).rejects.toMatchObject({ codigo: "nao_autenticado" });
    await expect(acesso.sair()).resolves.toBeUndefined();
  });

  it("servicosDoSistema é um singleton e a limpeza apaga eventos (90 dias) e limites (1 dia)", async () => {
    const sistema = montagem.servicosDoSistema();
    expect(montagem.servicosDoSistema()).toBe(sistema);
    await sistema.limpeza();
    expect(estado.chamadas).toEqual(expect.arrayContaining(["eventos_webhook.delete", "limites_de_requisicao.delete"]));
    expect(sistema.provedor.interpretarWebhook({ event: "item/created", eventId: "e", itemId: "i" })).toMatchObject({ tipo: "conexao_criada" });
  });
});
