import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";
import { botao } from "@/componentes/formulario/classes";
import { GraficoEntradasSaidas } from "@/componentes/graficos/GraficoEntradasSaidas";
import { ParaOndeFoi } from "@/componentes/graficos/ParaOndeFoi";
import { ResultadoPorCentro } from "@/componentes/graficos/ResultadoPorCentro";
import { carregarConexoes, carregarPainel, carregarRecursos } from "@/regras-de-negocio/interface-web";
import { textoDaUltimaImportacao, ultimaImportacao } from "@/componentes/estrutura/StatusDaConexao";
import { formatarData, formatarDataHora, formatarTempoRelativo } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import { lerPeriodo, periodoDe, PERIODOS, SeletorDePeriodo } from "@/componentes/estrutura/SeletorDePeriodo";

export const metadata: Metadata = { title: "Painel" };


const carregando = <Carregando contexto="gerando-painel" className="min-h-[50vh]" />;

export default function Painel({ searchParams }: PageProps<"/painel">) {
  return (
    <>
      <CabecalhoDaPagina titulo="Painel" descricao="Quanto entrou, para onde foi e qual serviço dá lucro." />
      <Suspense fallback={carregando}>
        <ConteudoDoPainel searchParams={searchParams} />
      </Suspense>
    </>
  );
}


async function ConteudoDoPainel({ searchParams }: Pick<PageProps<"/painel">, "searchParams">) {
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
    // O gráfico mensal sempre mostra pelo menos 6 meses; o resto segue o período escolhido.
    const [conexoes, { openFinance }, resumo, historico] = await Promise.all([
      carregarConexoes(),
      carregarRecursos(),
      carregarPainel(periodo),
      carregarPainel(periodoDe(chave === "12m" ? "12m" : "6m")),
    ]);
    const daFonte = conexoes.filter((c) => (openFinance ? c.provedor === "pluggy" : c.provedor !== "pluggy"));
    dados = { conexao: daFonte[0] as (typeof daFonte)[number] | undefined, openFinance, ultima: ultimaImportacao(conexoes), resumo, historico };
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível gerar o painel"
        mensagem="Tente de novo em instantes. Se continuar, confira a conexão com o banco."
        acao={
          <Link href={`/painel?periodo=${chave}`} className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const { conexao, openFinance, ultima, resumo, historico } = dados;
  if (forcado === "vazio" || !conexao) return <SemConexao openFinance={openFinance} />;
  const entradas = resumo.fluxoMensal.reduce((s, m) => s + m.entradasCentavos, 0);
  const saidas = resumo.fluxoMensal.reduce((s, m) => s + m.saidasCentavos, 0);
  const extrato = (extra: string) => `/extrato?de=${periodo.de}&ate=${periodo.ate}${extra}`;
  const semMovimento = entradas === 0 && saidas === 0;

  return (
    <div className="grid gap-12 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SeletorDePeriodo atual={chave} caminho="/painel" />
        {openFinance ? (
          conexao.ultimaSincronizacaoEm && (
            <p className="text-sm text-texto-suave">
              {conexao.banco} · sincronizou {formatarTempoRelativo(conexao.ultimaSincronizacaoEm)}
            </p>
          )
        ) : (
          <Link href="/importar" className="text-sm text-texto-suave underline-offset-4 hover:underline">
            {textoDaUltimaImportacao(ultima)}
          </Link>
        )}
      </div>

      {/* O saldo é o texto grande; o período vem em linha, sem grade de cartões KPI. */}
      <section aria-labelledby="saldo" className="grid gap-x-12 gap-y-6 md:grid-cols-[auto_1fr] md:items-end">
        <div className="grid gap-1">
          <h2 id="saldo" className="font-sans text-sm font-medium tracking-normal text-texto-suave">
            Saldo atual
          </h2>
          <ValorMonetario centavos={resumo.saldoAtualCentavos} className="font-titulo text-4xl font-bold md:text-5xl" />
          {resumo.saldoAtualizadoEm && <p className="text-xs text-texto-suave">Saldo do extrato em {formatarDataHora(resumo.saldoAtualizadoEm)}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm md:justify-end">
          <div className="grid gap-0.5">
            <dt className="text-texto-suave">Entrou no período</dt>
            <dd className="text-lg font-semibold">
              <ValorMonetario centavos={entradas} comSinal />
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-texto-suave">Saiu</dt>
            <dd className="text-lg font-semibold">
              <ValorMonetario centavos={-saidas} comSinal />
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-texto-suave">Resultado</dt>
            <dd className="text-lg font-semibold">
              <ValorMonetario centavos={entradas - saidas} comSinal />
            </dd>
          </div>
        </dl>
      </section>

      {resumo.transacoesSemCategoria > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-m bg-alerta-suave px-4 py-3 text-sm">
          <span className="font-semibold text-alerta">
            {resumo.transacoesSemCategoria} {resumo.transacoesSemCategoria === 1 ? "transação sem categoria" : "transações sem categoria"}
          </span>
          <Link href={extrato("&categoria=nenhuma")} className="font-medium text-texto underline underline-offset-4">
            Revisar no extrato
          </Link>
        </p>
      )}

      {semMovimento ? (
        <Vazio
          titulo={`Nenhuma transação em ${PERIODOS[chave].toLowerCase()}`}
          descricao={`Período de ${formatarData(periodo.de)} a ${formatarData(periodo.ate)}. Escolha um período maior para ver o histórico.`}
          acao={
            <Link href="/painel?periodo=3m" className={botao.secundario}>
              Ver os últimos 3 meses
            </Link>
          }
        />
      ) : (
        <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <ParaOndeFoi
            gastos={resumo.gastosPorCategoria}
            hrefDaCategoria={(id) => extrato(`&sentido=saida&categoria=${id ?? "nenhuma"}`)}
          />
          <ResultadoPorCentro centros={resumo.resultadoPorCentroDeCusto} hrefSemCentro={extrato("&centro=nenhum")} />
        </div>
      )}

      <GraficoEntradasSaidas fluxo={historico.fluxoMensal} />
    </div>
  );
}

function SemConexao({ openFinance }: { openFinance: boolean }) {
  if (openFinance)
    return (
      <Vazio
        titulo="Conecte a conta do Sicredi para ver para onde vai cada real"
        descricao="A conexão é feita pelo Open Finance: o Rastro só lê o extrato, nunca movimenta dinheiro."
        acao={
          <Link href="/conexoes-bancarias" className={botao.primario}>
            Conectar banco
          </Link>
        }
      />
    );
  return (
    <Vazio
      titulo="Importe o extrato do Sicredi para ver para onde vai cada real"
      descricao="Exporte o arquivo OFX no Internet Banking e envie aqui. Reenviar o mesmo período não duplica nada."
      acao={
        <Link href="/importar" className={botao.primario}>
          Importar extrato
        </Link>
      }
    />
  );
}
