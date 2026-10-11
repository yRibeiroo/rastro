import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao } from "@/componentes/formulario/classes";
import { textoDaSituacaoDoExtrato } from "@/componentes/importacao/extrato";
import { ImportarExtrato } from "@/componentes/importacao/ImportarExtrato";
import {
  formatarData,
  formatarDataHora,
} from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import type {
  ImportacaoDeExtrato,
  SituacaoDoExtrato,
} from "@/regras-de-negocio";
import {
  carregarImportacoes,
  carregarSituacaoDoExtrato,
} from "@/regras-de-negocio/interface-web";
import { importarExtrato } from "@/regras-de-negocio/interface-web/acoes";

export const metadata: Metadata = { title: "Importar extrato" };

const carregando = (
  <Carregando
    contexto="sincronizando"
    rotulo="Carregando as importações"
    className="min-h-[30vh]"
  />
);

export default function Importar({ searchParams }: PageProps<"/importar">) {
  return (
    <>
      <CabecalhoDaPagina
        titulo="Importar extrato"
        descricao="Envie o arquivo OFX do Sicredi. Reenviar o mesmo período atualiza sem duplicar."
      />
      <div className="grid gap-12 pb-8 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div className="grid content-start gap-10">
          <ImportarExtrato importarExtrato={importarExtrato} />
          <section aria-labelledby="historico" className="grid gap-3">
            <h2 id="historico" className="text-xl font-semibold">
              Histórico
            </h2>
            <Suspense fallback={carregando}>
              <Historico searchParams={searchParams} />
            </Suspense>
          </section>
        </div>
        <ComoExportar />
      </div>
    </>
  );
}

function ComoExportar() {
  return (
    <section
      aria-labelledby="como-exportar"
      className="grid content-start gap-3 lg:sticky lg:top-8"
    >
      <h2 id="como-exportar" className="text-xl font-semibold">
        Como exportar do Sicredi
      </h2>
      <ol className="grid list-decimal gap-2 pl-5 text-sm marker:text-texto-suave">
        <li>
          Entre no Internet Banking Sicredi da empresa (PJ), no computador.
        </li>
        <li>Abra Conta corrente e depois Extrato.</li>
        <li>
          Escolha o período. Pode repetir dias já importados: nada se duplica.
        </li>
        <li>
          Em Exportar, escolha o formato{" "}
          <strong className="font-semibold">OFX</strong> e salve o arquivo.
        </li>
        <li>Envie o arquivo aqui. Uma vez por semana basta.</li>
      </ol>
      <p className="text-xs text-texto-suave">
        O Rastro só lê o arquivo. Ele não acessa o banco nem movimenta dinheiro.
      </p>
    </section>
  );
}

async function Historico({
  searchParams,
}: Pick<PageProps<"/importar">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const forcado = lerEstadoForcado((await searchParams).estado);
  if (forcado === "carregando") return carregando;

  let importacoes: ImportacaoDeExtrato[];
  let situacao: SituacaoDoExtrato;
  try {
    if (forcado === "erro") throw new Error("forçado");
    [importacoes, situacao] =
      forcado === "vazio"
        ? [
            [],
            {
              ultimaImportacaoEm: null,
              diasDesdeAUltima: null,
              desatualizado: false,
            },
          ]
        : await Promise.all([
            carregarImportacoes(),
            carregarSituacaoDoExtrato(),
          ]);
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível carregar o histórico"
        mensagem="As importações feitas continuam salvas. Tente de novo em instantes."
        acao={
          <Link href="/importar" className={botao.secundario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const linha = (
    <p
      className={`flex items-center gap-2 text-sm ${situacao.desatualizado ? "font-medium text-alerta" : "text-texto-suave"}`}
    >
      {situacao.desatualizado && <Icone nome="atencao" className="size-4" />}
      <span>
        {textoDaSituacaoDoExtrato(situacao)}
        {situacao.desatualizado && ". Importe o extrato desta semana."}
      </span>
    </p>
  );

  if (importacoes.length === 0)
    return (
      <div className="grid gap-3">
        {linha}
        <Vazio
          titulo="Nenhuma importação ainda"
          descricao="Depois do primeiro arquivo, cada envio aparece aqui com o período e o que mudou."
        />
      </div>
    );

  return (
    <div className="grid gap-3">
      {linha}
      <ul className="divide-y divide-borda rounded-m border border-borda bg-superficie">
        {importacoes.map((i) => (
          <Linha key={i.id} importacao={i} />
        ))}
      </ul>
    </div>
  );
}

function Linha({ importacao: i }: { importacao: ImportacaoDeExtrato }) {
  return (
    <li className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
      <div className="grid min-w-0 gap-0.5">
        <span className="font-medium">
          {formatarData(i.periodo.de)} a {formatarData(i.periodo.ate)}
        </span>
        <span className="truncate text-xs text-texto-suave">
          {i.nomeDoArquivo} · {formatarDataHora(i.criadaEm)}
        </span>
      </div>
      <span className="valor-monetario text-texto-suave">
        {i.novas} {i.novas === 1 ? "nova" : "novas"}, {i.atualizadas}{" "}
        {i.atualizadas === 1 ? "atualizada" : "atualizadas"}
      </span>
    </li>
  );
}
