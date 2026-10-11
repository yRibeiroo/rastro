import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { BotaoSincronizar } from "@/componentes/extrato/BotaoSincronizar";
import { FiltrosDoExtrato } from "@/componentes/extrato/FiltrosDoExtrato";
import { lerFiltros } from "@/componentes/extrato/filtros-da-url";
import { ListaDoExtrato } from "@/componentes/extrato/ListaDoExtrato";
import { botao } from "@/componentes/formulario/classes";
import { carregarCategoriasERegras, carregarCentrosDeCusto, carregarComprovantes, carregarConexoes, carregarExtrato, carregarRecursos } from "@/regras-de-negocio/interface-web";
import { corrigirCategoria, criarRegra, sincronizarAgora } from "@/regras-de-negocio/interface-web/acoes";
import { Icone } from "@/componentes/estrutura/Icone";
import { Carregando } from "@/identidade-visual/Carregando";

/** Parâmetros de texto da URL atual (sem o cursor), para montar os links de página. */
function textos(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "cursor"));
}

// ponytail: o clipe marca as transações com comprovante conciliado; anexos manuais não entram (falta uma leitura em lote no backend).
async function idsComComprovante(): Promise<string[]> {
  const conciliados = await carregarComprovantes({ situacao: "conciliado" });
  return conciliados.flatMap((c) => (c.transacaoId ? [c.transacaoId] : []));
}

export const metadata: Metadata = { title: "Extrato" };

const carregando = <Carregando contexto="sincronizando" rotulo="Carregando o extrato" className="min-h-[40vh]" />;

export default function Extrato({ searchParams }: PageProps<"/extrato">) {
  return (
    <>
      <CabecalhoDaPagina titulo="Extrato" descricao="Cada entrada e saída da conta, com quem pagou ou recebeu." />
      <Suspense fallback={carregando}>
        <ConteudoDoExtrato searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ConteudoDoExtrato({ searchParams }: Pick<PageProps<"/extrato">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const sp = await searchParams;
  const forcado = lerEstadoForcado(sp.estado);
  if (forcado === "carregando") return carregando;

  const { filtros, periodo, valores, ativos } = lerFiltros(sp);
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [conexoes, { openFinance }, pagina, { categorias }, centros, anexos] = await Promise.all([
      carregarConexoes(),
      carregarRecursos(),
      carregarExtrato({ ...filtros, cursor, limite: 100 }),
      carregarCategoriasERegras(),
      carregarCentrosDeCusto({ incluirArquivados: true }),
      idsComComprovante(),
    ]);
    dados = { conexoes, openFinance, pagina, categorias, centros, anexos };
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível carregar o extrato"
        mensagem="Suas transações estão salvas. Tente de novo em instantes."
        acao={
          <Link href="/extrato" className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const { conexoes, openFinance, pagina, categorias, centros, anexos } = dados;
  const conexao = conexoes.find((c) => (openFinance ? c.provedor === "pluggy" : c.provedor !== "pluggy"));
  if (forcado === "vazio" || !conexao)
    return openFinance ? (
      <Vazio
        titulo="Nenhum banco conectado ainda"
        descricao="Conecte a conta do Sicredi e as transações chegam aqui sozinhas, já categorizadas."
        acao={
          <Link href="/conexoes-bancarias" className={botao.primario}>
            Conectar banco
          </Link>
        }
      />
    ) : (
      <Vazio
        titulo="Nenhum extrato importado ainda"
        descricao="Exporte o extrato em OFX no Internet Banking do Sicredi e envie aqui. As transações entram já categorizadas."
        acao={
          <Link href="/importar" className={botao.primario}>
            Importar extrato
          </Link>
        }
      />
    );

  const proxima = pagina.proximoCursor ? new URLSearchParams({ ...textos(sp), cursor: pagina.proximoCursor }).toString() : null;
  return (
    <div className="grid gap-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-texto-suave">
          <span className="valor-monetario font-medium text-texto">{pagina.itens.length}</span>{" "}
          {pagina.itens.length === 1 ? "transação" : "transações"}
        </p>
        {openFinance ? (
          <BotaoSincronizar conexaoId={conexao.id} banco={conexao.banco} sincronizar={sincronizarAgora} />
        ) : (
          <Link href="/importar" className={botao.secundario}>
            <Icone nome="importar" className="size-4" />
            Importar extrato
          </Link>
        )}
      </div>
      <FiltrosDoExtrato periodo={periodo} valores={valores} ativos={ativos} categorias={categorias} centros={centros} />
      {pagina.itens.length === 0 ? (
        <Vazio
          titulo="Nenhuma transação com esses filtros"
          descricao="Tente outro período ou tire algum filtro."
          acao={
            <Link href="/extrato" className={botao.secundario}>
              Limpar filtros
            </Link>
          }
        />
      ) : (
        <ListaDoExtrato
          transacoes={pagina.itens}
          categorias={categorias}
          centros={centros}
          idsComAnexo={anexos}
          corrigirCategoria={corrigirCategoria}
          criarRegra={criarRegra}
        />
      )}
      {(cursor || proxima) && (
        <nav aria-label="Páginas do extrato" className="flex flex-wrap gap-3">
          {cursor && (
            <Link href={`/extrato?${new URLSearchParams(textos(sp))}`} className={botao.fantasma}>
              Voltar ao início
            </Link>
          )}
          {proxima && (
            <Link href={`/extrato?${proxima}`} className={botao.secundario}>
              Transações mais antigas
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
