"use client";

import { useRef, useState } from "react";
import { Carregando } from "@/identidade-visual/Carregando";
import { deixarRastro } from "@/identidade-visual/rastro-movimento";
import {
  CHAVE_ABERTURA,
  definirTema,
  type Tema,
} from "@/identidade-visual/tema";

const botao =
  "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-transform duration-[140ms] ease-saida active:scale-[0.97]";

export function SeletorDeTema() {
  const [tema, setTema] = useState<Tema>("sistema");
  const opcoes: Tema[] = ["sistema", "claro", "escuro"];
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex rounded-full border border-borda bg-superficie p-1"
    >
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={tema === o}
          onClick={() => {
            definirTema(o);
            setTema(o);
          }}
          className={`h-8 rounded-full px-3 text-sm capitalize ${
            tema === o
              ? "bg-primaria-suave text-texto font-medium"
              : "text-texto-suave"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function RepetirAbertura() {
  return (
    <button
      type="button"
      className={`${botao} bg-primaria text-sobre-primaria`}
      onClick={() => {
        try {
          sessionStorage.removeItem(CHAVE_ABERTURA);
        } catch {}
        location.reload();
      }}
    >
      Ver a abertura de novo
    </button>
  );
}

export function BotaoSincronizar() {
  const [ocupado, setOcupado] = useState(false);
  return (
    <button
      type="button"
      aria-busy={ocupado}
      disabled={ocupado}
      onClick={() => {
        setOcupado(true);
        setTimeout(() => setOcupado(false), 2500);
      }}
      className={`${botao} border border-borda-controle bg-superficie text-texto disabled:cursor-wait`}
    >
      {ocupado ? (
        <Carregando
          contexto="sincronizando"
          tamanho="inline"
          rotulo="Sincronizando"
        />
      ) : (
        "Sincronizar agora"
      )}
    </button>
  );
}

const CATEGORIAS = ["Combustível", "Material elétrico", "Ferramentas"];
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function DemoRastro() {
  const origem = useRef<HTMLDivElement>(null);
  const destinos = useRef<(HTMLButtonElement | null)[]>([]);
  const [categoria, setCategoria] = useState<string | null>(null);

  async function categorizar(i: number) {
    const alvo = destinos.current[i];
    if (origem.current && alvo) await deixarRastro(origem.current, alvo);
    setCategoria(CATEGORIAS[i]);
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-center">
      <div
        ref={origem}
        className="flex items-center justify-between gap-6 rounded-m border border-borda bg-superficie p-4"
      >
        <div>
          <p className="font-medium">POSTO TOCANTINS LTDA</p>
          <p className="text-sm text-texto-suave">08/10 · Pix enviado</p>
        </div>
        <p className="valor-monetario font-semibold text-saida">
          {brl.format(-286.4)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c, i) => (
          <button
            key={c}
            ref={(el) => {
              destinos.current[i] = el;
            }}
            type="button"
            onClick={() => categorizar(i)}
            aria-pressed={categoria === c}
            className={`h-9 rounded-full border px-3 text-sm ${
              categoria === c
                ? "border-primaria-texto bg-primaria-suave text-primaria-texto font-medium"
                : "border-borda-controle text-texto"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="text-sm text-texto-suave md:col-span-2">
        {categoria
          ? `Transação movida para ${categoria}.`
          : "Escolha uma categoria para ver o rastro."}
      </p>
    </div>
  );
}
