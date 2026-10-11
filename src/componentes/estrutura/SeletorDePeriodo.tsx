import Link from "next/link";
import type { DataISO, PeriodoDoPainel } from "@/regras-de-negocio";
import { hojeISO } from "@/ferramentas-internas/formatar-data";

export type ChavePeriodo = "mes" | "3m" | "6m" | "12m";
export const PERIODOS: Record<ChavePeriodo, string> = {
  mes: "Este mês",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
};

/** Do dia 1 do mês (N-1 meses atrás) até hoje, no fuso America/Araguaina. */
export function periodoDe(chave: ChavePeriodo, hoje: DataISO = hojeISO()): PeriodoDoPainel {
  const meses = { mes: 1, "3m": 3, "6m": 6, "12m": 12 }[chave];
  const [a, m] = hoje.split("-").map(Number);
  return { de: new Date(Date.UTC(a, m - meses, 1)).toISOString().slice(0, 10), ate: hoje };
}

export const CHAVES_DE_PERIODO = Object.keys(PERIODOS) as ChavePeriodo[];

export function lerPeriodo(valor: string | string[] | undefined): ChavePeriodo {
  return CHAVES_DE_PERIODO.includes(valor as ChavePeriodo) ? (valor as ChavePeriodo) : "mes";
}

/** Período por link (?periodo=): funciona sem JavaScript e o endereço guarda a escolha. */
export function SeletorDePeriodo({ atual, caminho }: { atual: ChavePeriodo; caminho: string }) {
  return (
    <nav aria-label="Período">
      <ul className="flex w-fit flex-wrap gap-1 rounded-full border border-borda bg-superficie p-1">
        {CHAVES_DE_PERIODO.map((c) => (
          <li key={c}>
            <Link
              href={`${caminho}?periodo=${c}`}
              scroll={false}
              aria-current={c === atual ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-full px-3 text-sm transition-colors duration-[180ms] ${
                c === atual ? "bg-primaria-suave font-semibold text-texto" : "text-texto-suave hover:text-texto"
              }`}
            >
              {PERIODOS[c]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
