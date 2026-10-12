import "server-only";
import { normalizarTexto } from "../categorizacao/normalizar-texto";
import type { Centavos, DataISO, Id, TipoDeComprovante } from "../tipos";

// Conciliação automática (ADR 0016): puro, sem banco.

export const TOLERANCIA_EM_DIAS = 3;

export interface CandidatoAConciliacao {
  id: Id;
  data: DataISO;
  valorCentavos: Centavos; // com sinal: negativo = saída
  descricao: string;
  contraparte: string | null;
}

export type ResultadoDaConciliacao =
  | { situacao: "conciliado"; transacaoId: Id }
  | { situacao: "pendente" }
  | { situacao: "ambiguo"; candidatos: Id[] };

const DIA_EM_MS = 86_400_000;
const diasEntre = (a: DataISO, b: DataISO) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
  DIA_EM_MS;

const PALAVRAS_VAZIAS = new Set([
  "LTDA",
  "EIRELI",
  "ME",
  "EPP",
  "MEI",
  "SA",
  "DE",
  "DA",
  "DO",
  "DAS",
  "DOS",
  "E",
  "COM",
  "PIX",
  "PAG",
  "PAGAMENTO",
  "TRANSF",
  "TRANSFERENCIA",
  "ENVIADO",
  "RECEBIDO",
]);

/** Palavras significativas (≥ 3 letras/dígitos), sem acento e sem termos genéricos. */
function palavras(texto: string | null): Set<string> {
  return new Set(
    normalizarTexto(texto ?? "")
      .split(/[^A-Z0-9]+/)
      .filter((p) => p.length >= 3 && !PALAVRAS_VAZIAS.has(p)),
  );
}

/** Fração das palavras do emissor que aparecem na contraparte/descrição (0..1). */
export function semelhancaDeNome(
  emissor: string | null,
  candidato: Pick<CandidatoAConciliacao, "descricao" | "contraparte">,
): number {
  const doEmissor = palavras(emissor);
  if (!doEmissor.size) return 0;
  const doCandidato = palavras(
    `${candidato.contraparte ?? ""} ${candidato.descricao}`,
  );
  let comuns = 0;
  for (const p of doEmissor) if (doCandidato.has(p)) comuns++;
  return comuns / doEmissor.size;
}

/**
 * Mesmo valor absoluto, data em ±3 dias e sentido certo (saída; recibo aceita entrada).
 * 1 candidato → conciliado; 0 → pendente; vários → desempata pelo nome, senão ambíguo.
 */
export function conciliar(
  comprovante: {
    tipo: TipoDeComprovante | null;
    valorCentavos: Centavos | null;
    data: DataISO | null;
    emissor: string | null;
  },
  candidatos: readonly CandidatoAConciliacao[],
): ResultadoDaConciliacao {
  const { valorCentavos, data } = comprovante;
  if (!valorCentavos || !data) return { situacao: "pendente" };
  const aceitaEntrada = comprovante.tipo === "recibo";
  const validos = candidatos.filter(
    (c) =>
      Math.abs(c.valorCentavos) === Math.abs(valorCentavos) &&
      (c.valorCentavos < 0 || aceitaEntrada) &&
      diasEntre(c.data, data) <= TOLERANCIA_EM_DIAS,
  );
  if (validos.length === 0) return { situacao: "pendente" };
  if (validos.length === 1)
    return { situacao: "conciliado", transacaoId: validos[0].id };

  const notas = validos
    .map((c) => ({ id: c.id, nota: semelhancaDeNome(comprovante.emissor, c) }))
    .sort((a, b) => b.nota - a.nota);
  if (notas[0].nota > 0 && notas[0].nota > notas[1].nota)
    return { situacao: "conciliado", transacaoId: notas[0].id };
  return { situacao: "ambiguo", candidatos: notas.map((n) => n.id) };
}
