import { useId } from "react";
import type { SaldoDoMes } from "@/regras-de-negocio";
import { formatarMes } from "@/ferramentas-internas/formatar-data";
import { formatarMoeda } from "@/ferramentas-internas/formatar-moeda";
import { escalaRedonda } from "./escala";
import { TabelaAlternativa } from "./TabelaAlternativa";

const ALTURA = 200;

/**
 * Saldo das contas no fim de cada mês: uma série só, em linha (mudança ao longo do tempo).
 * Mesma construção do gráfico de entradas e saídas: SVG sem viewBox, x em %, y em px.
 * O eixo inclui o zero; se algum mês fechou negativo, ele desce o necessário.
 * Série única: o título já diz o que é, então não há legenda. A tabela é a alternativa.
 */
export function GraficoSaldo({ saldos }: { saldos: SaldoDoMes[] }) {
  const id = useId();
  const n = saldos.length;
  const valoresDoSaldo = saldos.map((s) => s.saldoCentavos);
  const acima = escalaRedonda(Math.max(0, ...valoresDoSaldo));
  const abaixo = escalaRedonda(Math.max(0, -Math.min(0, ...valoresDoSaldo)), 2);
  const temNegativo = abaixo.valores.length > 1;
  const teto = acima.teto;
  const piso = temNegativo ? -abaixo.teto : 0;
  const marcas = [
    ...(temNegativo ? abaixo.valores.slice(1).map((v) => -v) : []),
    ...acima.valores,
  ];
  const y = (v: number) => ALTURA - ((v - piso) / (teto - piso)) * ALTURA;
  const coluna = 100 / n;
  const x = (i: number) => coluna * i + coluna / 2;
  const primeiro = saldos[0];
  const ultimo = saldos[n - 1];
  const variacao = ultimo.saldoCentavos - primeiro.saldoCentavos;

  return (
    <figure
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      className="grid content-start gap-4"
    >
      <figcaption className="grid gap-1">
        <h2 id={`${id}-t`} className="text-xl font-semibold">
          Saldo ao longo do tempo
        </h2>
        <p id={`${id}-d`} className="text-sm text-texto-suave">
          Saldo das contas no fim de cada mês, nos últimos {n} meses.{" "}
          {variacao === 0
            ? "Sem variação no período."
            : `${variacao > 0 ? "Subiu" : "Caiu"} ${formatarMoeda(Math.abs(variacao))} desde ${formatarMes(primeiro.mes, "longo")}.`}{" "}
          Calculado a partir do saldo atual e dos lançamentos do extrato.
        </p>
      </figcaption>

      <div className="grid grid-cols-[3.75rem_1fr] gap-x-2">
        {/* Eixo y (texto em HTML para não escalar) */}
        <div
          aria-hidden="true"
          className="relative text-right text-xs text-texto-suave"
          style={{ height: ALTURA }}
        >
          {marcas.map((v) => (
            <span
              key={v}
              className="valor-monetario absolute right-0 -translate-y-1/2"
              style={{ top: y(v) }}
            >
              {formatarMoeda(v, { compacto: true })}
            </span>
          ))}
        </div>
        <svg
          aria-hidden="true"
          width="100%"
          height={ALTURA}
          className="overflow-visible"
        >
          {marcas.map((v) => (
            <line
              key={v}
              x1="0"
              x2="100%"
              y1={y(v)}
              y2={y(v)}
              stroke={
                v === 0 ? "var(--cor-borda-controle)" : "var(--cor-borda)"
              }
              strokeWidth={1}
            />
          ))}
          {/* A linha vai em segmentos: <line> aceita x em %, <polyline> não. */}
          {saldos.slice(1).map((s, i) => (
            <line
              key={s.mes}
              x1={`${x(i)}%`}
              x2={`${x(i + 1)}%`}
              y1={y(saldos[i].saldoCentavos)}
              y2={y(s.saldoCentavos)}
              stroke="var(--cor-primaria-texto)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
          {saldos.map((s, i) => (
            <g key={s.mes}>
              {/* Anel da cor da superfície: o ponto não gruda na linha nem na grade. */}
              <circle
                cx={`${x(i)}%`}
                cy={y(s.saldoCentavos)}
                r={5}
                fill="var(--cor-primaria-texto)"
                stroke="var(--cor-fundo)"
                strokeWidth={2}
              />
              {/* Alvo maior que o ponto para o passar do mouse. */}
              <circle
                cx={`${x(i)}%`}
                cy={y(s.saldoCentavos)}
                r={14}
                fill="transparent"
              >
                <title>{`${formatarMes(s.mes, "longo")}: saldo ${formatarMoeda(s.saldoCentavos)}`}</title>
              </circle>
            </g>
          ))}
        </svg>
        <div />
        <ol
          aria-hidden="true"
          className="grid pt-2 text-center text-xs"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {saldos.map((s) => (
            <li key={s.mes} className="grid gap-0.5">
              <span className="font-medium text-texto capitalize">
                {formatarMes(s.mes)}
              </span>
              <span className="valor-monetario text-texto-suave">
                {formatarMoeda(s.saldoCentavos, { compacto: true })}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <TabelaAlternativa
        legenda="Saldo das contas no fim de cada mês"
        colunas={["Mês", "Saldo no fim do mês"]}
        linhas={saldos.map((s) => [
          formatarMes(s.mes, "longo"),
          formatarMoeda(s.saldoCentavos),
        ])}
      />
    </figure>
  );
}
