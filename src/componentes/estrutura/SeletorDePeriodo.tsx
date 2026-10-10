import Link from "next/link";
import { PERIODOS, type ChavePeriodo } from "@/componentes/prototipo/fonte-de-dados";

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
