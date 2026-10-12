"use client";

import { useState } from "react";
import { botao, campo } from "@/componentes/formulario/classes";
import type {
  NovaRegra,
  Regra,
  ResultadoDaAcao,
  SugestaoDeRegra,
} from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

export type CriarRegra = (
  dados: NovaRegra,
) => Promise<ResultadoDaAcao<{ regra: Regra; transacoesAlteradas: number }>>;

type Props = {
  sugestao: SugestaoDeRegra;
  nomeDaCategoria: string;
  criarRegra: CriarRegra;
  aoTerminar: (mensagem: string | null) => void;
};

/** A correção vira regra (RF-21): faixa inline sob a linha corrigida, com a condição editável. */
export function OfertaDeRegra({
  sugestao,
  nomeDaCategoria,
  criarRegra,
  aoTerminar,
}: Props) {
  const [padrao, setPadrao] = useState(sugestao.padrao);
  const [aplicar, setAplicar] = useState(sugestao.transacoesAfetadas > 0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const onde =
    sugestao.campo === "contraparte" ? "a contraparte" : "a descrição";

  async function criar() {
    setSalvando(true);
    setErro(null);
    const r = await criarRegra({
      padrao,
      campo: sugestao.campo,
      categoriaId: sugestao.categoriaId,
      centroDeCustoId: sugestao.centroDeCustoId,
      origem: "correcao",
      aplicarNasExistentes: aplicar,
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro.mensagem);
    const n = r.dados.transacoesAlteradas;
    aoTerminar(
      n > 0
        ? `Regra criada. ${n} ${n === 1 ? "transação recategorizada" : "transações recategorizadas"}.`
        : "Regra criada.",
    );
  }

  return (
    <div
      className="surgir grid gap-3 rounded-m border border-primaria/40 bg-primaria-suave p-4 text-sm"
      role="group"
      aria-label="Criar regra"
    >
      <p className="font-medium text-texto">
        Criar regra: sempre que {onde} contiver
        <label className="sr-only" htmlFor={`padrao-${sugestao.categoriaId}`}>
          Texto da condição
        </label>
        <input
          id={`padrao-${sugestao.categoriaId}`}
          value={padrao}
          onChange={(e) => setPadrao(e.target.value)}
          autoCapitalize="characters"
          className={`${campo} mx-1.5 my-1 inline-block h-9! w-auto max-w-full min-w-[10ch] align-middle font-mono text-sm uppercase`}
          size={Math.max(10, padrao.length)}
        />
        , usar <strong>{nomeDaCategoria}</strong>?
      </p>
      {sugestao.transacoesAfetadas > 0 && (
        <label className="flex min-h-11 items-center gap-2 md:min-h-0">
          <input
            type="checkbox"
            checked={aplicar}
            onChange={(e) => setAplicar(e.target.checked)}
            className="size-4 accent-[var(--cor-primaria-texto)]"
          />
          Aplicar também às {sugestao.transacoesAfetadas} transações parecidas
          (as que você corrigiu ficam como estão)
        </label>
      )}
      {erro && <p className="text-erro">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={criar}
          disabled={salvando || padrao.trim().length < 2}
          aria-busy={salvando || undefined}
          className={botao.primario}
        >
          {salvando ? (
            <Carregando
              contexto="categorizando"
              tamanho="inline"
              rotulo="Criando regra"
            />
          ) : (
            "Criar regra"
          )}
        </button>
        <button
          type="button"
          onClick={() => aoTerminar(null)}
          disabled={salvando}
          className={botao.fantasma}
        >
          Só esta
        </button>
      </div>
    </div>
  );
}
