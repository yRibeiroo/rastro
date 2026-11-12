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
import { GraficoSaldo } from "@/componentes/graficos/GraficoSaldo";
import { ParaOndeFoi } from "@/componentes/graficos/ParaOndeFoi";
import { ResultadoPorCentro } from "@/componentes/graficos/ResultadoPorCentro";
import { BarrasDeLimite } from "@/componentes/limites/BarrasDeLimite";
import {
  carregarConexoes,
  carregarLimitesDeGasto,
  carregarPainel,
  carregarPrevisao,
  carregarSaldoPorMes,
  carregarRecursos,
  carregarSituacaoDoExtrato,
  contarAlertas,
} from "@/regras-de-negocio/interface-web";
import { FILTRO_SEM_TRANSACAO } from "@/componentes/comprovantes/comprovante";
import { Icone } from "@/componentes/estrutura/Icone";
import { textoDaSituacaoDoExtrato } from "@/componentes/importacao/extrato";
import {
  formatarData,
  formatarDataHora,
  formatarTempoRelativo,
  hojeISO,
} from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import {
  lerPeriodo,
  periodoDe,
  PERIODOS,
  SeletorDePeriodo,
} from "@/componentes/estrutura/SeletorDePeriodo";

export const metadata: Metadata = { title: "Painel" };

const carregando = (
  <Carregando contexto="gerando-painel" className="min-h-[50vh]" />
);

export default function Painel({ searchParams }: PageProps<"/painel">) {
  return (
    <>
      <CabecalhoDaPagina
        titulo="Painel"
        descricao="Quanto entrou, para onde foi e o que sobrou."
      />
      <Suspense fallback={carregando}>
        <ConteudoDoPainel searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ConteudoDoPainel({
  searchParams,
}: Pick<PageProps<"/painel">, "searchParams">) {
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
    const [
      conexoes,
      { openFinance },
      resumo,
      historico,
      situacao,
      alertas,
      previsto,
      limites,
      saldos,
    ] = await Promise.all([
      carregarConexoes(),
      carregarRecursos(),
      carregarPainel(periodo),
      carregarPainel(periodoDe(chave === "12m" ? "12m" : "6m")),
      carregarSituacaoDoExtrato(),
      contarAlertas(),
      // Extra: se a previsão falhar, o painel continua (só some a linha).
      carregarPrevisao(30).then(
        (p) => p.previsao,
        (erro) => {
          unstable_rethrow(erro);
          return null;
        },
      ),
      // Idem para os limites do mês.
      carregarLimitesDeGasto().catch((erro: unknown) => {
        unstable_rethrow(erro);
        return [];
      }),
      // Idem para o saldo ao longo do tempo (mesmos meses do gráfico mensal).
      carregarSaldoPorMes(periodoDe(chave === "12m" ? "12m" : "6m")).catch(
        (erro: unknown) => {
          unstable_rethrow(erro);
          return [];
        },
      ),
    ]);
    const conexao = conexoes.find(
      (c) => c.provedor === (openFinance ? "pluggy" : "arquivo"),
    );
    // Só lançamentos manuais (ADR 0017) também alimentam o painel.
    const temDados = !!conexao || conexoes.some((c) => c.provedor === "manual");
    dados = {
      conexao,
      temDados,
      openFinance,
      situacao,
      semTransacao: alertas.comprovantesSemTransacao,
      resumo,
      historico,
      previsto,
      limites,
      saldos,
    };
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

  const {
    conexao,
    temDados,
    openFinance,
    situacao,
    semTransacao,
    resumo,
    historico,
    previsto,
    limites,
    saldos,
  } = dados;
  const mesAtual = `${hojeISO().slice(0, 7)}-01`;
  if (forcado === "vazio" || !temDados)
    return <SemConexao openFinance={openFinance} />;
  const entradas = resumo.fluxoMensal.reduce(
    (s, m) => s + m.entradasCentavos,
    0,
  );
  const saidas = resumo.fluxoMensal.reduce((s, m) => s + m.saidasCentavos, 0);
  const extrato = (extra: string) =>
    `/extrato?de=${periodo.de}&ate=${periodo.ate}${extra}`;
  const semMovimento = entradas === 0 && saidas === 0;
  // Sem nenhum centro de custo (ex.: perfil pessoal) o bloco seria só "Sem centro": não mostra.
  const usaCentros = resumo.resultadoPorCentroDeCusto.some(
    (c) => c.centroDeCustoId !== null,
  );

  return (
    <div className="grid gap-12 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SeletorDePeriodo atual={chave} caminho="/painel" />
        {openFinance ? (
          conexao?.ultimaSincronizacaoEm && (
            <p className="text-sm text-texto-suave">
              {conexao.banco} · sincronizou{" "}
              {formatarTempoRelativo(conexao.ultimaSincronizacaoEm)}
            </p>
          )
        ) : (
          <Link
            href="/importar"
            className={`flex items-center gap-1.5 text-sm underline-offset-4 hover:underline ${
              situacao.desatualizado
                ? "font-medium text-alerta"
                : "text-texto-suave"
            }`}
          >
            {situacao.desatualizado && (
              <Icone nome="atencao" className="size-4" />
            )}
            {textoDaSituacaoDoExtrato(situacao)}
          </Link>
        )}
      </div>

      {/* O saldo é o texto grande; o período vem em linha, sem grade de cartões KPI. */}
      <section
        aria-labelledby="saldo"
        className="grid gap-x-12 gap-y-6 md:grid-cols-[auto_1fr] md:items-end"
      >
        <div className="grid gap-1">
          <h2
            id="saldo"
            className="font-sans text-sm font-medium tracking-normal text-texto-suave"
          >
            Saldo atual
          </h2>
          <ValorMonetario
            centavos={resumo.saldoAtualCentavos}
            className="font-titulo text-4xl font-bold md:text-5xl"
          />
          {resumo.saldoAtualizadoEm && (
            <p className="text-xs text-texto-suave">
              Saldo do extrato em {formatarDataHora(resumo.saldoAtualizadoEm)}
            </p>
          )}
          {previsto && previsto.ocorrencias.length > 0 && (
            <Link
              href="/previsao"
              className="text-sm text-texto-suave underline-offset-4 hover:underline"
            >
              Previsto em 30 dias:{" "}
              <ValorMonetario
                centavos={previsto.saldoPrevistoCentavos}
                className="font-semibold text-texto"
              />
            </Link>
          )}
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

      {limites.length > 0 && (
        <section aria-labelledby="limites-do-mes" className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="limites-do-mes" className="text-xl font-semibold">
              Limites do mês
            </h2>
            <Link
              href="/categorias#limites"
              className="text-sm text-texto-suave underline-offset-4 hover:underline"
            >
              Ajustar limites
            </Link>
          </div>
          <BarrasDeLimite
            limites={limites}
            hrefDoExtrato={(id) => `/extrato?de=${mesAtual}&categoria=${id}`}
          />
        </section>
      )}

      {semTransacao > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-m bg-alerta-suave px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-semibold text-alerta">
            <Icone nome="atencao" className="size-4" />
            {semTransacao === 1
              ? "1 comprovante sem transação no extrato"
              : `${semTransacao} comprovantes sem transação no extrato`}
          </span>
          <Link
            href={`/comprovantes?alerta=${FILTRO_SEM_TRANSACAO}`}
            className="font-medium text-texto underline underline-offset-4"
          >
            Ver comprovantes
          </Link>
        </p>
      )}

      {resumo.transacoesSemCategoria > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-m bg-alerta-suave px-4 py-3 text-sm">
          <span className="font-semibold text-alerta">
            {resumo.transacoesSemCategoria}{" "}
            {resumo.transacoesSemCategoria === 1
              ? "transação sem categoria"
              : "transações sem categoria"}
          </span>
          <Link
            href={extrato("&categoria=nenhuma")}
            className="font-medium text-texto underline underline-offset-4"
          >
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
        <div
          className={
            usaCentros
              ? "grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16"
              : "grid"
          }
        >
          <ParaOndeFoi
            gastos={resumo.gastosPorCategoria}
            hrefDaCategoria={(id) =>
              extrato(`&sentido=saida&categoria=${id ?? "nenhuma"}`)
            }
          />
          {usaCentros && (
            <ResultadoPorCentro
              centros={resumo.resultadoPorCentroDeCusto}
              hrefSemCentro={extrato("&centro=nenhum")}
            />
          )}
        </div>
      )}

      <GraficoEntradasSaidas fluxo={historico.fluxoMensal} />

      {/* Com um mês só não há linha para mostrar. */}
      {saldos.length > 1 && <GraficoSaldo saldos={saldos} />}
    </div>
  );
}

function SemConexao({ openFinance }: { openFinance: boolean }) {
  if (openFinance)
    return (
      <Vazio
        titulo="Conecte seu banco para ver para onde vai cada real"
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
      titulo="Importe o extrato do seu banco para ver para onde vai cada real"
      descricao="Exporte o arquivo OFX no Internet Banking e envie aqui, ou lance à mão em Contas. Reenviar o mesmo período não duplica nada."
      acao={
        <Link href="/importar" className={botao.primario}>
          Importar extrato
        </Link>
      }
    />
  );
}
