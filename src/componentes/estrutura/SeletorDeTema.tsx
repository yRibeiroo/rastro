"use client";

import { useId, useSyncExternalStore } from "react";
import { definirTema, type Tema } from "@/identidade-visual/tema";

const OPCOES: { valor: Tema; rotulo: string }[] = [
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
  { valor: "sistema", rotulo: "Sistema" },
];

// O tema vive no <html data-tema> (gravado antes da pintura pelo script do layout).
function assinar(aviso: () => void) {
  const observador = new MutationObserver(aviso);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-tema"],
  });
  return () => observador.disconnect();
}
const temaAtual = (): Tema =>
  (document.documentElement.dataset.tema as Tema | undefined) ?? "sistema";

export function SeletorDeTema({ className = "" }: { className?: string }) {
  const nome = useId();
  const tema = useSyncExternalStore(
    assinar,
    temaAtual,
    () => "sistema" as Tema,
  );
  return (
    <fieldset className={`grid gap-1.5 ${className}`}>
      <legend className="mb-1.5 text-xs text-texto-suave">Tema</legend>
      <div className="grid grid-cols-3 rounded-full border border-borda bg-superficie p-1">
        {OPCOES.map((o) => (
          <label
            key={o.valor}
            className="grid h-9 cursor-pointer place-items-center rounded-full px-2 text-xs font-medium text-texto-suave transition-colors duration-[180ms] has-checked:bg-primaria-suave has-checked:text-texto has-focus-visible:outline-2 has-focus-visible:outline-foco"
          >
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={tema === o.valor}
              onChange={() => definirTema(o.valor)}
              className="sr-only"
            />
            {o.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
