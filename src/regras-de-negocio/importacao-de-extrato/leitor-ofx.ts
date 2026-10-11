import "server-only";
import { createHash } from "node:crypto";
import type {
  ContaDoProvedor,
  TransacaoDoProvedor,
} from "../conexao-bancaria/provedor-bancario";
import { ErroDeNegocio } from "../erros";
import type { Centavos, DataISO, TipoDeConta } from "../tipos";

// Leitor de OFX 1.x (SGML, tags sem fechamento) e 2.x (XML). ADR 0016.

export interface ExtratoLido {
  banco: string | null;
  /** idExterno = hash de banco/agência/conta: o número completo nunca é guardado. */
  conta: ContaDoProvedor;
  periodo: { de: DataISO; ate: DataISO };
  transacoes: TransacaoDoProvedor[];
}

export interface LeitorDeExtrato {
  /** Lança ErroDeNegocio('arquivo_invalido') se não for um OFX legível. */
  ler(conteudo: Uint8Array | string): ExtratoLido;
}

export const arquivoInvalido = (
  mensagem = "Não conseguimos ler esse arquivo. Exporte o extrato em OFX no Internet Banking e tente de novo.",
) => new ErroDeNegocio("arquivo_invalido", mensagem);

const BANCOS: Record<string, string> = {
  "748": "Sicredi",
  "756": "Sicoob",
  "001": "Banco do Brasil",
  "104": "Caixa",
  "237": "Bradesco",
  "341": "Itaú",
  "033": "Santander",
  "260": "Nubank",
  "077": "Inter",
};

const TIPOS_DE_SAIDA = new Set([
  "DEBIT",
  "PAYMENT",
  "FEE",
  "SRVCHG",
  "ATM",
  "CHECK",
  "POS",
  "DIRECTDEBIT",
  "CASH",
]);
const METODOS: Record<string, string> = {
  CHECK: "CHEQUE",
  ATM: "SAQUE",
  CASH: "SAQUE",
  FEE: "TARIFA",
  SRVCHG: "TARIFA",
  INT: "JUROS",
  POS: "CARTAO",
  DIRECTDEBIT: "DEBITO_AUTOMATICO",
};

/**
 * "−1.234,56", "-1234.56", "10,5" → centavos inteiros, sem passar por float.
 * O último separador ('.' ou ',') é o decimal; o outro é de milhar. null se não for número.
 */
export function valorEmTextoParaCentavos(texto: string): Centavos | null {
  const limpo = texto
    .trim()
    .replace(/\s|R\$/g, "")
    .replace(/^\+/, "")
    .replace(/^−/, "-");
  const m = /^(-?)([\d.,]*\d)$/.exec(limpo);
  if (!m) return null;
  const [, sinal, corpo] = m;
  const ultimo = Math.max(corpo.lastIndexOf("."), corpo.lastIndexOf(","));
  // Sem separador, ou separador com 3 dígitos depois e outro igual antes ("1.234") = milhar.
  const decimal =
    ultimo >= 0 &&
    !(
      corpo.length - ultimo - 1 === 3 && corpo.indexOf(corpo[ultimo]) !== ultimo
    );
  const inteiro = (decimal ? corpo.slice(0, ultimo) : corpo).replace(
    /[.,]/g,
    "",
  );
  const fracao = decimal ? corpo.slice(ultimo + 1) : "";
  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(fracao)) return null;
  // Arredonda pelo 3º dígito decimal (OFX às vezes traz mais de 2 casas).
  const centavos =
    Number(inteiro || "0") * 100 +
    Number((fracao + "00").slice(0, 2)) +
    (Number(fracao[2] ?? "0") >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(centavos)) return null;
  return sinal ? -centavos : centavos;
}

/** "20261008120000[-3:BRT]" → "2026-10-08": a data como o banco escreveu (já no fuso dele). */
export function dataDoOfx(texto: string | null): DataISO | null {
  const m = texto ? /^(\d{4})(\d{2})(\d{2})/.exec(texto.trim()) : null;
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().startsWith(iso) ? iso : null;
}

/** Bytes → texto, pela codificação do cabeçalho (CHARSET:1252 / ENCODING:UTF-8 / encoding="..."). */
export function decodificarOfx(bytes: Uint8Array): string {
  // O cabeçalho é ASCII: dá para lê-lo em latin1 antes de saber a codificação real.
  const cabecalho = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  const xml = /encoding\s*=\s*["']([\w-]+)["']/i.exec(cabecalho)?.[1];
  const charset = /^\s*CHARSET\s*:\s*([\w-]+)/im.exec(cabecalho)?.[1];
  const encoding = /^\s*ENCODING\s*:\s*([\w-]+)/im.exec(cabecalho)?.[1];
  let rotulo = "utf-8";
  if (xml) rotulo = xml;
  else if (encoding && /utf-?8/i.test(encoding)) rotulo = "utf-8";
  else if (
    charset &&
    /^(1252|windows-1252|8859-1|iso-8859-1|latin1)$/i.test(charset)
  )
    rotulo = "windows-1252";
  else if (encoding && /usascii/i.test(encoding)) rotulo = "windows-1252";
  try {
    return new TextDecoder(rotulo, { fatal: true }).decode(bytes);
  } catch {
    // Cabeçalho mentiroso (comum): UTF-8 inválido quase sempre é windows-1252.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const decodificarEntidades = (t: string) =>
  t.replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (todo, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(
          e[1].toLowerCase() === "x"
            ? parseInt(e.slice(2), 16)
            : Number(e.slice(1)),
        )
      : (ENTIDADES[e.toLowerCase()] ?? todo),
  );

/** Valor de <TAG>valor (SGML) ou <TAG>valor</TAG> (XML). */
function campo(bloco: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(bloco);
  const valor = m ? decodificarEntidades(m[1]).replace(/\s+/g, " ").trim() : "";
  return valor || null;
}

function bloco(texto: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|$)`, "i").exec(texto);
  return m ? m[1] : null;
}

const hash = (texto: string) =>
  createHash("sha256").update(texto).digest("hex").slice(0, 32);

export class LeitorDeExtratoOfx implements LeitorDeExtrato {
  ler(conteudo: Uint8Array | string): ExtratoLido {
    const texto =
      typeof conteudo === "string" ? conteudo : decodificarOfx(conteudo);
    if (!/<OFX>/i.test(texto)) throw arquivoInvalido();
    // RNF-25: texto não confiável. Nada de DTD/entidades externas (o leitor não as resolve de todo modo).
    if (/<!(DOCTYPE|ENTITY)/i.test(texto)) throw arquivoInvalido();

    const conta = bloco(texto, "BANKACCTFROM");
    const bankId = conta && campo(conta, "BANKID");
    const acctId = conta && campo(conta, "ACCTID");
    if (!conta || !acctId) throw arquivoInvalido();
    const agencia = campo(conta, "BRANCHID") ?? "";
    const org = bloco(texto, "FI");
    const banco =
      (org && campo(org, "ORG")) ??
      (bankId
        ? (BANCOS[bankId.replace(/^0+(?=\d{3})/, "").padStart(3, "0")] ??
          `Banco ${bankId}`)
        : null);
    const contaIdExterno = `ofx:${hash(`${bankId ?? ""}|${agencia}|${acctId}`)}`;
    const digitos = acctId.replace(/\D/g, "");
    const numeroFinal = digitos ? digitos.slice(-4) : null;
    const tipo: TipoDeConta =
      campo(conta, "ACCTTYPE")?.toUpperCase() === "SAVINGS"
        ? "poupanca"
        : "corrente";

    const saldoTexto = (() => {
      const b = bloco(texto, "LEDGERBAL");
      return b && campo(b, "BALAMT");
    })();
    const saldoCentavos = saldoTexto ? valorEmTextoParaCentavos(saldoTexto) : 0;
    if (saldoCentavos === null) throw arquivoInvalido();

    const transacoes = this.lerTransacoes(texto, contaIdExterno);

    const lista = bloco(texto, "BANKTRANLIST");
    const datas = transacoes.map((t) => t.data).sort();
    const de = (lista && dataDoOfx(campo(lista, "DTSTART"))) ?? datas[0];
    const ate = (lista && dataDoOfx(campo(lista, "DTEND"))) ?? datas.at(-1);
    if (!de || !ate) throw arquivoInvalido();

    return {
      banco,
      conta: {
        idExterno: contaIdExterno,
        nome: `${banco ?? "Conta"}${numeroFinal ? ` •••• ${numeroFinal}` : ""}`,
        tipo,
        numeroFinal,
        saldoCentavos,
      },
      periodo: de <= ate ? { de, ate } : { de: ate, ate: de },
      transacoes,
    };
  }

  private lerTransacoes(texto: string, contaIdExterno: string) {
    const prefixo = contaIdExterno.slice(4, 20);
    const vistas = new Map<string, string>(); // FITID (com sufixo) → assinatura
    const transacoes: TransacaoDoProvedor[] = [];
    const blocos =
      texto.match(
        /<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi,
      ) ?? [];
    for (const b of blocos) {
      const data = dataDoOfx(campo(b, "DTPOSTED"));
      const valorTexto = campo(b, "TRNAMT");
      let valor = valorTexto ? valorEmTextoParaCentavos(valorTexto) : null;
      if (!data || valor === null)
        throw arquivoInvalido(
          "O arquivo tem lançamentos com data ou valor ilegível. Exporte o OFX de novo.",
        );
      if (valor === 0) continue; // não é movimento (e o banco recusa)
      const tipo = campo(b, "TRNTYPE")?.toUpperCase() ?? "";
      // Alguns bancos mandam débito com valor positivo: o tipo decide o sinal.
      if (valor > 0 && TIPOS_DE_SAIDA.has(tipo)) valor = -valor;

      const nome = campo(b, "NAME");
      const memo = campo(b, "MEMO");
      const cheque = campo(b, "CHECKNUM");
      const descricao = (memo ?? nome ?? "Lançamento sem descrição").slice(
        0,
        500,
      );
      const assinatura = `${data}|${valor}|${nome}|${memo}`;

      // Mesmo FITID e mesmo conteúdo = o mesmo lançamento repetido no arquivo: entra uma vez.
      // FITID repetido com outro conteúdo, ou ausente: sufixo pela ordem (estável na reimportação).
      const fitid = campo(b, "FITID");
      if (fitid && vistas.get(fitid) === assinatura) continue;
      const base = fitid ?? `sem-fitid:${hash(assinatura)}`;
      let chave = base;
      for (let n = 2; vistas.has(chave); n++) chave = `${base}~${n}`;
      vistas.set(chave, assinatura);
      const idExterno = `ofx:${prefixo}:${chave}`;

      transacoes.push({
        idExterno: idExterno.slice(0, 200),
        contaIdExterno,
        data,
        descricao,
        descricaoOriginal:
          [nome, memo, cheque && `Cheque ${cheque}`]
            .filter(Boolean)
            .join(" | ") || null,
        valorCentavos: valor,
        pendente: false,
        contraparte: memo && nome && nome !== memo ? nome.slice(0, 200) : null,
        metodoDePagamento: METODOS[tipo] ?? null,
        categoriaDoProvedor: null,
      });
    }
    return transacoes;
  }
}
