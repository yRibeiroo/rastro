import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chaveComHash,
  criarServicoDeAcesso,
  emailAutorizado,
  exigirLimite,
  LIMITES,
  type PortaDeAutenticacao,
} from "@/regras-de-negocio/acesso";
import { EMPRESA, USUARIO } from "../falsos";

afterEach(() => vi.unstubAllEnvs());

describe("allowlist EMAIL_AUTORIZADO", () => {
  it("case-insensitive, com trim, lista separada por vírgulas", () => {
    const lista = ["davi@hometec.com.br", "contador@x.com"];
    expect(emailAutorizado("  DAVI@Hometec.com.br ", lista)).toBe(true);
    expect(emailAutorizado("contador@x.com", lista)).toBe(true);
    expect(emailAutorizado("intruso@hometec.com.br", lista)).toBe(false);
    expect(emailAutorizado("", lista)).toBe(false);
    expect(emailAutorizado(null, lista)).toBe(false);
    expect(emailAutorizado(undefined, lista)).toBe(false);
  });

  it("sem lista explícita lê EMAIL_AUTORIZADO do ambiente", () => {
    vi.stubEnv("EMAIL_AUTORIZADO", " Davi@Hometec.com.br , outro@x.com");
    expect(emailAutorizado("davi@hometec.com.br")).toBe(true);
  });
});

describe("rate limit", () => {
  it("chave com SHA-256 (nunca o IP/e-mail em texto)", () => {
    const chave = chaveComHash("entrar:email", " Davi@Hometec.com.br ");
    expect(chave).toMatch(/^entrar:email:[0-9a-f]{64}$/);
    expect(chave).not.toContain("davi");
    expect(chave).toBe(chaveComHash("entrar:email", "davi@hometec.com.br"));
  });

  it("exigirLimite: estourou → limite_excedido; banco fora → aberta libera, fechada propaga", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(exigirLimite(async () => true, "k", LIMITES.anexo)).resolves.toBeUndefined();
    await expect(exigirLimite(async () => false, "k", LIMITES.anexo)).rejects.toMatchObject({ codigo: "limite_excedido" });
    const fora = async () => Promise.reject(new Error("db"));
    await expect(exigirLimite(fora, "k", LIMITES.anexo)).resolves.toBeUndefined();
    await expect(exigirLimite(fora, "k", LIMITES.anexo, "fechada")).rejects.toThrow("db");
  });
});

function montar(usuario: { id: string; email: string | null } | null = { id: USUARIO, email: "davi@hometec.com.br" }) {
  const autenticacao = {
    usuarioAtual: vi.fn(async () => usuario),
    enviarLinkMagico: vi.fn(async () => {}),
    trocarPorSessao: vi.fn(async () => usuario!),
    sair: vi.fn(async () => {}),
  } satisfies PortaDeAutenticacao;
  const empresas = {
    garantirEmpresaDoUsuario: vi.fn(async () => EMPRESA),
    obterMembershipDoUsuario: vi.fn(async () => ({ empresaId: EMPRESA, papel: "dono" as const })),
    existe: vi.fn(async () => true),
  };
  const consumirLimite = vi.fn(async () => true);
  const acesso = criarServicoDeAcesso({
    autenticacao,
    empresas,
    consumirLimite,
    emailsAutorizados: () => ["davi@hometec.com.br"],
    urlDoSite: () => "https://rastro.app",
  });
  return { acesso, autenticacao, empresas, consumirLimite };
}

describe("obterContextoDoUsuario", () => {
  it("sessão válida + allowlist + membership", async () => {
    const { acesso } = montar();
    expect(await acesso.obterContextoDoUsuario()).toEqual({
      usuarioId: USUARIO,
      email: "davi@hometec.com.br",
      empresaId: EMPRESA,
      papel: "dono",
    });
  });

  it("sem sessão → nao_autenticado; fora da lista ou sem e-mail → email_nao_autorizado", async () => {
    await expect(montar(null).acesso.obterContextoDoUsuario()).rejects.toMatchObject({ codigo: "nao_autenticado" });
    await expect(montar({ id: USUARIO, email: "x@y.com" }).acesso.obterContextoDoUsuario()).rejects.toMatchObject({ codigo: "email_nao_autorizado" });
    await expect(montar({ id: USUARIO, email: null }).acesso.obterContextoDoUsuario()).rejects.toMatchObject({ codigo: "email_nao_autorizado" });
  });

  it("sem empresa ainda (callback interrompido) → garantir_empresa", async () => {
    const { acesso, empresas } = montar();
    empresas.obterMembershipDoUsuario.mockResolvedValue(null as never);
    expect(await acesso.obterContextoDoUsuario()).toMatchObject({ empresaId: EMPRESA, papel: "dono" });
    expect(empresas.garantirEmpresaDoUsuario).toHaveBeenCalledWith("Minha empresa");
  });
});

describe("enviarLinkMagico", () => {
  it("e-mail autorizado recebe o link com retorno em /entrar/confirmar; limites por IP e e-mail", async () => {
    const { acesso, autenticacao, consumirLimite } = montar();
    await acesso.enviarLinkMagico(" Davi@Hometec.com.br ", "200.1.2.3");
    expect(autenticacao.enviarLinkMagico).toHaveBeenCalledWith("davi@hometec.com.br", "https://rastro.app/entrar/confirmar");
    expect(consumirLimite).toHaveBeenCalledWith(chaveComHash("entrar:ip", "200.1.2.3"), { maximo: 5, janelaEmSegundos: 900 });
    expect(consumirLimite).toHaveBeenCalledWith(chaveComHash("entrar:email", "davi@hometec.com.br"), { maximo: 3, janelaEmSegundos: 900 });
  });

  it("e-mail fora da allowlist: mesma resposta, nada é enviado", async () => {
    const { acesso, autenticacao } = montar();
    await expect(acesso.enviarLinkMagico("intruso@x.com", null)).resolves.toBeUndefined();
    expect(autenticacao.enviarLinkMagico).not.toHaveBeenCalled();
  });

  it("falha no envio é engolida (resposta neutra) e logada sem o e-mail", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { acesso, autenticacao } = montar();
    autenticacao.enviarLinkMagico.mockRejectedValue(new Error("smtp"));
    await expect(acesso.enviarLinkMagico("davi@hometec.com.br", null)).resolves.toBeUndefined();
    expect(JSON.stringify(erro.mock.calls)).not.toContain("davi@");
  });

  it("e-mail inválido → entrada_invalida; limite estourado → limite_excedido; banco de limites fora → bloqueia", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { acesso, consumirLimite, autenticacao } = montar();
    await expect(acesso.enviarLinkMagico("nao-e-email", null)).rejects.toMatchObject({ codigo: "entrada_invalida" });
    consumirLimite.mockResolvedValueOnce(false);
    await expect(acesso.enviarLinkMagico("davi@hometec.com.br", "1.1.1.1")).rejects.toMatchObject({ codigo: "limite_excedido" });
    consumirLimite.mockRejectedValueOnce(new Error("db"));
    await expect(acesso.enviarLinkMagico("davi@hometec.com.br", null)).rejects.toThrow("db");
    expect(autenticacao.enviarLinkMagico).not.toHaveBeenCalled();
  });
});

describe("confirmarEntrada e sair", () => {
  it("troca o code, confere a allowlist e garante a empresa", async () => {
    const { acesso, autenticacao, empresas } = montar();
    expect(await acesso.confirmarEntrada({ code: "abc" })).toEqual({ empresaId: EMPRESA });
    expect(autenticacao.trocarPorSessao).toHaveBeenCalledWith({ code: "abc" });
    expect(empresas.garantirEmpresaDoUsuario).toHaveBeenCalledWith("Minha empresa");
  });

  it("e-mail fora da lista: signOut e email_nao_autorizado, sem criar empresa", async () => {
    const { acesso, autenticacao, empresas } = montar({ id: USUARIO, email: "intruso@x.com" });
    await expect(acesso.confirmarEntrada({ tokenHash: "h", tipo: "magiclink" })).rejects.toMatchObject({ codigo: "email_nao_autorizado" });
    expect(autenticacao.sair).toHaveBeenCalled();
    expect(empresas.garantirEmpresaDoUsuario).not.toHaveBeenCalled();
  });

  it("sair e consumirLimite delegam", async () => {
    const { acesso, autenticacao, consumirLimite } = montar();
    await acesso.sair();
    expect(autenticacao.sair).toHaveBeenCalled();
    expect(await acesso.consumirLimite("k", LIMITES.conexao)).toBe(true);
    expect(consumirLimite).toHaveBeenCalledWith("k", LIMITES.conexao);
  });
});
