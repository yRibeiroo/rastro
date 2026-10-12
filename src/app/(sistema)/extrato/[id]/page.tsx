import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { Icone } from "@/componentes/estrutura/Icone";
import { Anexos } from "@/componentes/extrato/Anexos";
import { ClassificacaoDaTransacao } from "@/componentes/extrato/ClassificacaoDaTransacao";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";
import { botao } from "@/componentes/formulario/classes";
import { ComprovantesDaTransacao } from "@/componentes/comprovantes/ComprovantesDaTransacao";
import {
  carregarCategoriasERegras,
  carregarCentrosDeCusto,
  carregarComprovantes,
  carregarTransacao,
} from "@/regras-de-negocio/interface-web";
import {
  anexar,
  corrigirCategoria,
  criarRegra,
  gerarLinkTemporario,
  removerAnexo,
} from "@/regras-de-negocio/interface-web/acoes";
import {
  formatarData,
  formatarDataHora,
} from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";

export const metadata: Metadata = { title: "Transação" };

const carregando = (
  <Carregando
    contexto="generico"
    rotulo="Abrindo a transação"
    className="min-h-[40vh]"
  />
);

export default function DetalheDaTransacao({
  params,
  searchParams,
}: PageProps<"/extrato/[id]">) {
  return (
    <div className="grid gap-2 pt-4 pb-10 md:pt-8">
      <Link
        href="/extrato"
        className="inline-flex h-11 w-fit items-center gap-1 rounded-full pr-3 text-sm text-texto-suave hover:text-texto"
      >
        <Icone nome="voltar" className="size-4" />
        Extrato
      </Link>
      <Suspense fallback={carregando}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Linha({
  termo,
  children,
}: {
  termo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2.5 sm:grid-cols-[11rem_1fr]">
      <dt className="text-sm text-texto-suave">{termo}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

async function Conteudo({ params, searchParams }: PageProps<"/extrato/[id]">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const forcado = lerEstadoForcado(sp.estado);
  if (forcado === "carregando") return carregando;
  if (forcado === "vazio")
    return (
      <Vazio
        titulo="Esta transação não está mais no extrato"
        descricao="O banco pode ter cancelado ou removido o lançamento."
        acao={
          <Link href="/extrato" className={botao.primario}>
            Voltar ao extrato
          </Link>
        }
      />
    );

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [
      { transacao: t, anexos },
      { categorias, regras },
      centros,
      conciliados,
    ] = await Promise.all([
      carregarTransacao(id),
      carregarCategoriasERegras(),
      carregarCentrosDeCusto({ incluirArquivados: true }),
      carregarComprovantes({ situacao: "conciliado" }),
    ]);
    const comprovantes = conciliados.filter((c) => c.transacaoId === id);
    dados = { t, anexos, categorias, centros, regras, comprovantes };
  } catch (erro) {
    // notFound() (transação inexistente ou de outra empresa) e redirect() passam direto.
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível abrir a transação"
        mensagem="Tente de novo em instantes."
        acao={
          <Link href={`/extrato/${id}`} className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }
  const { t, anexos, categorias, centros, regras, comprovantes } = dados;

  const regra = t.regraId ? regras.find((r) => r.id === t.regraId) : null;
  const categorizando =
    sp.estado === "categorizando" ||
    (t.categoriaId === null &&
      t.categorizacaoAutomaticaEm === null &&
      !t.categoriaDefinidaPeloUsuario);

  return (
    <article className="grid gap-10">
      <header className="grid gap-3 pt-2">
        <h1 className="text-2xl font-bold break-words md:text-3xl">
          {t.descricao}
        </h1>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span id="valor-da-transacao" className="inline-block">
            <ValorMonetario
              centavos={t.valorCentavos}
              comSinal
              className="font-titulo text-3xl font-bold md:text-4xl"
            />
          </span>
          <span className="text-sm text-texto-suave">
            {t.valorCentavos >= 0 ? "Entrada" : "Saída"} em{" "}
            {formatarData(t.data)}
            {t.pendente && " · pendente no banco"}
          </span>
        </div>
      </header>

      <ClassificacaoDaTransacao
        transacao={t}
        categorias={categorias}
        centros={centros}
        idDoValor="valor-da-transacao"
        categorizando={categorizando}
        corrigirCategoria={corrigirCategoria}
        criarRegra={criarRegra}
      />

      <section aria-labelledby="detalhes" className="grid gap-2">
        <h2 id="detalhes" className="text-xl font-semibold">
          Detalhes
        </h2>
        <dl className="divide-y divide-borda">
          <Linha termo={t.valorCentavos >= 0 ? "Quem pagou" : "Quem recebeu"}>
            {t.contraparte ?? "Não informado pelo banco"}
          </Linha>
          <Linha termo="Forma">{t.metodoDePagamento ?? "Não informada"}</Linha>
          {t.descricaoOriginal && t.descricaoOriginal !== t.descricao && (
            <Linha termo="Descrição no banco">{t.descricaoOriginal}</Linha>
          )}
          {t.categoriaDoProvedor && (
            <Linha termo="Categoria do banco">{t.categoriaDoProvedor}</Linha>
          )}
          {regra && (
            <Linha termo="Regra aplicada">
              {regra.campo === "contraparte" ? "Contraparte" : "Descrição"}{" "}
              contém <code className="font-mono">{regra.padrao}</code>{" "}
              <Link
                href="/categorias#regras"
                className="text-primaria-texto underline underline-offset-4"
              >
                ver regras
              </Link>
            </Linha>
          )}
          {t.confiancaIa != null && t.categoriaOrigem === "ia" && (
            <Linha termo="Certeza da IA">
              <span className="valor-monetario">
                {Math.round(t.confiancaIa * 100)}%
              </span>
            </Linha>
          )}
          <Linha termo="Recebida em">{formatarDataHora(t.criadaEm)}</Linha>
        </dl>
      </section>

      <ComprovantesDaTransacao
        comprovantes={comprovantes}
        anexos={anexos}
        gerarLinkTemporario={gerarLinkTemporario}
      />

      <Anexos
        transacaoId={t.id}
        anexos={anexos.filter((a) => !a.comprovanteId)}
        anexar={anexar}
        gerarLinkTemporario={gerarLinkTemporario}
        removerAnexo={removerAnexo}
      />
    </article>
  );
}
