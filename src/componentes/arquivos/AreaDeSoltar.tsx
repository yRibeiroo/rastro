"use client";

import { useState, type ReactNode, type Ref } from "react";

type Props = {
  /** Rótulo do botão (o <label> que abre o seletor). */
  rotulo: ReactNode;
  /** Linha de apoio abaixo do botão (só no desktop aparece "ou arraste aqui"). */
  ajuda?: ReactNode;
  accept: string;
  /** "environment" abre a câmera traseira no celular; o desktop ignora. */
  capture?: "environment";
  desabilitado?: boolean;
  aoEscolher: (arquivo: File) => void;
  /** Extra ao lado do botão principal (ex.: "Escolher arquivo" sem câmera). */
  extra?: ReactNode;
  classeDoBotao: string;
  ref?: Ref<HTMLDivElement>;
};

/**
 * Área para soltar um arquivo (desktop) com um botão que abre o seletor nativo (todos).
 * O <input type="file"> fica dentro do <label>: teclado e leitor de tela usam o controle nativo.
 */
export function AreaDeSoltar({
  rotulo,
  ajuda,
  accept,
  capture,
  desabilitado,
  aoEscolher,
  extra,
  classeDoBotao,
  ref,
}: Props) {
  const [sobre, setSobre] = useState(false);

  return (
    <div
      ref={ref}
      onDragOver={(e) => {
        if (desabilitado) return;
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSobre(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !desabilitado) aoEscolher(f);
      }}
      className={`grid justify-items-center gap-3 rounded-g border-2 border-dashed px-4 py-8 text-center transition-colors duration-[180ms] md:py-12 ${
        sobre
          ? "border-primaria bg-primaria-suave"
          : "border-borda-controle/60 bg-superficie"
      }`}
    >
      <div className="flex flex-wrap justify-center gap-3">
        <label
          className={`${classeDoBotao} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco ${desabilitado ? "pointer-events-none opacity-60" : ""}`}
        >
          {rotulo}
          <input
            type="file"
            accept={accept}
            capture={capture}
            className="sr-only"
            disabled={desabilitado}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // permite escolher o mesmo arquivo de novo
              if (f) aoEscolher(f);
            }}
          />
        </label>
        {extra}
      </div>
      {ajuda && (
        <div className="max-w-[52ch] text-sm text-texto-suave">{ajuda}</div>
      )}
    </div>
  );
}
