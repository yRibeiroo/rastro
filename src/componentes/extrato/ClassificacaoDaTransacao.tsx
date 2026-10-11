"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { rotulo } from "@/componentes/formulario/classes";
import type {
  Categoria,
  CentroDeCusto,
  Id,
  SugestaoDeRegra,
  Transacao,
} from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";
import { deixarRastro } from "@/identidade-visual/rastro-movimento";
import type { CorrigirCategoria } from "./ListaDoExtrato";
import { OfertaDeRegra, type CriarRegra } from "./OfertaDeRegra";
import {
  OrigemDaCategoriaTexto,
  SeletorDeCategoria,
  SeletorDeCentro,
} from "./Seletores";

type Props = {
  transacao: Transacao;
  categorias: Categoria[];
  centros: CentroDeCusto[];
  /** Id do elemento do valor (origem do rastro). */
  idDoValor: string;
  categorizando: boolean;
  corrigirCategoria: CorrigirCategoria;
  criarRegra: CriarRegra;
};

/** Categoria e centro de custo no detalhe (RF-21, RF-23). */
export function ClassificacaoDaTransacao({
  transacao: t,
  categorias,
  centros,
  idDoValor,
  categorizando,
  corrigirCategoria,
  criarRegra,
}: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [categoriaId, setCategoriaId] = useState(t.categoriaId);
  const [centroId, setCentroId] = useState(t.centroDeCustoId);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);
  const [oferta, setOferta] = useState<SugestaoDeRegra | null>(null);
  const chip = useRef<HTMLSelectElement>(null);

  async function salvar(
    dados: { categoriaId: Id | null; centroDeCustoId: Id | null },
    rastro: boolean,
  ) {
    const anterior = { categoriaId, centroId };
    setCategoriaId(dados.categoriaId);
    setCentroId(dados.centroDeCustoId);
    setSalvando(true);
    setMensagem(null);
    setOferta(null);
    const origem = document.getElementById(idDoValor);
    const [r] = await Promise.all([
      corrigirCategoria(t.id, dados),
      rastro && origem && chip.current
        ? deixarRastro(origem, chip.current)
        : null,
    ]);
    setSalvando(false);
    if (!r.ok) {
      setCategoriaId(anterior.categoriaId);
      setCentroId(anterior.centroId);
      return setMensagem({ ok: false, texto: "Não salvou. Tente de novo." });
    }
    setMensagem({ ok: true, texto: "Classificação salva." });
    setOferta(r.dados.sugestaoDeRegra);
    iniciar(() => router.refresh());
  }

  const nome =
    categorias.find((c) => c.id === oferta?.categoriaId)?.nome ??
    "esta categoria";

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <span className={rotulo} id="rotulo-categoria">
            Categoria
          </span>
          <SeletorDeCategoria
            ref={chip}
            categorias={categorias}
            valor={categoriaId}
            sentido={t.valorCentavos >= 0 ? "entrada" : "saida"}
            rotulo="Categoria"
            desabilitado={salvando}
            aoMudar={(id) =>
              salvar({ categoriaId: id, centroDeCustoId: centroId }, true)
            }
            className="w-full"
          />
          {categorizando && categoriaId === null ? (
            <Carregando
              contexto="categorizando"
              tamanho="inline"
              rotulo="A IA está categorizando esta transação"
            />
          ) : (
            categoriaId === t.categoriaId && (
              <OrigemDaCategoriaTexto
                origem={t.categoriaOrigem}
                confianca={t.confiancaIa}
              />
            )
          )}
        </div>
        <div className="grid content-start gap-1.5">
          <span className={rotulo}>Centro de custo</span>
          <SeletorDeCentro
            centros={centros}
            valor={centroId}
            rotulo="Centro de custo"
            desabilitado={salvando}
            aoMudar={(id) =>
              salvar({ categoriaId, centroDeCustoId: id }, false)
            }
            className="w-full"
          />
        </div>
      </div>
      <Anuncio className="text-sm empty:hidden">
        {salvando ? (
          <Carregando contexto="generico" tamanho="inline" rotulo="Salvando" />
        ) : mensagem?.ok ? (
          <Sucesso>{mensagem.texto}</Sucesso>
        ) : mensagem ? (
          <span className="text-erro">{mensagem.texto}</span>
        ) : null}
      </Anuncio>
      {oferta && (
        <OfertaDeRegra
          sugestao={oferta}
          nomeDaCategoria={nome}
          criarRegra={criarRegra}
          aoTerminar={(m) => {
            setOferta(null);
            if (m) {
              setMensagem({ ok: true, texto: m });
              iniciar(() => router.refresh());
            }
          }}
        />
      )}
    </div>
  );
}
