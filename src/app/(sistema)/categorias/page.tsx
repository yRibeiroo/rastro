import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GerenciarCategorias } from "@/componentes/categorias/GerenciarCategorias";
import { GerenciarRegras } from "@/componentes/categorias/GerenciarRegras";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { botao } from "@/componentes/formulario/classes";
import { hojeISO } from "@/ferramentas-internas/formatar-data";
import { BarrasDeLimite } from "@/componentes/limites/BarrasDeLimite";
import { GerenciarLimites } from "@/componentes/limites/GerenciarLimites";
import {
  carregarCategoriasERegras,
  carregarExtrato,
  carregarLimitesDeGasto,
} from "@/regras-de-negocio/interface-web";
import {
  atualizarCategoria,
  atualizarRegra,
  criarCategoria,
  criarRegra,
  definirLimiteDeGasto,
  removerLimiteDeGasto,
  removerRegra,
} from "@/regras-de-negocio/interface-web/acoes";
import { Carregando } from "@/identidade-visual/Carregando";

export const metadata: Metadata = { title: "Categorias" };

const carregando = (
  <Carregando
    contexto="generico"
    rotulo="Carregando categorias e regras"
    className="min-h-[40vh]"
  />
);

export default function Categorias({ searchParams }: PageProps<"/categorias">) {
  return (
    <>
      <CabecalhoDaPagina
        titulo="Categorias"
        descricao="Como o Rastro classifica cada transação: suas categorias e as regras que rodam antes da IA."
      />
      <Suspense fallback={carregando}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({
  searchParams,
}: Pick<PageProps<"/categorias">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const forcado = lerEstadoForcado((await searchParams).estado);
  if (forcado === "carregando") return carregando;

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    // ponytail: "uso no mês" conta só as 200 primeiras transações do mês; um agregado no backend resolve se passar disso.
    const [{ categorias, regras, centrosDeCusto: centros }, doMes, limites] =
      await Promise.all([
        carregarCategoriasERegras(),
        carregarExtrato({ dataDe: `${hojeISO().slice(0, 7)}-01`, limite: 200 }),
        carregarLimitesDeGasto(),
      ]);
    dados = { categorias, centros, regras, doMes, limites };
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível carregar as categorias"
        mensagem="Tente de novo em instantes."
        acao={
          <Link href="/categorias" className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const { categorias, centros, regras, doMes, limites } = dados;
  if (forcado === "vazio" || categorias.length === 0)
    return (
      <Vazio
        titulo="Comece criando suas categorias"
        descricao="Crie a primeira categoria abaixo. As sugestões padrão do seu perfil (pessoal ou empresa) entram quando a conta é criada."
        acao={
          <div className="w-full max-w-xl pt-4">
            <GerenciarCategorias
              categorias={[]}
              uso={{}}
              criarCategoria={criarCategoria}
              atualizarCategoria={atualizarCategoria}
            />
          </div>
        }
      />
    );

  const uso: Record<string, number> = {};
  for (const t of doMes.itens)
    if (t.categoriaId) uso[t.categoriaId] = (uso[t.categoriaId] ?? 0) + 1;

  return (
    <div className="grid gap-14 pb-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
      <GerenciarCategorias
        categorias={categorias}
        uso={uso}
        criarCategoria={criarCategoria}
        atualizarCategoria={atualizarCategoria}
      />
      <GerenciarRegras
        regras={regras}
        categorias={categorias}
        centros={centros}
        criarRegra={criarRegra}
        atualizarRegra={atualizarRegra}
        removerRegra={removerRegra}
      />
      <div className="grid gap-6 lg:col-span-2 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <GerenciarLimites
          categorias={categorias}
          limites={limites}
          definir={definirLimiteDeGasto}
          remover={removerLimiteDeGasto}
        />
        {limites.length > 0 && (
          <section
            aria-labelledby="limites-uso"
            className="grid content-start gap-4"
          >
            <h2 id="limites-uso" className="text-xl font-semibold">
              Uso neste mês
            </h2>
            <BarrasDeLimite limites={limites} />
          </section>
        )}
      </div>
    </div>
  );
}
