"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao, campo, rotulo } from "@/componentes/formulario/classes";
import type { Categoria, CentroDeCusto } from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";
import { PERIODOS_DO_EXTRATO, type PeriodoDoExtrato } from "./filtros-da-url";

type Valores = { de: string; ate: string; categoria: string; centro: string; sentido: string; busca: string };

type Props = {
  periodo: PeriodoDoExtrato;
  valores: Valores;
  ativos: number;
  categorias: Categoria[];
  centros: CentroDeCusto[];
};

/**
 * Busca e filtros do extrato, sempre refletidos na URL (RF-17, RF-18). A busca espera 300 ms.
 * No celular os filtros ficam recolhidos atrás de "Filtros (n)"; no desktop, sempre visíveis.
 */
export function FiltrosDoExtrato({ periodo, valores, ativos, categorias, centros }: Props) {
  const router = useRouter();
  const id = useId();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState(valores.busca);
  // Cópia local dos filtros: duas mudanças seguidas não se perdem enquanto a URL nova carrega.
  // Quando a URL muda por fora (voltar, link), a cópia é refeita a partir dela.
  const daUrl = { ...valores, periodo };
  const chave = JSON.stringify(daUrl);
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  const [locais, setLocais] = useState(daUrl);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setLocais(daUrl);
  }

  function aplicar(mudancas: Partial<typeof locais>) {
    const atual = { ...locais, busca, ...mudancas };
    setLocais(atual);
    const q = new URLSearchParams();
    if (atual.periodo === "personalizado") {
      if (atual.de) q.set("de", atual.de);
      if (atual.ate) q.set("ate", atual.ate);
    } else if (atual.periodo !== "mes") q.set("periodo", atual.periodo);
    for (const c of ["categoria", "centro", "sentido", "busca"] as const) if (atual[c]) q.set(c, atual[c]);
    const texto = q.toString();
    iniciar(() => router.replace(texto ? `/extrato?${texto}` : "/extrato", { scroll: false }));
  }

  function limpar() {
    setBusca("");
    aplicar({ periodo: "mes", de: "", ate: "", categoria: "", centro: "", sentido: "", busca: "" });
  }

  // Busca com espera de 300 ms depois da última tecla.
  useEffect(() => {
    if (busca === locais.busca) return;
    const t = setTimeout(() => aplicar({ busca }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a digitação dispara
  }, [busca]);

  const selecao = `${campo} pr-8`;

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${id}-busca`} className="sr-only">
            Buscar por descrição ou contraparte
          </label>
          <Icone nome="busca" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-suave" />
          <input
            id={`${id}-busca`}
            type="search"
            enterKeyHint="search"
            placeholder="Buscar: posto, condomínio…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            maxLength={100}
            className={`${campo} pl-9`}
          />
        </div>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={`${id}-filtros`}
          onClick={() => setAberto((a) => !a)}
          className={`${botao.secundario} md:hidden`}
        >
          <Icone nome="filtro" className="size-4" />
          Filtros{ativos > 0 && <span className="valor-monetario"> ({ativos})</span>}
        </button>
      </div>

      <div id={`${id}-filtros`} className={`${aberto ? "grid" : "hidden"} gap-3 sm:grid-cols-2 md:grid md:grid-cols-4`}>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-periodo`} className={rotulo}>
            Período
          </label>
          <select
            id={`${id}-periodo`}
            value={locais.periodo}
            onChange={(e) => {
              const p = e.target.value as PeriodoDoExtrato;
              if (p === "personalizado") setLocais((l) => ({ ...l, periodo: p }));
              else aplicar({ periodo: p, de: "", ate: "" });
            }}
            className={selecao}
          >
            {Object.entries(PERIODOS_DO_EXTRATO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {locais.periodo === "personalizado" && (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 md:col-span-4 md:max-w-md">
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-de`} className={rotulo}>
                De
              </label>
              <input id={`${id}-de`} type="date" value={locais.de} onChange={(e) => aplicar({ periodo: "personalizado", de: e.target.value })} className={campo} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-ate`} className={rotulo}>
                Até
              </label>
              <input id={`${id}-ate`} type="date" value={locais.ate} onChange={(e) => aplicar({ periodo: "personalizado", ate: e.target.value })} className={campo} />
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-sentido`} className={rotulo}>
            Entradas ou saídas
          </label>
          <select id={`${id}-sentido`} value={locais.sentido} onChange={(e) => aplicar({ sentido: e.target.value })} className={selecao}>
            <option value="">Todas</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-categoria`} className={rotulo}>
            Categoria
          </label>
          <select id={`${id}-categoria`} value={locais.categoria} onChange={(e) => aplicar({ categoria: e.target.value })} className={selecao}>
            <option value="">Todas</option>
            <option value="nenhuma">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-centro`} className={rotulo}>
            Centro de custo
          </label>
          <select id={`${id}-centro`} value={locais.centro} onChange={(e) => aplicar({ centro: e.target.value })} className={selecao}>
            <option value="">Todos</option>
            <option value="nenhum">Sem centro de custo</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex min-h-6 flex-wrap items-center gap-3 text-sm">
        {ativos > 0 && (
          <button type="button" onClick={limpar} className="min-h-11 font-medium text-primaria-texto underline underline-offset-4 md:min-h-0">
            Limpar filtros
          </button>
        )}
        {pendente && <Carregando contexto="generico" tamanho="inline" rotulo="Filtrando" />}
      </div>
    </div>
  );
}
