import Link from "next/link";
import { useId } from "react";
import type { ResumoDoPainel } from "@/regras-de-negocio";
import { formatarMoeda } from "@/ferramentas-internas/formatar-moeda";
import { TabelaAlternativa } from "./TabelaAlternativa";

const LINHA = 48; // altura fixa da linha: a trilha da esquerda calcula as posições sem medir o DOM
const MAXIMO = 8; // RF-25: as 8 maiores, o resto em "Outras"
const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

type Gasto = ResumoDoPainel["gastosPorCategoria"][number];

function agrupar(gastos: Gasto[]): Gasto[] {
  if (gastos.length <= MAXIMO) return gastos;
  const resto = gastos.slice(MAXIMO);
  return [
    ...gastos.slice(0, MAXIMO),
    {
      categoriaId: "outras",
      nome: `Outras (${resto.length})`,
      totalCentavos: resto.reduce((s, g) => s + g.totalCentavos, 0),
      quantidade: resto.reduce((s, g) => s + g.quantidade, 0),
    },
  ];
}

/**
 * "Para onde foi" (RF-25): o total de saídas se divide em trilhas que terminam em cada categoria,
 * um Sankey simplificado. Uma série só, então um matiz só (saída); a categoria é o rótulo escrito.
 */
export function ParaOndeFoi({
  gastos,
  hrefDaCategoria,
}: {
  gastos: Gasto[];
  hrefDaCategoria: (categoriaId: string | null) => string;
}) {
  const id = useId();
  const linhas = agrupar(gastos);
  const total = linhas.reduce((s, g) => s + g.totalCentavos, 0);
  const maior = Math.max(...linhas.map((g) => g.totalCentavos), 1);
  const altura = linhas.length * LINHA;

  return (
    <figure
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      className="grid content-start gap-4"
    >
      <figcaption className="grid gap-1">
        <h2 id={`${id}-t`} className="text-xl font-semibold">
          Para onde foi
        </h2>
        <p id={`${id}-d`} className="text-sm text-texto-suave">
          <span className="valor-monetario font-medium text-texto">
            {formatarMoeda(total)}
          </span>{" "}
          em saídas no período, por categoria.
        </p>
      </figcaption>

      <div className="grid grid-cols-[2.5rem_1fr] sm:grid-cols-[4rem_1fr]">
        <svg
          aria-hidden="true"
          width="100%"
          height={altura}
          viewBox={`0 0 64 ${altura}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {linhas.map((g, i) => {
            const fim = i * LINHA + LINHA / 2;
            const meio = altura / 2;
            return (
              <path
                key={g.categoriaId ?? "sem"}
                d={`M0 ${meio} C 36 ${meio}, 28 ${fim}, 64 ${fim}`}
                fill="none"
                stroke="var(--grafico-saida)"
                strokeOpacity={0.35}
                strokeWidth={Math.max(1.5, (g.totalCentavos / total) * 18)}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <ol className="grid" style={{ gridAutoRows: LINHA }}>
          {linhas.map((g) => (
            <li
              key={g.categoriaId ?? "sem"}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 pl-2"
            >
              <div className="grid min-w-0 gap-1">
                {g.categoriaId === "outras" ? (
                  <span className="truncate text-sm">{g.nome}</span>
                ) : (
                  <Link
                    href={hrefDaCategoria(g.categoriaId)}
                    className="truncate text-sm underline-offset-4 hover:underline"
                  >
                    {g.nome}
                  </Link>
                )}
                <span
                  aria-hidden="true"
                  className="h-2 rounded-r-full bg-[var(--grafico-saida)]"
                  style={{
                    width: `${Math.max(1, (g.totalCentavos / maior) * 100)}%`,
                  }}
                />
              </div>
              <span className="grid text-right text-sm">
                <span className="valor-monetario font-medium">
                  {formatarMoeda(g.totalCentavos)}
                </span>
                <span className="valor-monetario text-xs text-texto-suave">
                  {pct.format(g.totalCentavos / total)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <TabelaAlternativa
        legenda="Saídas por categoria"
        colunas={["Categoria", "Total", "Parte", "Transações"]}
        linhas={linhas.map((g) => [
          g.nome,
          formatarMoeda(g.totalCentavos),
          pct.format(g.totalCentavos / total),
          String(g.quantidade),
        ])}
      />
    </figure>
  );
}
