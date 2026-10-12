import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { RepositorioDeImportacoes } from "@/acesso-a-dados/contratos";
import {
  criarServicoDeImportacao,
  LeitorDeExtratoOfx,
  situacaoDoExtrato,
  valorEmTextoParaCentavos,
} from "@/regras-de-negocio/importacao-de-extrato";
import {
  dataDoOfx,
  decodificarOfx,
} from "@/regras-de-negocio/importacao-de-extrato/leitor-ofx";
import type { ImportacaoDeExtrato } from "@/regras-de-negocio/tipos";
import {
  ConexoesEmMemoria,
  ContasEmMemoria,
  ctx,
  EMPRESA,
  novoId,
  TransacoesEmMemoria,
} from "../falsos";

const bytes = (nome: string) =>
  new Uint8Array(
    readFileSync(new URL(`../../../fixtures/ofx/${nome}`, import.meta.url)),
  );
const arquivo = (
  nome: string,
  conteudo: Uint8Array | string = bytes(nome),
  tipo = "",
) => new File([conteudo as BlobPart], nome, { type: tipo });

const leitor = new LeitorDeExtratoOfx();

describe("valorEmTextoParaCentavos (sem float)", () => {
  it.each([
    ["-50.00", -5000],
    ["80.00", 8000],
    ["-250,90", -25090],
    ["1.500,00", 150000],
    ["1,500.00", 150000],
    ["1.234.567", 123456700],
    ["1.234", 123],
    ["10,5", 1050],
    ["0.105", 11],
    ["+7", 700],
    ["−3,10", -310],
    ["R$ 12,34", 1234],
    ["0.1", 10],
  ])("%s → %d", (texto, esperado) => {
    expect(valorEmTextoParaCentavos(texto)).toBe(esperado);
  });

  it("não número → null", () => {
    for (const t of ["", "abc", "1,2,3x", "--5", "9".repeat(20)])
      expect(valorEmTextoParaCentavos(t)).toBeNull();
  });
});

describe("datas e codificação do OFX", () => {
  it("DTPOSTED com e sem fuso; data impossível → null", () => {
    expect(dataDoOfx("20261008")).toBe("2026-10-08");
    expect(dataDoOfx("20261008120000.000[-3:BRT]")).toBe("2026-10-08");
    expect(dataDoOfx("20261332")).toBeNull();
    expect(dataDoOfx(null)).toBeNull();
  });

  it("windows-1252 pelo CHARSET, UTF-8 pelo ENCODING/XML, e cabeçalho mentiroso cai em 1252", () => {
    const latin = new Uint8Array([
      ...new TextEncoder().encode("CHARSET:1252\n<MEMO>JOS"),
      0xc9,
    ]);
    expect(decodificarOfx(latin)).toContain("JOSÉ");
    const utf8 = new TextEncoder().encode("ENCODING:UTF-8\n<MEMO>JOSÉ");
    expect(decodificarOfx(utf8)).toContain("JOSÉ");
    const mentiroso = new Uint8Array([
      ...new TextEncoder().encode("ENCODING:UTF-8\nJOS"),
      0xc9,
    ]);
    expect(decodificarOfx(mentiroso)).toContain("JOSÉ");
    const usascii = new Uint8Array([
      ...new TextEncoder().encode("ENCODING:USASCII\nJOS"),
      0xc9,
    ]);
    expect(decodificarOfx(usascii)).toContain("JOSÉ");
  });
});

describe("LeitorDeExtratoOfx (fixtures do Sicredi)", () => {
  const esperadas = [
    {
      data: "2026-10-02",
      valorCentavos: -25090,
      descricao: "PAGAMENTO PIX JOSÉ DA CONCEIÇÃO",
      contraparte: "PIX ENVIADO",
    },
    {
      data: "2026-10-03",
      valorCentavos: 150000,
      descricao: "RECEBIMENTO PIX CLIENTE AÇAÍ LTDA",
      contraparte: null,
    },
    {
      data: "2026-10-05",
      valorCentavos: -1250,
      descricao: "TARIFA CESTA DE SERVIÇOS",
      metodoDePagamento: "TARIFA",
    },
    {
      data: "2026-10-07",
      valorCentavos: -80000,
      descricao: "CHEQUE COMPENSADO",
      descricaoOriginal: "CHEQUE COMPENSADO | Cheque 000123",
    },
  ];

  it("SGML latin1, SGML com vírgula e XML 2.x dão o mesmo resultado (acentos preservados)", () => {
    const lidos = [
      "sicredi-sgml-latin1.ofx",
      "sicredi-sgml-virgula.ofx",
      "sicredi-xml.ofx",
    ].map((n) => leitor.ler(bytes(n)));
    for (const lido of lidos) {
      expect(lido.periodo).toEqual({ de: "2026-10-01", ate: "2026-10-08" });
      expect(lido.conta).toMatchObject({
        tipo: "corrente",
        numeroFinal: "3456",
        saldoCentavos: 1523456,
      });
      expect(lido.conta.idExterno).toMatch(/^ofx:[0-9a-f]{32}$/);
      expect(lido.conta.nome).toMatch(/•••• 3456$/);
      expect(JSON.stringify(lido)).not.toContain("12345-6"); // número completo nunca sai
      expect(lido.transacoes).toHaveLength(4); // o cheque repetido no arquivo entra uma vez
      expect(lido.transacoes.map((t) => t.idExterno)).toEqual(
        lidos[0].transacoes.map((t) => t.idExterno),
      );
      esperadas.forEach((e, i) => expect(lido.transacoes[i]).toMatchObject(e));
    }
    expect(lidos[0].banco).toBe("Sicredi");
    expect(lidos[2].banco).toBe("SICREDI"); // <FI><ORG>
    expect(lidos[0].transacoes[0].idExterno).toMatch(/:SIC202610020001$/);
  });

  it("texto também é aceito; FITID repetido com outro conteúdo ou ausente ganha sufixo; valor 0 e DEBIT positivo", () => {
    const ofx = `<OFX><BANKACCTFROM><BANKID>999<ACCTID>99<ACCTTYPE>SAVINGS</BANKACCTFROM>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261001<TRNAMT>5.00<FITID>A<NAME>X &amp; Y</STMTTRN>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261001<TRNAMT>-6.00<FITID>A<MEMO>outro</STMTTRN>
      <STMTTRN><TRNTYPE>FEE<DTPOSTED>20261002<TRNAMT>-1.00<MEMO>TARIFA</STMTTRN>
      <STMTTRN><TRNTYPE>FEE<DTPOSTED>20261002<TRNAMT>-1.00<MEMO>TARIFA</STMTTRN>
      <STMTTRN><TRNTYPE>OTHER<DTPOSTED>20261003<TRNAMT>0.00<FITID>Z</STMTTRN></OFX>`;
    const lido = leitor.ler(ofx);
    expect(lido.banco).toBe("Banco 999");
    expect(lido.conta).toMatchObject({
      tipo: "poupanca",
      numeroFinal: "99",
      saldoCentavos: 0,
    });
    expect(lido.periodo).toEqual({ de: "2026-10-01", ate: "2026-10-02" });
    expect(lido.transacoes.map((t) => [t.valorCentavos, t.descricao])).toEqual([
      [-500, "X & Y"],
      [-600, "outro"],
      [-100, "TARIFA"],
      [-100, "TARIFA"],
    ]);
    const ids = lido.transacoes.map((t) => t.idExterno);
    expect(ids[1]).toMatch(/:A~2$/);
    expect(ids[2]).toMatch(/:sem-fitid:/);
    expect(ids[3]).toBe(`${ids[2]}~2`); // duas tarifas iguais sem FITID continuam duas
  });

  it("arquivo inválido: texto qualquer, corrompido, sem conta, lançamento ilegível, DTD ou sem período", () => {
    const casos: (string | Uint8Array)[] = [
      "isto não é um extrato",
      bytes("corrompido.ofx"),
      "<OFX><BANKACCTFROM><BANKID>748</BANKACCTFROM></OFX>",
      "<OFX><BANKACCTFROM><ACCTID>1</BANKACCTFROM><STMTTRN><DTPOSTED>2026<TRNAMT>1</STMTTRN></OFX>",
      "<OFX><BANKACCTFROM><ACCTID>1</BANKACCTFROM><STMTTRN><DTPOSTED>20261001<TRNAMT>abc</STMTTRN></OFX>",
      '<?xml version="1.0"?><!DOCTYPE OFX [<!ENTITY x SYSTEM "file:///etc/passwd">]><OFX><BANKACCTFROM><ACCTID>1</BANKACCTFROM></OFX>',
      "<OFX><BANKACCTFROM><ACCTID>1</BANKACCTFROM></OFX>",
      "<OFX><BANKACCTFROM><ACCTID>1</BANKACCTFROM><LEDGERBAL><BALAMT>x</LEDGERBAL></OFX>",
    ];
    for (const c of casos)
      expect(() => leitor.ler(c)).toThrow(
        expect.objectContaining({ codigo: "arquivo_invalido" }),
      );
  });
});

class ImportacoesEmMemoria implements RepositorioDeImportacoes {
  linhas: ImportacaoDeExtrato[] = [];
  async criar(
    empresaId: string,
    dados: Omit<ImportacaoDeExtrato, "id" | "empresaId" | "criadaEm">,
  ) {
    const linha = { id: novoId(), empresaId, criadaEm: new Date(), ...dados };
    this.linhas.unshift(linha);
    return linha;
  }
  async listar(empresaId: string) {
    return this.linhas.filter((l) => l.empresaId === empresaId);
  }
  async ultimoFimDePeriodo(empresaId: string, contaId: string) {
    const fins = this.linhas
      .filter((l) => l.empresaId === empresaId && l.contaId === contaId)
      .map((l) => l.periodo.ate);
    return fins.sort().at(-1) ?? null;
  }
}

function montar() {
  const conexoes = new ConexoesEmMemoria();
  const contas = new ContasEmMemoria();
  const transacoes = new TransacoesEmMemoria();
  const importacoes = new ImportacoesEmMemoria();
  const categorizacao = { categorizarPendentes: vi.fn(async () => ({})) };
  const comprovantes = { reconciliarPendentes: vi.fn(async () => 1) };
  const consumirLimite = vi.fn(async () => true);
  const servico = criarServicoDeImportacao({
    leitor,
    conexoes,
    contas,
    transacoes,
    importacoes,
    categorizacao,
    comprovantes,
    consumirLimite,
    agora: () => new Date("2026-10-09T12:00:00Z"),
  });
  return {
    servico,
    conexoes,
    contas,
    transacoes,
    importacoes,
    categorizacao,
    comprovantes,
    consumirLimite,
  };
}

describe("ServicoDeImportacao", () => {
  it("1ª importação cria conexão 'arquivo' (id_externo = empresa), conta, transações e histórico; categoriza e concilia", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const m = montar();
    const r = await m.servico.importar(ctx, arquivo("sicredi-sgml-latin1.ofx"));
    expect(r).toEqual({
      importacaoId: expect.any(String),
      novas: 4,
      atualizadas: 0,
      periodo: { de: "2026-10-01", ate: "2026-10-08" },
      comprovantesConciliados: 1,
    });
    expect(m.conexoes.linhas).toEqual([
      expect.objectContaining({
        provedor: "arquivo",
        idExterno: EMPRESA,
        status: "atualizada",
        banco: "Sicredi",
      }),
    ]);
    expect(m.conexoes.marcarSincronizada).toHaveBeenCalledWith(
      EMPRESA,
      m.conexoes.linhas[0].id,
      new Date("2026-10-09T12:00:00Z"),
    );
    expect(m.contas.linhas).toHaveLength(1);
    expect(m.transacoes.linhas).toHaveLength(4);
    expect(m.importacoes.linhas[0]).toMatchObject({
      nomeDoArquivo: "sicredi-sgml-latin1.ofx",
      novas: 4,
      atualizadas: 0,
    });
    expect(m.categorizacao.categorizarPendentes).toHaveBeenCalledWith(EMPRESA);
    expect(m.comprovantes.reconciliarPendentes).toHaveBeenCalledWith(EMPRESA);
    expect(m.consumirLimite).toHaveBeenCalledWith(
      `importacao:usuario:${ctx.usuarioId}`,
      { maximo: 20, janelaEmSegundos: 3600 },
    );
    expect(await m.servico.listarImportacoes(ctx)).toHaveLength(1);
  });

  it("reimportar (inclusive o XML do mesmo extrato) é idempotente e nunca toca a categoria do usuário", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const m = montar();
    await m.servico.importar(ctx, arquivo("sicredi-sgml-latin1.ofx"));
    const categoriaId = novoId();
    Object.assign(m.transacoes.linhas[0], {
      categoriaId,
      categoriaOrigem: "usuario",
      categoriaDefinidaPeloUsuario: true,
    });
    for (const nome of ["sicredi-sgml-latin1.ofx", "sicredi-xml.ofx"]) {
      const r = await m.servico.importar(ctx, arquivo(nome));
      expect(r).toMatchObject({ novas: 0, atualizadas: 4 });
    }
    expect(m.transacoes.linhas).toHaveLength(4);
    expect(m.conexoes.linhas).toHaveLength(1);
    expect(m.contas.linhas).toHaveLength(1);
    expect(m.transacoes.linhas[0]).toMatchObject({
      categoriaId,
      categoriaDefinidaPeloUsuario: true,
    });
    expect(m.importacoes.linhas).toHaveLength(3);
  });

  it("arquivo mais antigo que o último importado não regride o saldo", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const m = montar();
    await m.servico.importar(ctx, arquivo("sicredi-sgml-latin1.ofx"));
    const antigo = new TextDecoder("windows-1252")
      .decode(bytes("sicredi-sgml-latin1.ofx"))
      .replace("<DTEND>20261008", "<DTEND>20260930")
      .replace("<DTSTART>20261001", "<DTSTART>20260901")
      .replace("<BALAMT>15234.56", "<BALAMT>1.00");
    await m.servico.importar(ctx, arquivo("antigo.ofx", antigo));
    expect(m.contas.linhas[0].saldoCentavos).toBe(1523456);
  });

  it("falha na categorização ou na conciliação não derruba a importação", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = montar();
    m.categorizacao.categorizarPendentes.mockRejectedValueOnce(new Error("ia"));
    m.comprovantes.reconciliarPendentes.mockRejectedValueOnce(new Error("db"));
    const r = await m.servico.importar(ctx, arquivo("sicredi-xml.ofx"));
    expect(r).toMatchObject({ novas: 4, comprovantesConciliados: 0 });
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("recusa sem gravar nada: não-File, vazio, > 5 MB, tipo/extensão errados, OFX inválido e limite", async () => {
    const m = montar();
    const casos = [
      "texto" as unknown as File,
      arquivo("vazio.ofx", new Uint8Array()),
      arquivo("grande.ofx", new Uint8Array(5 * 1024 * 1024 + 1)),
      arquivo("foto.ofx", bytes("sicredi-xml.ofx"), "image/png"),
      arquivo("extrato.pdf", bytes("sicredi-xml.ofx")),
      arquivo("corrompido.ofx"),
    ];
    for (const a of casos)
      await expect(m.servico.importar(ctx, a)).rejects.toMatchObject({
        codigo: "arquivo_invalido",
      });
    m.consumirLimite.mockResolvedValue(false);
    await expect(
      m.servico.importar(
        ctx,
        arquivo(
          "sicredi-xml.ofx",
          bytes("sicredi-xml.ofx"),
          "application/x-ofx",
        ),
      ),
    ).rejects.toMatchObject({
      codigo: "limite_excedido",
    });
    expect(m.transacoes.linhas).toHaveLength(0);
    expect(m.importacoes.linhas).toHaveLength(0);
  });
});

describe("RF-34: situação do extrato", () => {
  const agora = new Date("2026-10-15T10:00:00-03:00");
  it.each([
    ["hoje", "2026-10-15T08:00:00-03:00", 0, false],
    ["6 dias → neutro", "2026-10-09T23:59:00-03:00", 6, false],
    ["7 dias → desatualizado", "2026-10-08T00:30:00-03:00", 7, true],
    ["virada do dia pelo fuso de Araguaína", "2026-10-15T02:00:00Z", 1, false],
  ])("%s", (_n, ultima, dias, desatualizado) => {
    expect(situacaoDoExtrato(new Date(ultima), agora)).toEqual({
      ultimaImportacaoEm: new Date(ultima),
      diasDesdeAUltima: dias,
      desatualizado,
    });
  });

  it("sem importação → nulos; o serviço usa a mais recente", async () => {
    expect(situacaoDoExtrato(null, agora)).toEqual({
      ultimaImportacaoEm: null,
      diasDesdeAUltima: null,
      desatualizado: false,
    });
    vi.spyOn(console, "info").mockImplementation(() => {});
    const m = montar();
    expect(await m.servico.situacao(ctx)).toMatchObject({
      ultimaImportacaoEm: null,
    });
    await m.servico.importar(ctx, arquivo("sicredi-xml.ofx"));
    expect(await m.servico.situacao(ctx)).toMatchObject({
      diasDesdeAUltima: expect.any(Number),
    });
  });
});

describe("RF-32: importação interrompida", () => {
  it("falha no meio da gravação não cria registro de importação; reenviar o arquivo completa sem duplicar", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const m = montar();
    const original = m.transacoes.salvarDoProvedor.bind(m.transacoes);
    m.transacoes.salvarDoProvedor = vi.fn(
      async (...args: Parameters<typeof original>) => {
        await original(args[0], args[1], args[2].slice(0, 2)); // grava parte e cai
        throw new Error("conexão caiu");
      },
    );
    await expect(
      m.servico.importar(ctx, arquivo("sicredi-xml.ofx")),
    ).rejects.toThrow("conexão caiu");
    expect(m.importacoes.linhas).toHaveLength(0);
    expect(m.transacoes.linhas).toHaveLength(2);
    m.transacoes.salvarDoProvedor = original;
    expect(
      await m.servico.importar(ctx, arquivo("sicredi-xml.ofx")),
    ).toMatchObject({ novas: 2, atualizadas: 2 });
    expect(m.transacoes.linhas).toHaveLength(4);
    expect(m.importacoes.linhas).toHaveLength(1);
  });
});
