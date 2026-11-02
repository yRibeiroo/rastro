import type {
  CampoCorrigivel,
  SituacaoDoComprovante,
  TipoDeComprovante,
} from "@/regras-de-negocio";

// Rótulos e utilitários puros dos comprovantes (servidor e navegador).

export const TIPOS: Record<TipoDeComprovante, string> = {
  pix: "Pix",
  boleto: "Boleto pago",
  nfce: "NFC-e (cupom)",
  nfe: "NF-e (DANFE)",
  recibo: "Recibo",
  outro: "Outro",
};

/** Situações que o usuário filtra (a "lendo" é transitória e aparece em "Todos"). */
export const SITUACOES: Record<
  Exclude<SituacaoDoComprovante, "lendo">,
  string
> = {
  conciliado: "Conciliado",
  pendente: "Pendente",
  ambiguo: "Escolher transação",
  erro_de_leitura: "Erro de leitura",
};

export const ROTULO_DA_SITUACAO: Record<SituacaoDoComprovante, string> = {
  ...SITUACOES,
  lendo: "Lendo",
};

export function lerSituacao(
  valor: string | string[] | undefined,
): Exclude<SituacaoDoComprovante, "lendo"> | null {
  return typeof valor === "string" && valor in SITUACOES
    ? (valor as Exclude<SituacaoDoComprovante, "lendo">)
    : null;
}

/** Valor de ?alerta= que lista só os comprovantes sem transação no extrato (RF-42). */
export const FILTRO_SEM_TRANSACAO = "sem_transacao";

export type FiltroDaLista =
  | { tipo: "todos" }
  | { tipo: "situacao"; situacao: Exclude<SituacaoDoComprovante, "lendo"> }
  | { tipo: "sem_transacao" };

/** Lê o filtro da URL. O alerta vence a situação (o alerta já implica "pendente"). */
export function lerFiltroDaLista(sp: {
  situacao?: string | string[];
  alerta?: string | string[];
}): FiltroDaLista {
  if (sp.alerta === FILTRO_SEM_TRANSACAO) return { tipo: "sem_transacao" };
  const situacao = lerSituacao(sp.situacao);
  return situacao ? { tipo: "situacao", situacao } : { tipo: "todos" };
}

/** Filtro para carregarComprovantes(). */
export function filtrosDaLeitura(
  f: FiltroDaLista,
):
  | { situacao?: Exclude<SituacaoDoComprovante, "lendo">; comAlerta?: boolean }
  | undefined {
  if (f.tipo === "sem_transacao") return { comAlerta: true };
  if (f.tipo === "situacao") return { situacao: f.situacao };
  return undefined;
}

export const ROTULO_DO_CAMPO: Record<CampoCorrigivel, string> = {
  tipo: "tipo",
  valorCentavos: "valor",
  data: "data",
  emissor: "emissor",
  documentoEmissor: "documento",
  chaveDeAcesso: "chave de acesso",
  itens: "itens",
};

/** ["valorCentavos", "data", "emissor"] → "valor, data e emissor" (RF-41). */
export function listarCamposCorrigidos(
  campos: readonly CampoCorrigivel[],
): string {
  const nomes = campos.map((c) => ROTULO_DO_CAMPO[c]);
  return nomes.length < 2
    ? (nomes[0] ?? "")
    : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

/**
 * Mesmo valor de TAMANHO_MAXIMO_DO_COMPROVANTE e TAMANHO_MAXIMO_DO_ANEXO no backend (a Vercel recusa
 * corpos acima de 4,5 MB). Duplicado porque aqueles módulos são server-only; extrato-e-alertas.test.ts confere.
 */
export const TAMANHO_MAXIMO_DO_ARQUIVO = 4 * 1024 * 1024;

/** Abaixo disso a leitura da IA é destacada para conferência. */
export const CONFIANCA_BAIXA = 0.7;

/** CPF/CNPJ (só dígitos) mascarado para exibir: ***.456.789-** e **.345.678/0001-**. */
export function mascararDocumento(documento: string | null): string | null {
  const d = documento?.replace(/\D/g, "") ?? "";
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14)
    return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return null;
}

/** "1.234,56", "1234,56", "R$ 12", "12.5" → centavos (> 0). null se não for um valor válido. */
export function lerValorEmCentavos(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const centavos = Math.round(Number(t) * 100);
  return centavos > 0 ? centavos : null;
}

/** Centavos → "1234,56" para preencher o campo de edição. */
export function valorParaCampo(centavos: number | null): string {
  return centavos == null ? "" : (centavos / 100).toFixed(2).replace(".", ",");
}
