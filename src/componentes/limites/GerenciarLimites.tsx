"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { ajuda, botao, campo, mensagemDeErro, rotulo } from "@/componentes/formulario/classes";
import { formatarMoeda, textoParaCentavos } from "@/ferramentas-internas/formatar-moeda";
import type { Categoria, Id, LimiteDeGasto, ResultadoDaAcao } from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

// Limites de gasto mensal por categoria (Fase 6, ADR 0017).

type Definir = (limite: LimiteDeGasto) => Promise<ResultadoDaAcao<LimiteDeGasto>>;
type Remover = (categoriaId: Id) => Promise<ResultadoDaAcao<null>>;

export function GerenciarLimites({
  categorias,
  limites,
  definir,
  remover,
}: {
  categorias: Categoria[];
  limites: LimiteDeGasto[];
  definir: Definir;
  remover: Remover;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const deSaida = categorias.filter((c) => !c.arquivada && c.tipo !== "entrada" && c.entraNoResultado);
  const nome = new Map(categorias.map((c) => [c.id, c.nome]));

  async function executar<T>(chave: string, acao: () => Promise<ResultadoDaAcao<T>>, sucesso: string) {
    setOcupado(chave);
    setErro(null);
    setAviso(null);
    const r = await acao();
    setOcupado(null);
    if (!r.ok) {
      setErro(r.erro.mensagem);
      return false;
    }
    setAviso(sucesso);
    iniciar(() => router.refresh());
    return true;
  }

  return (
    <section aria-labelledby="limites" className="grid content-start gap-4">
      <div className="grid gap-1">
        <h2 id="limites" className="text-xl font-semibold">
          Limites do mês
        </h2>
        <p className={ajuda}>Quanto você quer gastar por mês em cada categoria. O painel avisa a partir de 80%.</p>
      </div>

      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const d = new FormData(f);
          const valor = textoParaCentavos(String(d.get("valor") ?? ""));
          if (!valor) return setErro("Informe um valor maior que zero. Ex.: 600,00.");
          const categoriaId = String(d.get("categoria") ?? "");
          if (await executar("novo", () => definir({ categoriaId, valorMensalCentavos: valor }), `Limite de ${nome.get(categoriaId)} salvo.`))
            f.reset();
        }}
        className="grid gap-3 rounded-m border border-borda bg-superficie p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <label htmlFor="limite-categoria" className={rotulo}>
            Categoria
          </label>
          <select id="limite-categoria" name="categoria" required className={campo}>
            {deSaida.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {limites.some((l) => l.categoriaId === c.id) ? " (trocar valor)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="limite-valor" className={rotulo}>
            Por mês (R$)
          </label>
          <input id="limite-valor" name="valor" required inputMode="decimal" placeholder="0,00" className={`${campo} valor-monetario`} />
        </div>
        <button type="submit" disabled={ocupado !== null} className={botao.primario}>
          {ocupado === "novo" ? <Carregando tamanho="inline" rotulo="Salvando" /> : "Salvar"}
        </button>
      </form>

      {erro && (
        <p className={mensagemDeErro} role="alert">
          {erro}
        </p>
      )}
      <Anuncio className="empty:hidden">{aviso && <Sucesso>{aviso}</Sucesso>}</Anuncio>

      {limites.length > 0 && (
        <ul className="divide-y divide-borda">
          {limites.map((l) => (
            <li key={l.categoriaId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {nome.get(l.categoriaId) ?? "Categoria removida"}:{" "}
                <span className="valor-monetario font-semibold">{formatarMoeda(l.valorMensalCentavos)}</span>
              </span>
              <button
                type="button"
                disabled={ocupado !== null}
                className={botao.fantasma}
                aria-label={`Remover o limite de ${nome.get(l.categoriaId) ?? "categoria"}`}
                onClick={() => executar(l.categoriaId, () => remover(l.categoriaId), "Limite removido.")}
              >
                {ocupado === l.categoriaId ? <Carregando tamanho="inline" rotulo="Removendo" /> : "Remover"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
