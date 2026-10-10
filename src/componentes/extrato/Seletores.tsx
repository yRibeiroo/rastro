import type { Ref } from "react";
import type { Categoria, CentroDeCusto, OrigemDaCategoria } from "@/componentes/prototipo/tipos-provisorios";

/**
 * Seletores nativos (o mais acessível que existe: teclado, leitor de tela e roda nativa do celular)
 * com cara de chip. O <select> de categoria é o destino do deixarRastro.
 */
const chip =
  "h-11 max-w-full min-w-0 cursor-pointer truncate rounded-full border border-borda-controle bg-superficie pr-8 pl-3 text-sm text-texto " +
  "transition-colors duration-[180ms] hover:bg-superficie-2 disabled:cursor-wait md:h-9";

type PropsCategoria = {
  categorias: Categoria[];
  valor: string | null;
  /** Entrada só oferece categorias de entrada/ambos; saída, de saída/ambos. */
  sentido: "entrada" | "saida";
  rotulo: string;
  aoMudar: (categoriaId: string | null, el: HTMLSelectElement) => void;
  desabilitado?: boolean;
  ref?: Ref<HTMLSelectElement>;
  className?: string;
};

export function SeletorDeCategoria({ categorias, valor, sentido, rotulo, aoMudar, desabilitado, ref, className = "" }: PropsCategoria) {
  const cabe = categorias.filter((c) => c.id === valor || (!c.arquivada && (c.tipo === "ambos" || c.tipo === sentido)));
  return (
    <select
      ref={ref}
      aria-label={rotulo}
      value={valor ?? ""}
      disabled={desabilitado}
      onChange={(e) => aoMudar(e.target.value || null, e.currentTarget)}
      className={`${chip} ${valor ? "" : "border-dashed text-texto-suave"} ${className}`}
    >
      <option value="">Sem categoria</option>
      {cabe.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
          {c.arquivada ? " (arquivada)" : ""}
        </option>
      ))}
    </select>
  );
}

type PropsCentro = {
  centros: CentroDeCusto[];
  valor: string | null;
  rotulo: string;
  aoMudar: (centroId: string | null) => void;
  desabilitado?: boolean;
  className?: string;
};

export function SeletorDeCentro({ centros, valor, rotulo, aoMudar, desabilitado, className = "" }: PropsCentro) {
  return (
    <select
      aria-label={rotulo}
      value={valor ?? ""}
      disabled={desabilitado}
      onChange={(e) => aoMudar(e.target.value || null)}
      className={`${chip} ${valor ? "" : "border-dashed text-texto-suave"} ${className}`}
    >
      <option value="">Sem centro de custo</option>
      {centros
        .filter((c) => !c.arquivado || c.id === valor)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
    </select>
  );
}

const ORIGEM: Record<OrigemDaCategoria, string> = {
  regra: "por regra",
  ia: "sugerida pela IA",
  usuario: "por você",
  pluggy: "pelo banco",
};

/** Origem da categoria, discreta (RF-16: "sugerida pela IA" quando a origem é ia). */
export function OrigemDaCategoriaTexto({ origem, confianca }: { origem: OrigemDaCategoria | null; confianca?: number | null }) {
  if (!origem) return null;
  return (
    <span className="text-xs text-texto-suave">
      {ORIGEM[origem]}
      {origem === "ia" && confianca != null && confianca < 0.6 && " (pouca certeza)"}
    </span>
  );
}
