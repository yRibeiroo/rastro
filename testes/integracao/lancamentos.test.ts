import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RepositorioDeContasSupabase } from "@/acesso-a-dados/repositorio-de-contas";
import { RepositorioDeLancamentosSupabase } from "@/acesso-a-dados/repositorio-de-lancamentos";
import type { BancoDeDados } from "@/acesso-a-dados/supabase/cliente-do-usuario";

// Repositório de lançamentos contra o Supabase local (npx supabase start): sessão real, RPCs e
// mensagens de erro do PostgREST. As chaves vêm do `supabase status` (nada de segredo no repositório).

type Cliente = SupabaseClient<BancoDeDados>;

function statusLocal(): Record<string, string> {
  const saida = execSync("npx supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return Object.fromEntries(
    saida
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_0-9]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2]]),
  );
}

let admin: Cliente;
let usuario: Cliente;
let usuarioId: string;
let empresaId: string;

beforeAll(async () => {
  const env = statusLocal();
  admin = createClient<BancoDeDados>(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  usuario = createClient<BancoDeDados>(env.API_URL, env.ANON_KEY, {
    auth: { persistSession: false },
  });
  const email = `integracao-${Date.now()}@rastro.local`;
  const senha = `Senha-${crypto.randomUUID()}`;
  const criado = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (criado.error) throw criado.error;
  usuarioId = criado.data.user.id;
  const entrou = await usuario.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (entrou.error) throw entrou.error;
  const empresa = await usuario.rpc("garantir_empresa", {
    p_nome: "",
    p_perfil: "pessoal",
  });
  if (empresa.error) throw empresa.error;
  empresaId = empresa.data;
});

afterAll(async () => {
  if (empresaId) await admin.from("empresas").delete().eq("id", empresaId);
  if (usuarioId) await admin.auth.admin.deleteUser(usuarioId);
});

describe("lançamentos manuais (integração)", () => {
  it("cria conta, lança, ajusta o saldo e traduz os erros das RPCs", async () => {
    const lancamentos = new RepositorioDeLancamentosSupabase(usuario);
    const contas = new RepositorioDeContasSupabase(usuario);

    const contaId = await lancamentos.criarContaManual(empresaId, {
      nome: "Carteira",
      tipo: "dinheiro",
      saldoInicialCentavos: 10000,
    });
    const lancId = await lancamentos.lancar(empresaId, {
      contaId,
      data: "2026-11-01",
      descricao: "Feira",
      valorCentavos: -3550,
      categoriaId: null,
      centroDeCustoId: null,
    });
    const saldo = async () =>
      (await contas.listar(empresaId)).find((c) => c.id === contaId)
        ?.saldoCentavos;
    expect(await saldo()).toBe(6450);

    // Com anexo: mensagem específica (e nada muda).
    const anexo = await admin
      .from("anexos")
      .insert({
        empresa_id: empresaId,
        transacao_id: lancId,
        caminho: `${empresaId}/${lancId}/teste.pdf`,
        nome_arquivo: "teste.pdf",
        tipo_mime: "application/pdf",
        tamanho_bytes: 10,
      })
      .select("id")
      .single();
    if (anexo.error) throw anexo.error;
    await expect(lancamentos.remover(empresaId, lancId)).rejects.toMatchObject({
      codigo: "entrada_invalida",
      mensagemParaUsuario:
        "Remova os anexos deste lançamento antes de apagá-lo.",
    });
    await admin.from("anexos").delete().eq("id", anexo.data.id);

    await lancamentos.remover(empresaId, lancId);
    expect(await saldo()).toBe(10000);

    // Conta de banco não aceita lançamento manual.
    const conexao = await admin
      .from("conexoes")
      .insert({
        empresa_id: empresaId,
        id_externo: `item-${Date.now()}`,
        status: "atualizada",
      })
      .select("id")
      .single();
    if (conexao.error) throw conexao.error;
    const banco = await admin
      .from("contas")
      .insert({
        empresa_id: empresaId,
        conexao_id: conexao.data.id,
        id_externo: "cc",
        nome: "Banco",
        tipo: "corrente",
      })
      .select("id")
      .single();
    if (banco.error) throw banco.error;
    await expect(
      lancamentos.lancar(empresaId, {
        contaId: banco.data.id,
        data: "2026-11-01",
        descricao: "x",
        valorCentavos: 100,
        categoriaId: null,
        centroDeCustoId: null,
      }),
    ).rejects.toMatchObject({
      mensagemParaUsuario: expect.stringContaining("Escolha uma conta manual"),
    });
  });
});
