import Link from "next/link";
import { useId } from "react";
import type { ResumoDoPainel } from "@/regras-de-negocio";
import { formatarMoeda } from "@/ferramentas-internas/formatar-moeda";
import { TabelaAlternativa } from "./TabelaAlternativa";

type Centro = ResumoDoPainel["resultadoPorCentroDeCusto"][number];

type Props = {
  centros: Centro[];
  /** Link "Classificar" das transações sem centro (RF-26). */
  hrefSemCentro: string;
  titulo?: string;
  /** Ações por linha (renomear/arquivar em /centros-de-custo). */
  acoes?: (c: Centro) => React.ReactNode;
};

/**
 * Resultado por centro de custo (RF-26): cada centro é uma trilha com entradas (verde) e saídas
 * (terracota) na mesma escala e a margem no fim. O mais lucrativo é dito em texto, não só na cor.
 */
export function ResultadoPorCentro({
  centros,
  hrefSemCentro,
  titulo = "Resultado por centro de custo",
  acoes,
}: Props) {
  const id = useId();
  const escala = Math.max(
    ...centros.map((c) => Math.max(c.entradasCentavos, c.saidasCentavos)),
    1,
  );
  const comCentro = centros.filter((c) => c.centroDeCustoId !== null);
  const melhor = comCentro.reduce<Centro | null>(
    (m, c) => (c.resultadoCentavos > (m?.resultadoCentavos ?? 0) ? c : m),
    null,
  );

  return (
    <figure aria-labelledby={`${id}-t`} className="grid content-start gap-4">
      <figcaption className="grid gap-1">
        <h2 id={`${id}-t`} className="text-xl font-semibold">
          {titulo}
        </h2>
        <p className="text-sm text-texto-suave">
          {melhor ? (
            <>
              <strong className="font-semibold text-texto">
                {melhor.nome}
              </strong>{" "}
              é o serviço que mais dá lucro no período.
            </>
          ) : (
            "Nenhum serviço teve lucro no período."
          )}
        </p>
      </figcaption>

      <ul className="grid gap-5">
        {centros.map((c) => (
          <li key={c.centroDeCustoId ?? "sem"} className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="flex items-center gap-2 font-medium">
                {c.nome}
                {c === melhor && (
                  <span className="rounded-full bg-primaria-suave px-2 py-0.5 text-xs font-semibold text-primaria-texto">
                    Mais lucrativo
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 text-sm">
                {c.centroDeCustoId === null && (
                  <Link
                    href={hrefSemCentro}
                    className="font-medium text-primaria-texto underline underline-offset-4"
                  >
                    Classificar
                  </Link>
                )}
                <span
                  className={`valor-monetario font-semibold ${c.resultadoCentavos >= 0 ? "text-entrada" : "text-saida"}`}
                >
                  {formatarMoeda(c.resultadoCentavos, { sinal: true })}
                </span>
                {acoes?.(c)}
              </span>
            </div>
            <div aria-hidden="true" className="grid gap-1">
              <Trilha
                valor={c.entradasCentavos}
                escala={escala}
                cor="var(--grafico-entrada)"
                rotulo={formatarMoeda(c.entradasCentavos, {
                  sinal: true,
                  compacto: true,
                })}
              />
              <Trilha
                valor={c.saidasCentavos}
                escala={escala}
                cor="var(--grafico-saida)"
                rotulo={formatarMoeda(-c.saidasCentavos, { compacto: true })}
              />
            </div>
          </li>
        ))}
      </ul>

      <TabelaAlternativa
        legenda="Entradas, saídas e resultado por centro de custo"
        colunas={["Centro de custo", "Entradas", "Saídas", "Resultado"]}
        linhas={centros.map((c) => [
          c.nome,
          formatarMoeda(c.entradasCentavos),
          formatarMoeda(-c.saidasCentavos),
          formatarMoeda(c.resultadoCentavos, { sinal: true }),
        ])}
      />
    </figure>
  );
}

function Trilha({
  valor,
  escala,
  cor,
  rotulo,
}: {
  valor: number;
  escala: number;
  cor: string;
  rotulo: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_4.5rem] items-center gap-3">
      <svg width="100%" height="8" className="overflow-visible">
        <rect
          x="0"
          y="0"
          height="8"
          rx="4"
          width={`${Math.max(valor > 0 ? 1 : 0, (valor / escala) * 100)}%`}
          fill={cor}
        />
      </svg>
      <span className="valor-monetario text-right text-xs text-texto-suave">
        {rotulo}
      </span>
    </div>
  );
}
