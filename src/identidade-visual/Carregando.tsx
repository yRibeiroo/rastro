"use client";

// thinking-orbs não traz "use client" e usa hooks/canvas: este componente é a fronteira de cliente.
import { ThinkingOrb } from "thinking-orbs";
import { CONTEXTOS, type ContextoCarregando } from "./contextos-carregando";

type PropsCarregando = {
  contexto?: ContextoCarregando;
  /** "tela" (64 px, para telas e blocos) ou "inline" (20 px, para texto e botões). */
  tamanho?: "tela" | "inline";
  /** Texto visível e acessível. Sem ele, usa o texto padrão do contexto (visível só em "tela"). */
  rotulo?: string;
  className?: string;
};

export function Carregando({
  contexto = "generico",
  tamanho = "tela",
  rotulo,
  className = "",
}: PropsCarregando) {
  const { estado, texto } = CONTEXTOS[contexto];
  const nome = rotulo ?? texto;
  const tela = tamanho === "tela";
  const visivel = tela || rotulo !== undefined;

  return (
    <span
      role="status"
      className={
        tela
          ? `flex flex-col items-center justify-center gap-4 py-8 text-texto-suave ${className}`
          : `inline-flex items-center gap-2 align-middle ${className}`
      }
    >
      <span className="relative inline-grid place-items-center">
        {tela && (
          // Halo de marca no contêiner: os orbes são monocromáticos e não são alterados.
          <span
            aria-hidden="true"
            className="absolute size-32 rounded-full"
            style={{
              background:
                "radial-gradient(circle, var(--cor-rastro-fraco) 0%, transparent 68%)",
            }}
          />
        )}
        <ThinkingOrb
          state={estado}
          size={tela ? 64 : 20}
          theme="auto"
          aria-label={nome}
          className="relative"
        />
      </span>
      {visivel && (
        // O nome já está no orbe (role="img"); o texto visível não é lido duas vezes.
        <span
          aria-hidden="true"
          className={tela ? "text-sm" : "text-sm text-texto-suave"}
        >
          {nome}
          {tela && "…"}
        </span>
      )}
    </span>
  );
}
