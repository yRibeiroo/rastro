import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  FILTRO_SEM_TRANSACAO,
  filtrosDaLeitura,
  lerFiltroDaLista,
  SITUACOES,
  type FiltroDaLista,
} from "@/componentes/comprovantes/comprovante";
import { EnviarComprovante } from "@/componentes/comprovantes/EnviarComprovante";
import {
  ListaDeComprovantes,
  type Candidato,
  type ComprovanteNaLista,
} from "@/componentes/comprovantes/ListaDeComprovantes";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao } from "@/componentes/formulario/classes";
import { Carregando } from "@/identidade-visual/Carregando";
import type { Id } from "@/regras-de-negocio";
import {
  carregarCandidatosParaConciliacao,
  carregarComprovantes,
  carregarRecursos,
} from "@/regras-de-negocio/interface-web";
import {
  conciliarComprovante,
  corrigirComprovante,
  desfazerConciliacao,
  enviarComprovante,
  gerarLinkTemporario,
  lerComprovanteDeNovo,
  removerComprovante,
} from "@/regras-de-negocio/interface-web/acoes";

export const metadata: Metadata = { title: "Comprovantes" };

const carregando = (
  <Carregando
    contexto="categorizando"
    rotulo="Carregando os comprovantes"
    className="min-h-[30vh]"
  />
);

export default function Comprovantes({
  searchParams,
}: PageProps<"/comprovantes">) {
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

/** Filtro em links (?situacao= ou ?alerta=): funciona sem JavaScript e o endereço guarda a escolha. */
function Filtros({ atual }: { atual: FiltroDaLista }) {
  const opcoes: { href: string; nome: string; ativo: boolean }[] = [
    { href: "/comprovantes", nome: "Todos", ativo: atual.tipo === "todos" },
    ...Object.entries(SITUACOES).map(([valor, nome]) => ({
      href: `/comprovantes?situacao=${valor}`,
      nome,
      ativo: atual.tipo === "situacao" && atual.situacao === valor,
    })),
    {
      href: `/comprovantes?alerta=${FILTRO_SEM_TRANSACAO}`,
      nome: "Sem transação",
      ativo: atual.tipo === "sem_transacao",
    },
  ];
  return (
    <nav aria-label="Filtrar comprovantes">
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-g border border-borda bg-superficie p-1">
        {opcoes.map(({ href, nome, ativo }) => (
          <li key={nome}>
            <Link
              href={href}
              scroll={false}
              aria-current={ativo ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-full px-3 text-sm transition-colors duration-[180ms] ${
                ativo
                  ? "bg-primaria-suave font-semibold text-texto"
                  : "text-texto-suave hover:text-texto"
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

/** RF-42: o que fazer com um comprovante sem transação no extrato. */
function ExplicacaoDoAlerta() {
  return (
    <div className="flex gap-3 rounded-m bg-alerta-suave px-4 py-3 text-sm">
      <Icone nome="atencao" className="mt-0.5 size-4 text-alerta" />
      <p>
        <strong className="font-semibold text-alerta">
          Comprovantes sem transação no extrato.
        </strong>{" "}
        O extrato que cobre a data deles foi importado há mais de 10 dias e o
        pagamento não apareceu. Importe o extrato daquele período ou ligue cada
        um à transação certa. Se o pagamento saiu de outra conta, remova o
        comprovante.{" "}
        <Link
          href="/importar"
          className="font-medium whitespace-nowrap text-primaria-texto underline underline-offset-4"
        >
          Importar extrato
        </Link>
      </p>
    </div>
  );
}

async function Conteudo({
  searchParams,
}: Pick<PageProps<"/comprovantes">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const sp = await searchParams;
  const forcado = lerEstadoForcado(sp.estado);
  const filtro = lerFiltroDaLista(sp);
  if (forcado === "carregando") return carregando;

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [comprovantes, { comprovantesIa }] = await Promise.all([
      forcado === "vazio" ? [] : carregarComprovantes(filtrosDaLeitura(filtro)),
      carregarRecursos(),
    ]);
    // Ambíguos e sem transação no extrato: o usuário escolhe a transação à mão.
    const aEscolher = comprovantes.filter(
      (c) => c.situacao === "ambiguo" || c.alerta,
    );
    const listas = await Promise.all(
      aEscolher.map((c) => carregarCandidatosParaConciliacao(c.id)),
    );
    const candidatos: Record<Id, Candidato[]> = Object.fromEntries(
      aEscolher.map((c, i) => [c.id, listas[i]]),
    );
    dados = { comprovantes, candidatos, comprovantesIa };
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

  const { comprovantes, candidatos, comprovantesIa } = dados;
  const lista: ComprovanteNaLista[] = comprovantes.map((c) => ({
    ...c,
    anexoId: "anexoId" in c ? (c.anexoId as Id | null) : null,
  }));

  return (
    <div className="grid gap-4">
      <Filtros atual={filtro} />
      {filtro.tipo === "sem_transacao" && lista.length > 0 && (
        <ExplicacaoDoAlerta />
      )}
      {lista.length === 0 ? (
        filtro.tipo === "sem_transacao" ? (
          <Vazio
            trilha={false}
            titulo="Nenhum comprovante sem transação no extrato"
            descricao="Se um pagamento não aparecer no extrato até 10 dias depois da importação que cobre a data dele, o comprovante aparece aqui."
            acao={
              <Link href="/comprovantes" className={botao.secundario}>
                Ver todos
              </Link>
            }
          />
        ) : filtro.tipo === "situacao" ? (
          <Vazio
            trilha={false}
            titulo={`Nenhum comprovante em "${SITUACOES[filtro.situacao]}"`}
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
          lerComprovanteDeNovo={
            comprovantesIa ? lerComprovanteDeNovo : undefined
          }
        />
      )}
    </div>
  );
}
