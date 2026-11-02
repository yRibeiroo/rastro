import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TIPOS_DE_CONTA } from "@/componentes/contas/tipos-de-conta";
import { Erro } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";
import { botao } from "@/componentes/formulario/classes";
import { AcoesDaOcorrencia, EncerrarRecorrencia, NovaRecorrenciaForm } from "@/componentes/previsao/GerenciarPrevisao";
import { formatarData } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import { carregarCategoriasERegras, carregarContas, carregarPrevisao } from "@/regras-de-negocio/interface-web";
import { baixarOcorrencia, criarRecorrencia, encerrarRecorrencia } from "@/regras-de-negocio/interface-web/acoes";

export const metadata: Metadata = { title: "Previsão" };

const HORIZONTES = [30, 60, 90] as const;
const FREQUENCIA = { semanal: "toda semana", mensal: "todo mês", anual: "todo ano" } as const;

const carregando = <Carregando contexto="generico" rotulo="Calculando a previsão" className="min-h-[40vh]" />;

export default function Previsao({ searchParams }: PageProps<"/previsao">) {
  return (
    <>
      <CabecalhoDaPagina titulo="Previsão" descricao="Contas a pagar e a receber e quanto vai sobrar na conta." />
      <Suspense fallback={carregando}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/previsao">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const sp = await searchParams;
  const forcado = lerEstadoForcado(sp.estado);
  if (forcado === "carregando") return carregando;
  const dias = HORIZONTES.find((h) => String(h) === sp.dias) ?? 30;

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [{ previsao, recorrencias }, contas, { categorias }] = await Promise.all([
      carregarPrevisao(dias),
      carregarContas(),
      carregarCategoriasERegras(),
    ]);
    dados = { previsao, recorrencias, contas, categorias };
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível calcular a previsão"
        mensagem="Tente de novo em instantes."
        acao={
          <Link href="/previsao" className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const { previsao, recorrencias, contas, categorias } = dados;
  const nomeDaConta = new Map(contas.map((c) => [c.id, c.nome]));
  const contasDoForm = contas.map((c) => ({ ...c, rotulo: `${c.nome} · ${TIPOS_DE_CONTA[c.tipo]}` }));
  const atrasadas = previsao.ocorrencias.filter((o) => o.atrasada).length;

  return (
    <div className="grid gap-10 pb-8">
      <section aria-labelledby="resumo" className="grid gap-4">
        <h2 id="resumo" className="sr-only">
          Resumo
        </h2>
        <nav aria-label="Horizonte" className="flex flex-wrap gap-2">
          {HORIZONTES.map((h) => (
            <Link
              key={h}
              href={`/previsao?dias=${h}`}
              aria-current={h === dias ? "page" : undefined}
              className={h === dias ? botao.primario : botao.secundario}
            >
              {h} dias
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
          <div className="grid gap-1">
            <span className="text-sm text-texto-suave">Saldo hoje</span>
            <ValorMonetario centavos={previsao.saldoAtualCentavos} className="font-titulo text-2xl font-bold" />
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-texto-suave">Previsto em {formatarData(previsao.ate)}</span>
            <ValorMonetario
              centavos={previsao.saldoPrevistoCentavos}
              className={`font-titulo text-4xl font-bold ${previsao.saldoPrevistoCentavos < 0 ? "text-saida" : ""}`}
            />
          </div>
        </div>
        {atrasadas > 0 && (
          <p role="status" className="w-fit rounded-full bg-alerta-suave px-3 py-1 text-sm font-medium text-alerta">
            {atrasadas === 1 ? "1 conta atrasada" : `${atrasadas} contas atrasadas`}: marque como paga ou pule para tirar da previsão.
          </p>
        )}
      </section>

      <section aria-labelledby="proximas" className="grid gap-3">
        <h2 id="proximas" className="text-lg font-semibold">
          Próximas contas
        </h2>
        {previsao.ocorrencias.length === 0 ? (
          <p className="text-texto-suave">Nada previsto nesse período. Cadastre abaixo o que se repete: aluguel, salário, internet.</p>
        ) : (
          <ul className="divide-y divide-borda rounded-m border border-borda bg-superficie">
            {previsao.ocorrencias.map((o) => (
              <li key={`${o.recorrenciaId}-${o.data}`} className="grid gap-2 px-4 py-3 md:grid-cols-[7rem_1fr_auto_auto] md:items-center md:gap-4">
                <span className={`text-sm ${o.atrasada ? "font-semibold text-alerta" : "text-texto-suave"}`}>
                  {formatarData(o.data)}
                  {o.atrasada && " · atrasada"}
                </span>
                <div className="grid min-w-0">
                  <span className="truncate font-medium">{o.descricao}</span>
                  <span className="text-xs text-texto-suave">
                    {nomeDaConta.get(o.contaId)}
                    {o.saldoDepoisCentavos !== null && (
                      <>
                        {" · saldo depois: "}
                        <ValorMonetario centavos={o.saldoDepoisCentavos} />
                      </>
                    )}
                  </span>
                </div>
                <ValorMonetario centavos={o.valorCentavos} comSinal className="font-semibold md:text-right" />
                <AcoesDaOcorrencia
                  recorrenciaId={o.recorrenciaId}
                  data={o.data}
                  entrada={o.valorCentavos > 0}
                  descricao={o.descricao}
                  baixar={baixarOcorrencia}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {contas.length > 0 ? (
        <NovaRecorrenciaForm contas={contasDoForm} categorias={categorias} hoje={previsao.hoje} criar={criarRecorrencia} />
      ) : (
        <p className="text-texto-suave">
          Para prever, primeiro{" "}
          <Link href="/contas" className="text-primaria-texto underline underline-offset-4">
            crie uma conta
          </Link>{" "}
          ou importe um extrato.
        </p>
      )}

      {recorrencias.length > 0 && (
        <section aria-labelledby="recorrencias" className="grid gap-3">
          <h2 id="recorrencias" className="text-lg font-semibold">
            O que se repete
          </h2>
          <ul className="divide-y divide-borda rounded-m border border-borda bg-superficie">
            {recorrencias.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="grid">
                  <span className="font-medium">{r.descricao}</span>
                  <span className="text-sm text-texto-suave">
                    {FREQUENCIA[r.frequencia]} desde {formatarData(r.inicio)}
                    {r.fim && ` até ${formatarData(r.fim)}`} · {nomeDaConta.get(r.contaId)}
                  </span>
                </div>
                <span className="flex items-center gap-3">
                  <ValorMonetario centavos={r.valorCentavos} comSinal className="font-semibold" />
                  <EncerrarRecorrencia recorrenciaId={r.id} descricao={r.descricao} encerrar={encerrarRecorrencia} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
