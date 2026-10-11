import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { lerSituacao, SITUACOES } from "@/componentes/comprovantes/comprovante";
import { EnviarComprovante } from "@/componentes/comprovantes/EnviarComprovante";
import { ListaDeComprovantes, type Candidato, type ComprovanteNaLista } from "@/componentes/comprovantes/ListaDeComprovantes";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { botao } from "@/componentes/formulario/classes";
import { Carregando } from "@/identidade-visual/Carregando";
import type { Id } from "@/regras-de-negocio";
import { carregarCandidatosParaConciliacao, carregarComprovantes } from "@/regras-de-negocio/interface-web";
import {
  conciliarComprovante,
  corrigirComprovante,
  desfazerConciliacao,
  enviarComprovante,
  gerarLinkTemporario,
  removerComprovante,
} from "@/regras-de-negocio/interface-web/acoes";

export const metadata: Metadata = { title: "Comprovantes" };

const carregando = <Carregando contexto="categorizando" rotulo="Carregando os comprovantes" className="min-h-[30vh]" />;

export default function Comprovantes({ searchParams }: PageProps<"/comprovantes">) {
  return (
    <>
      <CabecalhoDaPagina
        titulo="Comprovantes"
        descricao="Fotografe o Pix, o boleto ou a nota. O Rastro lê os dados e liga cada um à transação do extrato."
      />
      <div className="grid gap-10 pb-8">
        <EnviarComprovante enviarComprovante={enviarComprovante} />
        <section aria-labelledby="lista" className="grid gap-4">
          <h2 id="lista" className="sr-only">
            Comprovantes enviados
          </h2>
          <Suspense fallback={carregando}>
            <Conteudo searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
    </>
  );
}

/** Filtro por situação em links (?situacao=): funciona sem JavaScript e o endereço guarda a escolha. */
function Filtros({ atual }: { atual: string | null }) {
  const opcoes: [string | null, string][] = [[null, "Todos"], ...Object.entries(SITUACOES)];
  return (
    <nav aria-label="Situação">
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-g border border-borda bg-superficie p-1">
        {opcoes.map(([valor, nome]) => (
          <li key={nome}>
            <Link
              href={valor ? `/comprovantes?situacao=${valor}` : "/comprovantes"}
              scroll={false}
              aria-current={valor === atual ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-full px-3 text-sm transition-colors duration-[180ms] ${
                valor === atual ? "bg-primaria-suave font-semibold text-texto" : "text-texto-suave hover:text-texto"
              }`}
            >
              {nome}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/comprovantes">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const sp = await searchParams;
  const forcado = lerEstadoForcado(sp.estado);
  const situacao = lerSituacao(sp.situacao);
  if (forcado === "carregando") return carregando;

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const comprovantes = forcado === "vazio" ? [] : await carregarComprovantes(situacao ? { situacao } : undefined);
    const ambiguos = comprovantes.filter((c) => c.situacao === "ambiguo");
    const listas = await Promise.all(ambiguos.map((c) => carregarCandidatosParaConciliacao(c.id)));
    const candidatos: Record<Id, Candidato[]> = Object.fromEntries(ambiguos.map((c, i) => [c.id, listas[i]]));
    dados = { comprovantes, candidatos };
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível carregar os comprovantes"
        mensagem="Os arquivos enviados continuam salvos. Tente de novo em instantes."
        acao={
          <Link href="/comprovantes" className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const { comprovantes, candidatos } = dados;
  const lista: ComprovanteNaLista[] = comprovantes.map((c) => ({ ...c, anexoId: "anexoId" in c ? (c.anexoId as Id | null) : null }));

  return (
    <div className="grid gap-4">
      <Filtros atual={situacao} />
      {lista.length === 0 ? (
        situacao ? (
          <Vazio
            trilha={false}
            titulo={`Nenhum comprovante em "${SITUACOES[situacao]}"`}
            acao={
              <Link href="/comprovantes" className={botao.secundario}>
                Ver todos
              </Link>
            }
          />
        ) : (
          <Vazio
            titulo="Nenhum comprovante enviado"
            descricao="Envie a foto ou o PDF de um Pix, boleto pago, cupom ou nota. Ele fica ligado à transação do extrato, com os itens da compra."
          />
        )
      ) : (
        <ListaDeComprovantes
          comprovantes={lista}
          candidatos={candidatos}
          conciliarComprovante={conciliarComprovante}
          corrigirComprovante={corrigirComprovante}
          removerComprovante={removerComprovante}
          desfazerConciliacao={desfazerConciliacao}
          gerarLinkTemporario={gerarLinkTemporario}
        />
      )}
    </div>
  );
}
