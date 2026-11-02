/**
 * Classes de controles do Rastro (strings, não componentes: um <button> ou <Link> recebe a mesma aparência).
 * Raios: rounded-full só em botões e pílulas; rounded-p em campos (design-system §4).
 * Alvos de 44 px no celular (h-11), 40 px no desktop.
 */

const base =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium " +
  "transition-[transform,background-color,color] duration-[140ms] ease-saida active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-60 md:h-10";

export const botao = {
  primario: `${base} bg-primaria text-sobre-primaria hover:bg-secundaria`,
  secundario: `${base} border border-borda-controle bg-superficie text-texto hover:bg-superficie-2`,
  fantasma: `${base} text-texto hover:bg-superficie-2`,
  perigo: `${base} border border-erro/50 text-erro hover:bg-erro-suave`,
  /** Botão só com ícone: quadrado de 44 px. */
  icone:
    "inline-grid size-11 shrink-0 place-items-center rounded-full text-texto-suave transition-[transform,background-color] duration-[140ms] ease-saida hover:bg-superficie-2 hover:text-texto active:scale-[0.97] md:size-10",
} as const;

export const campo =
  "h-11 w-full min-w-0 rounded-p border border-borda-controle bg-superficie px-3 text-texto " +
  "placeholder:text-texto-suave aria-invalid:border-erro md:h-10";

export const rotulo = "text-sm font-medium text-texto";

export const ajuda = "text-xs text-texto-suave";

export const mensagemDeErro = "text-sm text-erro";
