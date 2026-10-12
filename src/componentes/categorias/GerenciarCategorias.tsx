"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import {
  botao,
  campo,
  mensagemDeErro,
  rotulo,
} from "@/componentes/formulario/classes";
import type {
  Categoria,
  Id,
  ResultadoDaAcao,
  TipoDeCategoria,
} from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

type Props = {
  categorias: Categoria[];
  /** Quantas transações do mês usam cada categoria. */
  uso: Record<Id, number>;
  criarCategoria: (dados: {
    nome: string;
    tipo: TipoDeCategoria;
  }) => Promise<ResultadoDaAcao<Categoria>>;
  atualizarCategoria: (
    id: Id,
    dados: Partial<Pick<Categoria, "nome" | "arquivada">>,
  ) => Promise<ResultadoDaAcao<Categoria>>;
};

const GRUPOS: { tipo: TipoDeCategoria; titulo: string }[] = [
  { tipo: "saida", titulo: "Saídas" },
  { tipo: "entrada", titulo: "Entradas" },
  { tipo: "ambos", titulo: "Entradas e saídas" },
];

/** Categorias (RF-22, HU-13): criar, renomear, arquivar. Categoria em uso nunca é apagada. */
export function GerenciarCategorias({
  categorias,
  uso,
  criarCategoria,
  atualizarCategoria,
}: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [nova, setNova] = useState<Id | null>(null);
  const [editando, setEditando] = useState<Id | null>(null);
  const [ocupado, setOcupado] = useState<Id | null>(null);
  const [erroDaLinha, setErroDaLinha] = useState<{
    id: Id;
    texto: string;
  } | null>(null);
  const [erroNovo, setErroNovo] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const atualizar = () => iniciar(() => router.refresh());

  async function criar(formulario: HTMLFormElement) {
    const dados = new FormData(formulario);
    setCriando(true);
    setErroNovo(null);
    const r = await criarCategoria({
      nome: String(dados.get("nome") ?? ""),
      tipo: String(dados.get("tipo")) as TipoDeCategoria,
    });
    setCriando(false);
    if (!r.ok) return setErroNovo(r.erro.mensagem);
    formulario.reset();
    setNova(r.dados.id);
    setAviso(`Categoria ${r.dados.nome} criada.`);
    atualizar();
  }

  async function mudar(
    c: Categoria,
    dados: Partial<Pick<Categoria, "nome" | "arquivada">>,
    sucesso: string,
  ) {
    setOcupado(c.id);
    setErroDaLinha(null);
    const r = await atualizarCategoria(c.id, dados);
    setOcupado(null);
    if (!r.ok) return setErroDaLinha({ id: c.id, texto: r.erro.mensagem });
    setEditando(null);
    setAviso(sucesso);
    atualizar();
  }

  const ativas = categorias.filter((c) => !c.arquivada);
  const arquivadas = categorias.filter((c) => c.arquivada);

  return (
    <section
      aria-labelledby="titulo-categorias"
      className="grid min-w-0 content-start gap-6"
    >
      <h2 id="titulo-categorias" className="text-xl font-semibold">
        Categorias
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          criar(e.currentTarget);
        }}
        className="grid gap-3 rounded-m border border-borda bg-superficie p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <label htmlFor="nova-categoria" className={rotulo}>
            Nova categoria
          </label>
          <input
            id="nova-categoria"
            name="nome"
            required
            maxLength={60}
            placeholder="Ex.: Uniformes"
            aria-invalid={erroNovo ? true : undefined}
            aria-describedby={erroNovo ? "nova-categoria-erro" : undefined}
            className={campo}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="tipo-categoria" className={rotulo}>
            Tipo
          </label>
          <select
            id="tipo-categoria"
            name="tipo"
            defaultValue="saida"
            className={campo}
          >
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
            <option value="ambos">Entradas e saídas</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={criando}
          aria-busy={criando || undefined}
          className={botao.primario}
        >
          {criando ? (
            <Carregando tamanho="inline" rotulo="Criando" />
          ) : (
            <>
              <Icone nome="adicionar" className="size-4" />
              Criar
            </>
          )}
        </button>
        {erroNovo && (
          <p
            id="nova-categoria-erro"
            className={`${mensagemDeErro} sm:col-span-3`}
          >
            {erroNovo}
          </p>
        )}
      </form>

      <Anuncio className="empty:hidden">
        {aviso && <Sucesso>{aviso}</Sucesso>}
      </Anuncio>

      {ativas.length === 0 && (
        <p className="text-sm text-texto-suave">
          Nenhuma categoria ativa. Crie a primeira acima: o extrato e a IA
          passam a usá-la na hora.
        </p>
      )}

      {GRUPOS.map((g) => {
        const doGrupo = ativas.filter((c) => c.tipo === g.tipo);
        if (doGrupo.length === 0) return null;
        return (
          <div key={g.tipo} className="grid grid-cols-[minmax(0,1fr)] gap-1">
            <h3 className="font-sans text-sm font-semibold tracking-normal text-texto-suave">
              {g.titulo}
            </h3>
            <ul className="divide-y divide-borda">
              {doGrupo.map((c) => (
                <li
                  key={c.id}
                  className={`grid grid-cols-[minmax(0,1fr)] gap-2 py-2.5 transition-colors duration-[1500ms] ${nova === c.id ? "surgir bg-primaria-suave" : ""}`}
                >
                  {editando === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const nome = String(
                          new FormData(e.currentTarget).get("nome") ?? "",
                        );
                        mudar(c, { nome }, `Renomeada para ${nome.trim()}.`);
                      }}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <label htmlFor={`nome-${c.id}`} className="sr-only">
                        Novo nome de {c.nome}
                      </label>
                      <input
                        id={`nome-${c.id}`}
                        name="nome"
                        defaultValue={c.nome}
                        required
                        maxLength={60}
                        autoFocus
                        className={`${campo} flex-1 sm:max-w-xs`}
                      />
                      <button
                        type="submit"
                        disabled={ocupado === c.id}
                        className={botao.primario}
                      >
                        {ocupado === c.id ? (
                          <Carregando tamanho="inline" rotulo="Salvando" />
                        ) : (
                          "Salvar"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className={botao.fantasma}
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/extrato?categoria=${c.id}`}
                        className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
                      >
                        {c.nome}
                      </Link>
                      <span className="valor-monetario text-xs text-texto-suave">
                        {uso[c.id] ?? 0} no mês
                        {!c.entraNoResultado && " · fora do resultado"}
                      </span>
                      <span className="flex">
                        <button
                          type="button"
                          onClick={() => setEditando(c.id)}
                          className={botao.fantasma}
                          aria-label={`Renomear ${c.nome}`}
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            mudar(
                              c,
                              { arquivada: true },
                              `${c.nome} arquivada. As transações antigas continuam com ela.`,
                            )
                          }
                          disabled={ocupado === c.id}
                          className={botao.fantasma}
                          aria-label={`Arquivar ${c.nome}`}
                        >
                          {ocupado === c.id ? (
                            <Carregando tamanho="inline" rotulo="Arquivando" />
                          ) : (
                            "Arquivar"
                          )}
                        </button>
                      </span>
                    </div>
                  )}
                  {erroDaLinha?.id === c.id && (
                    <p className={mensagemDeErro} role="alert">
                      {erroDaLinha.texto}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {arquivadas.length > 0 && (
        <details className="text-sm">
          <summary className="inline-flex h-11 cursor-pointer items-center text-texto-suave">
            Arquivadas ({arquivadas.length})
          </summary>
          <ul className="divide-y divide-borda">
            {arquivadas.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="text-texto-suave">{c.nome}</span>
                <button
                  type="button"
                  onClick={() =>
                    mudar(
                      c,
                      { arquivada: false },
                      `${c.nome} voltou para as opções.`,
                    )
                  }
                  disabled={ocupado === c.id}
                  className={botao.fantasma}
                  aria-label={`Desarquivar ${c.nome}`}
                >
                  Desarquivar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
