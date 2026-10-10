import { useId } from "react";
import type { ResumoDoPainel } from "@/componentes/prototipo/tipos-provisorios";
import { formatarMes } from "@/ferramentas-internas/formatar-data";
import { formatarMoeda } from "@/ferramentas-internas/formatar-moeda";
import { escalaRedonda } from "./escala";
import { TabelaAlternativa } from "./TabelaAlternativa";

const ALTURA = 200;
const RAIO = 4;

/**
 * Entradas × saídas por mês (RF-24): barras agrupadas, um eixo só, base em zero.
 * SVG sem viewBox: x em %, y em px. Escala com a largura sem distorcer cantos nem texto.
 * Identidade das séries: legenda + posição fixa (entrada à esquerda) + cor validada; a tabela é a alternativa.
 */
export function GraficoEntradasSaidas({ fluxo }: { fluxo: ResumoDoPainel["fluxoMensal"] }) {
  const id = useId();
  const n = fluxo.length;
  const { teto, valores } = escalaRedonda(Math.max(...fluxo.map((m) => Math.max(m.entradasCentavos, m.saidasCentavos))));
  const y = (v: number) => ALTURA - (v / teto) * ALTURA;
  const coluna = 100 / n;
  const barra = Math.min(coluna * 0.3, 7); // % da largura; teto para não engordar com poucos meses
  const vao = 0.6; // % entre as duas barras do mês

  return (
    <figure aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="grid content-start gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <figcaption className="grid gap-1">
          <h2 id={`${id}-t`} className="text-xl font-semibold">
            Entradas e saídas por mês
          </h2>
          <p id={`${id}-d`} className="text-sm text-texto-suave">
            Últimos {n} meses, sem transferências entre contas. O resultado de cada mês está sob o nome do mês.
          </p>
        </figcaption>
        <ul className="flex gap-4 text-sm" aria-label="Legenda">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-[3px] bg-[var(--grafico-entrada)]" />
            Entradas
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-[3px] bg-[var(--grafico-saida)]" />
            Saídas
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-[3.75rem_1fr] gap-x-2">
        {/* Eixo y (texto em HTML para não escalar) */}
        <div aria-hidden="true" className="relative text-right text-xs text-texto-suave" style={{ height: ALTURA }}>
          {valores.map((v) => (
            <span key={v} className="valor-monetario absolute right-0 -translate-y-1/2" style={{ top: y(v) }}>
              {formatarMoeda(v, { compacto: true })}
            </span>
          ))}
        </div>
        <svg aria-hidden="true" width="100%" height={ALTURA} className="overflow-visible">
          <defs>
            <clipPath id={`${id}-base`}>
              <rect x="0" y="-10" width="100%" height={ALTURA + 10} />
            </clipPath>
          </defs>
          {valores.map((v) => (
            <line key={v} x1="0" x2="100%" y1={y(v)} y2={y(v)} stroke="var(--cor-borda)" strokeWidth={1} />
          ))}
          <g clipPath={`url(#${id}-base)`}>
            {fluxo.map((m, i) => {
              const centro = coluna * i + coluna / 2;
              const mes = formatarMes(m.mes, "longo");
              return (
                <g key={m.mes}>
                  {/* altura + RAIO: o canto de baixo fica escondido sob a base, só a ponta é arredondada */}
                  <rect
                    x={`${centro - barra - vao / 2}%`}
                    width={`${barra}%`}
                    y={y(m.entradasCentavos)}
                    height={ALTURA - y(m.entradasCentavos) + RAIO}
                    rx={RAIO}
                    fill="var(--grafico-entrada)"
                  >
                    <title>{`${mes}: entradas ${formatarMoeda(m.entradasCentavos)}`}</title>
                  </rect>
                  <rect
                    x={`${centro + vao / 2}%`}
                    width={`${barra}%`}
                    y={y(m.saidasCentavos)}
                    height={ALTURA - y(m.saidasCentavos) + RAIO}
                    rx={RAIO}
                    fill="var(--grafico-saida)"
                  >
                    <title>{`${mes}: saídas ${formatarMoeda(m.saidasCentavos)}`}</title>
                  </rect>
                </g>
              );
            })}
          </g>
          <line x1="0" x2="100%" y1={ALTURA} y2={ALTURA} stroke="var(--cor-borda-controle)" strokeWidth={1} />
        </svg>
        <div />
        <ol aria-hidden="true" className="grid pt-2 text-center text-xs" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {fluxo.map((m) => (
            <li key={m.mes} className="grid gap-0.5">
              <span className="font-medium text-texto capitalize">{formatarMes(m.mes)}</span>
              <span className={`valor-monetario ${m.resultadoCentavos >= 0 ? "text-entrada" : "text-saida"}`}>
                {formatarMoeda(m.resultadoCentavos, { sinal: true, compacto: true })}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <TabelaAlternativa
        legenda="Entradas, saídas e resultado por mês"
        colunas={["Mês", "Entradas", "Saídas", "Resultado"]}
        linhas={fluxo.map((m) => [
          formatarMes(m.mes, "longo"),
          formatarMoeda(m.entradasCentavos),
          formatarMoeda(-m.saidasCentavos),
          formatarMoeda(m.resultadoCentavos, { sinal: true }),
        ])}
      />
    </figure>
  );
}
