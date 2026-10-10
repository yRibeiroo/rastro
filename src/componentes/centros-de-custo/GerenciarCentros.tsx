"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao, campo, mensagemDeErro, rotulo } from "@/componentes/formulario/classes";
import type { CentroDeCusto, Id, ResultadoDaAcao } from "@/componentes/prototipo/tipos-provisorios";
import { Carregando } from "@/identidade-visual/Carregando";

export type AtualizarCentro = (id: Id, dados: Partial<Pick<CentroDeCusto, "nome" | "arquivado">>) => Promise<ResultadoDaAcao<CentroDeCusto>>;
export type CriarCentro = (dados: { nome: string }) => Promise<ResultadoDaAcao<CentroDeCusto>>;

function useAcao() {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  async function executar<T>(acao: () => Promise<ResultadoDaAcao<T>>, sucesso: (dados: T) => string) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    const r = await acao();
    setOcupado(false);
    if (!r.ok) {
      setErro(r.erro.mensagem);
      return false;
    }
    setAviso(sucesso(r.dados));
    iniciar(() => router.refresh());
    return true;
  }
  return { ocupado, erro, aviso, executar };
}

/** Criar centro de custo (RF-23). */
export function NovoCentro({ criar }: { criar: CriarCentro }) {
  const { ocupado, erro, aviso, executar } = useAcao();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const nome = String(new FormData(f).get("nome") ?? "");
        if (await executar(() => criar({ nome }), (c) => `Centro ${c.nome} criado.`)) f.reset();
      }}
      className="grid gap-3 rounded-m border border-borda bg-superficie p-4 sm:grid-cols-[1fr_auto] sm:items-end"
    >
      <div className="grid gap-1.5">
        <label htmlFor="novo-centro" className={rotulo}>
          Novo centro de custo
        </label>
        <input
          id="novo-centro"
          name="nome"
          required
          maxLength={60}
          placeholder="Ex.: Manutenção predial"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? "novo-centro-erro" : undefined}
          className={campo}
        />
      </div>
      <button type="submit" disabled={ocupado} aria-busy={ocupado || undefined} className={botao.primario}>
        {ocupado ? <Carregando tamanho="inline" rotulo="Criando" /> : <><Icone nome="adicionar" className="size-4" />Criar</>}
      </button>
      {erro && (
        <p id="novo-centro-erro" className={`${mensagemDeErro} sm:col-span-2`}>
          {erro}
        </p>
      )}
      <Anuncio className="empty:hidden sm:col-span-2">{aviso && <Sucesso>{aviso}</Sucesso>}</Anuncio>
    </form>
  );
}

/** Renomear e arquivar, na linha do centro. */
export function AcoesDoCentro({ centro, atualizar }: { centro: CentroDeCusto; atualizar: AtualizarCentro }) {
  const { ocupado, erro, aviso, executar } = useAcao();
  const [editando, setEditando] = useState(false);

  if (editando)
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const nome = String(new FormData(e.currentTarget).get("nome") ?? "");
          if (await executar(() => atualizar(centro.id, { nome }), (c) => `Renomeado para ${c.nome}.`)) setEditando(false);
        }}
        className="flex w-full basis-full flex-wrap items-center gap-2"
      >
        <label htmlFor={`nome-${centro.id}`} className="sr-only">
          Novo nome de {centro.nome}
        </label>
        <input id={`nome-${centro.id}`} name="nome" defaultValue={centro.nome} required maxLength={60} autoFocus className={`${campo} flex-1 sm:max-w-xs`} />
        <button type="submit" disabled={ocupado} className={botao.primario}>
          {ocupado ? <Carregando tamanho="inline" rotulo="Salvando" /> : "Salvar"}
        </button>
        <button type="button" onClick={() => setEditando(false)} className={botao.fantasma}>
          Cancelar
        </button>
        {erro && (
          <p className={`${mensagemDeErro} basis-full`} role="alert">
            {erro}
          </p>
        )}
      </form>
    );

  return (
    <span className="flex flex-wrap items-center">
      <button type="button" onClick={() => setEditando(true)} className={botao.fantasma} aria-label={`Renomear ${centro.nome}`}>
        Renomear
      </button>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => executar(() => atualizar(centro.id, { arquivado: true }), (c) => `${c.nome} arquivado.`)}
        className={botao.fantasma}
        aria-label={`Arquivar ${centro.nome}`}
      >
        {ocupado ? <Carregando tamanho="inline" rotulo="Arquivando" /> : "Arquivar"}
      </button>
      <Anuncio className="sr-only">{aviso}</Anuncio>
      {erro && (
        <span className="text-sm text-erro" role="alert">
          {erro}
        </span>
      )}
    </span>
  );
}

export function DesarquivarCentro({ centro, atualizar }: { centro: CentroDeCusto; atualizar: AtualizarCentro }) {
  const { ocupado, erro, executar } = useAcao();
  return (
    <span className="flex items-center gap-2">
      {erro && <span className="text-sm text-erro">{erro}</span>}
      <button
        type="button"
        disabled={ocupado}
        onClick={() => executar(() => atualizar(centro.id, { arquivado: false }), (c) => `${c.nome} voltou.`)}
        className={botao.fantasma}
        aria-label={`Desarquivar ${centro.nome}`}
      >
        {ocupado ? <Carregando tamanho="inline" rotulo="Desarquivando" /> : "Desarquivar"}
      </button>
    </span>
  );
}
