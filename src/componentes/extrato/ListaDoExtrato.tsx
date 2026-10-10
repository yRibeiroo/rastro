"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import type { Categoria, CentroDeCusto, Id, ResultadoDaAcao, SugestaoDeRegra, Transacao } from "@/componentes/prototipo/tipos-provisorios";
import { formatarDia } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import { deixarRastro } from "@/identidade-visual/rastro-movimento";
import { OfertaDeRegra, type CriarRegra } from "./OfertaDeRegra";
import { OrigemDaCategoriaTexto, SeletorDeCategoria } from "./Seletores";
import { ValorMonetario } from "./ValorMonetario";

export type CorrigirCategoria = (
  transacaoId: Id,
  dados: { categoriaId: Id | null; centroDeCustoId: Id | null },
) => Promise<ResultadoDaAcao<{ transacao: Transacao; sugestaoDeRegra: SugestaoDeRegra | null }>>;

type Props = {
  transacoes: Transacao[];
  categorias: Categoria[];
  centros: CentroDeCusto[];
  idsComAnexo: string[];
  corrigirCategoria: CorrigirCategoria;
  criarRegra: CriarRegra;
};

const aguardandoIa = (t: Transacao) => t.categoriaId === null && t.categorizacaoAutomaticaEm === null && !t.categoriaDefinidaPeloUsuario;

/** Extrato agrupado por dia (RF-16) com recategorização no próprio chip (RF-21, fluxos.md §3). */
export function ListaDoExtrato({ transacoes, categorias, centros, idsComAnexo, corrigirCategoria, criarRegra }: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const valores = useRef(new Map<string, HTMLElement>());
  const [ajustes, setAjustes] = useState<Record<string, Id | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [oferta, setOferta] = useState<{ transacaoId: string; sugestao: SugestaoDeRegra } | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const nomeDa = new Map(categorias.map((c) => [c.id, c.nome]));
  const centroDo = new Map(centros.map((c) => [c.id, c.nome]));
  const comAnexo = new Set(idsComAnexo);

  async function mudarCategoria(t: Transacao, categoriaId: Id | null, chip: HTMLSelectElement) {
    const anterior = ajustes[t.id] !== undefined ? ajustes[t.id] : t.categoriaId;
    setAjustes((a) => ({ ...a, [t.id]: categoriaId }));
    setErros((e) => ({ ...e, [t.id]: "" }));
    setOferta(null);
    setMensagem(null);
    setSalvando(t.id);
    const origem = valores.current.get(t.id);
    // Visual e dado em paralelo: o rastro (700 ms) não atrasa o salvamento.
    const [r] = await Promise.all([
      corrigirCategoria(t.id, { categoriaId, centroDeCustoId: t.centroDeCustoId }),
      origem ? deixarRastro(origem, chip) : null,
    ]);
    setSalvando(null);
    if (!r.ok) {
      setAjustes((a) => ({ ...a, [t.id]: anterior }));
      setErros((e) => ({ ...e, [t.id]: "Não salvou. Tente de novo." }));
      return;
    }
    setMensagem(categoriaId ? `Transação movida para ${nomeDa.get(categoriaId)}.` : "Transação ficou sem categoria.");
    if (r.dados.sugestaoDeRegra) setOferta({ transacaoId: t.id, sugestao: r.dados.sugestaoDeRegra });
    iniciar(() => router.refresh());
  }

  const dias = new Map<string, Transacao[]>();
  for (const t of transacoes) dias.set(t.data, [...(dias.get(t.data) ?? []), t]);

  return (
    <div className="grid gap-8">
      <Anuncio className="empty:hidden">{mensagem && <Sucesso>{mensagem}</Sucesso>}</Anuncio>
      {[...dias].map(([dia, itens]) => {
        const subtotal = itens.filter((t) => !t.pendente).reduce((s, t) => s + t.valorCentavos, 0);
        return (
          <section key={dia} aria-labelledby={`dia-${dia}`}>
            <div className="sticky top-0 z-10 -mx-4 flex items-baseline justify-between gap-4 border-b border-borda bg-fundo/95 px-4 py-2 backdrop-blur md:mx-0 md:px-0">
              <h2 id={`dia-${dia}`} className="font-sans text-sm font-semibold tracking-normal first-letter:uppercase">
                {formatarDia(dia)}
              </h2>
              <ValorMonetario centavos={subtotal} comSinal className="text-sm font-medium" />
            </div>
            <ul className="divide-y divide-borda">
              {itens.map((t) => {
                const categoriaId = ajustes[t.id] !== undefined ? ajustes[t.id] : t.categoriaId;
                const ofertaAqui = oferta?.transacaoId === t.id ? oferta.sugestao : null;
                return (
                  <Fragment key={t.id}>
                    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_14rem_9rem] md:items-center">
                      <div className="grid min-w-0 gap-0.5">
                        <Link href={`/extrato/${t.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                          {t.descricao}
                        </Link>
                        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-texto-suave">
                          {t.contraparte && <span className="truncate">{t.contraparte}</span>}
                          {t.metodoDePagamento && <span>{t.metodoDePagamento}</span>}
                          {t.centroDeCustoId && <span>{centroDo.get(t.centroDeCustoId)}</span>}
                          {t.pendente && <span className="rounded-full bg-alerta-suave px-2 font-medium text-alerta">pendente no banco</span>}
                          {comAnexo.has(t.id) && (
                            <span className="inline-flex items-center gap-0.5">
                              <Icone nome="clipe" className="size-3.5" />
                              <span className="sr-only">com anexo</span>
                            </span>
                          )}
                        </p>
                      </div>
                      <ValorMonetario
                        ref={(el) => {
                          if (el) valores.current.set(t.id, el);
                        }}
                        centavos={t.valorCentavos}
                        comSinal
                        className="justify-self-end text-right font-semibold md:order-last"
                      />
                      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 md:col-span-1">
                        <SeletorDeCategoria
                          categorias={categorias}
                          valor={categoriaId}
                          sentido={t.valorCentavos >= 0 ? "entrada" : "saida"}
                          rotulo={`Categoria de ${t.descricao}`}
                          desabilitado={salvando === t.id}
                          aoMudar={(id, el) => mudarCategoria(t, id, el)}
                          className="md:w-full"
                        />
                        {salvando === t.id ? (
                          <Carregando contexto="generico" tamanho="inline" rotulo="Salvando" />
                        ) : erros[t.id] ? (
                          <span className="text-xs text-erro" role="alert">
                            {erros[t.id]}
                          </span>
                        ) : aguardandoIa(t) ? (
                          <Carregando contexto="categorizando" tamanho="inline" rotulo="Categorizando" />
                        ) : (
                          categoriaId === t.categoriaId && <OrigemDaCategoriaTexto origem={t.categoriaOrigem} confianca={t.confiancaIa} />
                        )}
                      </div>
                    </li>
                    {ofertaAqui && (
                      <li className="pb-4">
                        <OfertaDeRegra
                          sugestao={ofertaAqui}
                          nomeDaCategoria={nomeDa.get(ofertaAqui.categoriaId) ?? "esta categoria"}
                          criarRegra={criarRegra}
                          aoTerminar={(m) => {
                            setOferta(null);
                            if (m) {
                              setMensagem(m);
                              iniciar(() => router.refresh());
                            }
                          }}
                        />
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
