import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  AcoesDoCentro,
  DesarquivarCentro,
  NovoCentro,
} from "@/componentes/centros-de-custo/GerenciarCentros";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { botao } from "@/componentes/formulario/classes";
import { ResultadoPorCentro } from "@/componentes/graficos/ResultadoPorCentro";
import {
  carregarCentrosDeCusto,
  carregarPainel,
} from "@/regras-de-negocio/interface-web";
import {
  atualizarCentroDeCusto,
  criarCentroDeCusto,
} from "@/regras-de-negocio/interface-web/acoes";
import { Carregando } from "@/identidade-visual/Carregando";
import {
  lerPeriodo,
  periodoDe,
  PERIODOS,
  SeletorDePeriodo,
} from "@/componentes/estrutura/SeletorDePeriodo";

export const metadata: Metadata = { title: "Centros de custo" };

const carregando = (
  <Carregando
    contexto="generico"
    rotulo="Calculando o resultado por serviço"
    className="min-h-[40vh]"
  />
);

export default function CentrosDeCusto({
  searchParams,
}: PageProps<"/centros-de-custo">) {
  return (
    <>
      <CabecalhoDaPagina
        titulo="Centros de custo"
        descricao="Separe entradas e saídas por serviço para saber qual dá lucro."
      />
      <Suspense fallback={carregando}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({
  searchParams,
}: Pick<PageProps<"/centros-de-custo">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const sp = await searchParams;
  const forcado = lerEstadoForcado(sp.estado);
  if (forcado === "carregando") return carregando;
  const chave = lerPeriodo(sp.periodo);
  const periodo = periodoDe(chave);

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [centros, resumo] = await Promise.all([
      carregarCentrosDeCusto({ incluirArquivados: true }),
      carregarPainel(periodo),
    ]);
    dados = { centros, resumo };
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível carregar os centros de custo"
        mensagem="Tente de novo em instantes."
        acao={
          <Link href="/centros-de-custo" className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const { centros, resumo } = dados;
  const ativos = centros.filter((c) => !c.arquivado);
  const arquivados = centros.filter((c) => c.arquivado);

  if (forcado === "vazio" || ativos.length === 0)
    return (
      <div className="grid gap-6">
        <Vazio
          titulo="Nenhum centro de custo ainda"
          descricao="Crie um centro para cada serviço (ar-condicionado, elétrica, prevenção contra incêndio) e um para o administrativo."
        />
        <div className="max-w-xl">
          <NovoCentro criar={criarCentroDeCusto} />
        </div>
      </div>
    );

  const porId = new Map(centros.map((c) => [c.id, c]));

  return (
    <div className="grid gap-12 pb-8">
      <SeletorDePeriodo atual={chave} caminho="/centros-de-custo" />

      <ResultadoPorCentro
        titulo={`Resultado: ${PERIODOS[chave].toLowerCase()}`}
        centros={resumo.resultadoPorCentroDeCusto}
        hrefSemCentro={`/extrato?de=${periodo.de}&ate=${periodo.ate}&centro=nenhum`}
        acoes={(c) => {
          const centro = c.centroDeCustoId
            ? porId.get(c.centroDeCustoId)
            : null;
          return centro ? (
            <AcoesDoCentro centro={centro} atualizar={atualizarCentroDeCusto} />
          ) : null;
        }}
      />

      <div className="grid max-w-xl gap-6">
        <NovoCentro criar={criarCentroDeCusto} />
        {arquivados.length > 0 && (
          <details className="text-sm">
            <summary className="inline-flex h-11 cursor-pointer items-center text-texto-suave">
              Arquivados ({arquivados.length})
            </summary>
            <ul className="divide-y divide-borda">
              {arquivados.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-texto-suave">{c.nome}</span>
                  <DesarquivarCentro
                    centro={c}
                    atualizar={atualizarCentroDeCusto}
                  />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
