import Link from "next/link";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";
import type { EstadoDoLimite, SituacaoDoLimite } from "@/regras-de-negocio";

// Sem "use client": só exibe. O estado vem em texto além da cor (nunca só cor).

const COR: Record<EstadoDoLimite, string> = { ok: "bg-primaria", atencao: "bg-alerta", estourado: "bg-erro" };
const TEXTO: Record<EstadoDoLimite, string> = { ok: "", atencao: "atenção", estourado: "estourou" };

export function BarrasDeLimite({ limites, hrefDoExtrato }: { limites: SituacaoDoLimite[]; hrefDoExtrato?: (categoriaId: string) => string }) {
  return (
    <ul className="grid gap-4">
      {limites.map((l) => {
        const pct = Math.round(l.proporcao * 100);
        const nome = hrefDoExtrato ? (
          <Link href={hrefDoExtrato(l.categoriaId)} className="underline-offset-4 hover:underline">
            {l.nome}
          </Link>
        ) : (
          l.nome
        );
        return (
          <li key={l.categoriaId} className="grid gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-medium">
                {nome}
                {l.estado !== "ok" && (
                  <span className={`ml-2 rounded-full px-2 text-xs font-semibold ${l.estado === "estourado" ? "bg-erro-suave text-erro" : "bg-alerta-suave text-alerta"}`}>
                    {TEXTO[l.estado]}
                  </span>
                )}
              </span>
              <span className="text-texto-suave">
                <ValorMonetario centavos={l.gastoCentavos} className="font-semibold text-texto" /> de{" "}
                <ValorMonetario centavos={l.valorMensalCentavos} /> <span className="valor-monetario">({pct}%)</span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${l.nome}: ${pct}% do limite`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(pct, 100)}
              className="h-2 overflow-hidden rounded-full bg-superficie-2"
            >
              <div className={`h-full rounded-full ${COR[l.estado]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
