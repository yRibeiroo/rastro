import type { Ref } from "react";
import { descreverMoeda, formatarMoeda } from "@/ferramentas-internas/formatar-moeda";

type Props = {
  centavos: number;
  /** Sempre "+"/"−" e cor de entrada/saída (extrato). Sem isso, só o "−" dos negativos e cor neutra. */
  comSinal?: boolean;
  compacto?: boolean;
  className?: string;
  ref?: Ref<HTMLSpanElement>;
};

/** Valor em R$: sinal E cor (nunca só cor), algarismos tabulares e leitura "mais/menos" no leitor de tela. */
export function ValorMonetario({ centavos, comSinal = false, compacto = false, className = "", ref }: Props) {
  const cor = !comSinal ? "" : centavos > 0 ? "text-entrada" : centavos < 0 ? "text-saida" : "text-texto-suave";
  return (
    <span ref={ref} className={`valor-monetario whitespace-nowrap ${cor} ${className}`}>
      <span aria-hidden="true">{formatarMoeda(centavos, { sinal: comSinal, compacto })}</span>
      <span className="sr-only">{descreverMoeda(centavos)}</span>
    </span>
  );
}
