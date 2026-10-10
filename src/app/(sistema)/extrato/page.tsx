import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { BotaoSincronizar } from "@/componentes/extrato/BotaoSincronizar";
import { FiltrosDoExtrato } from "@/componentes/extrato/FiltrosDoExtrato";
import { lerFiltros } from "@/componentes/extrato/filtros-da-url";
import { ListaDoExtrato } from "@/componentes/extrato/ListaDoExtrato";
import { botao } from "@/componentes/formulario/classes";
import { corrigirCategoria, criarRegra, sincronizarAgora } from "@/componentes/prototipo/acoes-simuladas";
import { idsComAnexo, listarCategorias, listarCentrosDeCusto, listarConexoes, listarTransacoes } from "@/componentes/prototipo/fonte-de-dados";
import { Carregando } from "@/identidade-visual/Carregando";

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
  const sp = await searchParams;
  const forcado = lerEstadoForcado(sp.estado);
  if (forcado === "carregando") return carregando;

  const { filtros, periodo, valores, ativos } = lerFiltros(sp);

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [conexoes, pagina, categorias, centros, anexos] = await Promise.all([
      listarConexoes(),
      listarTransacoes(filtros),
      listarCategorias({ incluirArquivadas: true }),
      listarCentrosDeCusto({ incluirArquivados: true }),
      idsComAnexo(),
    ]);
    dados = { conexoes, pagina, categorias, centros, anexos };
  } catch {
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

  const { conexoes, pagina, categorias, centros, anexos } = dados;
  if (forcado === "vazio" || conexoes.length === 0)
    return (
      <Vazio
        titulo="Nenhum banco conectado ainda"
        descricao="Conecte a conta do Sicredi e as transações chegam aqui sozinhas, já categorizadas."
        acao={
          <Link href="/conexoes-bancarias" className={botao.primario}>
            Conectar banco
          </Link>
        }
      />
    );

  const conexao = conexoes[0];
  return (
    <div className="grid gap-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-texto-suave">
          <span className="valor-monetario font-medium text-texto">{pagina.itens.length}</span>{" "}
          {pagina.itens.length === 1 ? "transação" : "transações"}
        </p>
        <BotaoSincronizar conexaoId={conexao.id} banco={conexao.banco} sincronizar={sincronizarAgora} />
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
    </div>
  );
}
