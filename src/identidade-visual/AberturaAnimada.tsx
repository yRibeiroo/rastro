"use client";

import {
  useEffect,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";
import { LogoRastro } from "./LogoRastro";
import "./abertura.css";

const FIM = new Set(["abertura-fim", "abertura-pular"]);

/**
 * Abertura com a logo, uma vez por sessão. É um overlay por cima dos children, que já estão
 * montados e carregando por baixo: nada espera a animação.
 *
 * Quem decide se toca é o script inline do layout (SCRIPT_ANTES_DA_PINTURA em tema.ts), antes da
 * primeira pintura: na segunda visita ele marca <html data-abertura-vista> e o CSS esconde o overlay.
 * Servidor e cliente renderizam o mesmo HTML, então não há hydration mismatch nem flash.
 */
export function AberturaAnimada({ children }: { children: ReactNode }) {
  const [encerrada, setEncerrada] = useState(false);
  const [pulada, setPulada] = useState(false);

  // HU-02: Enter (ou Esc) pula, mesmo sem o foco no botão. Na segunda visita o overlay nem aparece.
  useEffect(() => {
    if (encerrada || pulada) return;
    if ("aberturaVista" in document.documentElement.dataset) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") setPulada(true);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [encerrada, pulada]);

  function aoTerminar(e: AnimationEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && FIM.has(e.animationName))
      setEncerrada(true);
  }

  return (
    <>
      {!encerrada && (
        <div
          className="abertura"
          data-pulada={pulada || undefined}
          onAnimationEnd={aoTerminar}
        >
          <div className="abertura__veu" aria-hidden="true" />
          <div className="abertura__marca" aria-hidden="true">
            <div className="abertura__logo">
              <LogoRastro
                variante="tracada"
                title=""
                className="abertura__tracado"
                espessura={7}
              />
              <LogoRastro title="" className="abertura__preenchida" />
            </div>
            <span className="abertura__nome">Rastro</span>
          </div>
          <button
            type="button"
            className="abertura__pular"
            onClick={() => setPulada(true)}
          >
            Pular abertura
          </button>
        </div>
      )}
      {children}
    </>
  );
}
