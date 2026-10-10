import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GerenciarCategorias } from "@/componentes/categorias/GerenciarCategorias";
import { GerenciarRegras } from "@/componentes/categorias/GerenciarRegras";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { botao } from "@/componentes/formulario/classes";
import { atualizarCategoria, atualizarRegra, criarCategoria, criarRegra, removerRegra } from "@/componentes/prototipo/acoes-simuladas";
import { inicioDoMes, listarCategorias, listarCentrosDeCusto, listarRegras, listarTransacoes } from "@/componentes/prototipo/fonte-de-dados";
import { Carregando } from "@/identidade-visual/Carregando";

export const metadata: Metadata = { title: "Categorias" };

const carregando = <Carregando contexto="generico" rotulo="Carregando categorias e regras" className="min-h-[40vh]" />;

export default function Categorias({ searchParams }: PageProps<"/categorias">) {
  return (
    <>
      <CabecalhoDaPagina titulo="Categorias" descricao="Como o Rastro classifica cada transação: suas categorias e as regras que rodam antes da IA." />
      <Suspense fallback={carregando}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/categorias">, "searchParams">) {
  const forcado = lerEstadoForcado((await searchParams).estado);
  if (forcado === "carregando") return carregando;

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [categorias, centros, regras, doMes] = await Promise.all([
      listarCategorias({ incluirArquivadas: true }),
      listarCentrosDeCusto(),
      listarRegras(),
      listarTransacoes({ dataDe: inicioDoMes() }),
    ]);
    dados = { categorias, centros, regras, doMes };
  } catch {
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

  const { categorias, centros, regras, doMes } = dados;
  if (forcado === "vazio" || categorias.length === 0)
    return (
      <Vazio
        titulo="Comece com as categorias de uma empresa de serviços"
        descricao="Crie a primeira categoria abaixo. As sugestões padrão (Combustível, Material elétrico, Ferramentas, Folha, Impostos, Receita de serviços) entram quando o banco é configurado."
        acao={
          <div className="w-full max-w-xl pt-4">
            <GerenciarCategorias categorias={[]} uso={{}} criarCategoria={criarCategoria} atualizarCategoria={atualizarCategoria} />
          </div>
        }
      />
    );

  const uso: Record<string, number> = {};
  for (const t of doMes.itens) if (t.categoriaId) uso[t.categoriaId] = (uso[t.categoriaId] ?? 0) + 1;

  return (
    <div className="grid gap-14 pb-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
      <GerenciarCategorias categorias={categorias} uso={uso} criarCategoria={criarCategoria} atualizarCategoria={atualizarCategoria} />
      <GerenciarRegras
        regras={regras}
        categorias={categorias}
        centros={centros}
        criarRegra={criarRegra}
        atualizarRegra={atualizarRegra}
        removerRegra={removerRegra}
      />
    </div>
  );
}
