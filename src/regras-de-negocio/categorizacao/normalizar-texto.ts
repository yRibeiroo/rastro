import "server-only";
import type { Regra, Transacao } from "../tipos";

/** Maiúsculas, sem acento (NFD + remoção de \p{M}), espaços colapsados, trim. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** true se normalizarTexto(campo da transação) contém regra.padrao. Sem regex do usuário (ADR 0003). */
export function regraCorresponde(
  regra: Pick<Regra, "padrao" | "campo">,
  transacao: Pick<Transacao, "descricao" | "contraparte">,
): boolean {
  const campo =
    regra.campo === "contraparte" ? transacao.contraparte : transacao.descricao;
  if (!campo || !regra.padrao) return false;
  return normalizarTexto(campo).includes(normalizarTexto(regra.padrao));
}

const SUFIXOS_DE_EMPRESA = / (LTDA|EIRELI|ME|EPP|MEI|SA|S\/A|S A)\.?$/;

/**
 * Padrão sugerido ao corrigir: contraparte (sem sufixo societário) ou a descrição sem dígitos.
 * Na descrição, fica o maior trecho contínuo de palavras só com letras: assim o padrão ainda
 * "está contido" nas próximas transações ("PAG BOLETO 123 ENERGISA" → "PAG BOLETO").
 */
export function padraoSugerido(
  transacao: Pick<Transacao, "descricao" | "contraparte">,
): { padrao: string; campo: Regra["campo"] } {
  if (transacao.contraparte?.trim())
    return {
      campo: "contraparte",
      padrao: normalizarTexto(transacao.contraparte)
        .replace(SUFIXOS_DE_EMPRESA, "")
        .trim(),
    };
  const trechos: string[][] = [[]];
  for (const palavra of normalizarTexto(transacao.descricao).split(" "))
    if (/^[A-Z]+$/.test(palavra)) trechos[trechos.length - 1].push(palavra);
    else trechos.push([]);
  const padrao = trechos
    .map((t) => t.join(" "))
    .reduce((maior, t) => (t.length > maior.length ? t : maior), "");
  return { campo: "descricao", padrao };
}

/**
 * Minimização (P-12, LGPD): mascara CPF/CNPJ/telefone (11+ dígitos, com ou sem pontuação),
 * e-mail e chave Pix aleatória (uuid) antes de enviar texto para a IA.
 */
export function mascararDadosPessoais(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "[chave]",
    )
    .replace(/\d(?:[\s.\-/()]*\d){10,}/g, "[documento]");
}
