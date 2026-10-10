import type { Situacao } from "./situacao";

const COR: Record<Situacao["tom"], string> = {
  ok: "bg-primaria",
  andamento: "bg-primaria animate-pulse motion-reduce:animate-none",
  alerta: "bg-alerta",
  erro: "bg-erro",
};

/** Ponto de estado SEMPRE acompanhado do rótulo em texto (a cor nunca informa sozinha). */
export function IndicadorDeSituacao({ situacao, className = "" }: { situacao: Situacao; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${COR[situacao.tom]}`} />
      <span className={situacao.tom === "alerta" ? "text-alerta" : situacao.tom === "erro" ? "text-erro" : "text-texto"}>
        {situacao.rotulo}
      </span>
    </span>
  );
}
