import type { CentroDeCusto, ResumoDoPainel } from "@/regras-de-negocio";

type Linha = ResumoDoPainel["resultadoPorCentroDeCusto"][number];

/** HU-09: todo centro ativo aparece (zerado se não teve movimento), para renomear e arquivar. */
export function comTodosOsCentros(
  resultado: readonly Linha[],
  ativos: readonly Pick<CentroDeCusto, "id" | "nome">[],
): Linha[] {
  const presentes = new Set(resultado.map((l) => l.centroDeCustoId));
  return [
    ...resultado,
    ...ativos
      .filter((c) => !presentes.has(c.id))
      .map((c) => ({
        centroDeCustoId: c.id,
        nome: c.nome,
        entradasCentavos: 0,
        saidasCentavos: 0,
        resultadoCentavos: 0,
      })),
  ];
}
