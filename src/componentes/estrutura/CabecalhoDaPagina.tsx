import type { ReactNode } from "react";
import { caminhoDaTrilha } from "@/identidade-visual/rastro-movimento";

/** Linha-trilha de fundo (design-system §5): textura do conceito, nunca atrás de números. */
export function LinhaTrilha({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 w-full ${className}`}
      viewBox="0 0 1200 160"
      preserveAspectRatio="none"
    >
      <path
        d={caminhoDaTrilha(-20, 150, 1220, 30)}
        fill="none"
        stroke="var(--cor-rastro-fraco)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={caminhoDaTrilha(-20, 160, 1220, 90)}
        fill="none"
        stroke="var(--cor-rastro-fraco)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type Props = { titulo: string; descricao?: ReactNode; acoes?: ReactNode };

export function CabecalhoDaPagina({ titulo, descricao, acoes }: Props) {
  return (
    <header className="relative isolate flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pt-6 pb-6 md:pt-10">
      <LinhaTrilha />
      <div className="grid min-w-0 gap-1.5">
        <h1 className="text-2xl font-bold md:text-3xl">{titulo}</h1>
        {descricao && (
          <p className="max-w-[60ch] text-sm text-texto-suave md:text-base">
            {descricao}
          </p>
        )}
      </div>
      {acoes && (
        <div className="flex flex-wrap items-center gap-2">{acoes}</div>
      )}
    </header>
  );
}
