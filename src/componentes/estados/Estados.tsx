import type { ReactNode } from "react";
import { caminhoDaTrilha } from "@/identidade-visual/rastro-movimento";

/**
 * Estados padronizados (design-system §9): Vazio diz o que fazer e oferece a ação; Erro diz o que
 * aconteceu e oferece tentar de novo; Sucesso é uma confirmação discreta em aria-live.
 */

type PropsVazio = {
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
  /** Trilha pontilhada que termina num ponto: "o rastro ainda não começou". */
  trilha?: boolean;
};

export function Vazio({ titulo, descricao, acao, trilha = true }: PropsVazio) {
  return (
    <div className="grid justify-items-start gap-4 py-10 md:py-14">
      {trilha && (
        <svg
          aria-hidden="true"
          width="220"
          height="56"
          viewBox="0 0 220 56"
          className="overflow-visible"
        >
          <path
            d={caminhoDaTrilha(4, 50, 196, 18)}
            fill="none"
            stroke="var(--cor-rastro)"
            strokeWidth={2}
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
          <circle cx="200" cy="17" r="5" fill="var(--cor-primaria)" />
        </svg>
      )}
      <h2 className="text-xl font-semibold">{titulo}</h2>
      {descricao && (
        <p className="max-w-[56ch] text-texto-suave">{descricao}</p>
      )}
      {acao && <div className="flex flex-wrap gap-3">{acao}</div>}
    </div>
  );
}

type PropsErro = {
  titulo?: string;
  mensagem: ReactNode;
  acao?: ReactNode;
  /** "faixa" (topo da página, dados antigos continuam visíveis) ou "bloco" (ocupa a área). */
  variante?: "faixa" | "bloco";
};

export function Erro({
  titulo = "Algo deu errado",
  mensagem,
  acao,
  variante = "bloco",
}: PropsErro) {
  if (variante === "faixa") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-m bg-erro-suave px-4 py-3 text-sm"
      >
        <p className="min-w-0 flex-1 text-texto">
          <strong className="font-semibold text-erro">{titulo}. </strong>
          {mensagem}
        </p>
        {acao}
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="grid justify-items-start gap-3 rounded-g border border-borda bg-superficie p-6 md:p-8"
    >
      <h2 className="text-xl font-semibold text-erro">{titulo}</h2>
      <p className="max-w-[56ch] text-texto">{mensagem}</p>
      {acao && <div className="flex flex-wrap gap-3 pt-1">{acao}</div>}
    </div>
  );
}

/** Confirmação visual. Coloque dentro de um <Anuncio> já montado para o leitor de tela ouvir. */
export function Sucesso({ children }: { children: ReactNode }) {
  return (
    <p className="surgir flex items-center gap-2 text-sm font-medium text-sucesso">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
        <path
          d="M3 8.5l3.2 3L13 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </p>
  );
}

/** Região aria-live montada desde o início: o que entrar nela é anunciado (sucesso ou erro de ação). */
export function Anuncio({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      {children}
    </div>
  );
}
