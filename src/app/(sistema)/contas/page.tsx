import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { NovaConta, NovoLancamento } from "@/componentes/contas/GerenciarContas";
import { TIPOS_DE_CONTA } from "@/componentes/contas/tipos-de-conta";
import { Erro } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";
import { botao } from "@/componentes/formulario/classes";
import { hojeISO } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import { carregarCategoriasERegras, carregarContas } from "@/regras-de-negocio/interface-web";
import { criarContaManual, lancarManual } from "@/regras-de-negocio/interface-web/acoes";

export const metadata: Metadata = { title: "Contas" };

const ORIGEM = { pluggy: "Banco conectado", arquivo: "Extrato importado", manual: "Manual" } as const;

const carregando = <Carregando contexto="generico" rotulo="Carregando as contas" className="min-h-[40vh]" />;

export default function Contas({ searchParams }: PageProps<"/contas">) {
  return (
    <>
      <CabecalhoDaPagina titulo="Contas" descricao="Saldos de todas as contas e lançamentos do que não passa pelo banco." />
      <Suspense fallback={carregando}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conteudo({ searchParams }: Pick<PageProps<"/contas">, "searchParams">) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const forcado = lerEstadoForcado((await searchParams).estado);
  if (forcado === "carregando") return carregando;

  let dados;
  try {
    if (forcado === "erro") throw new Error("forçado");
    const [contas, { categorias }] = await Promise.all([carregarContas(), carregarCategoriasERegras()]);
    dados = { contas, categorias };
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível carregar as contas"
        mensagem="Tente de novo em instantes."
        acao={
          <Link href="/contas" className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  const { contas, categorias } = dados;
  const manuais = contas.filter((c) => c.origem === "manual");

  return (
    <div className="grid gap-10 pb-8">
      {contas.length > 0 && (
        <section aria-labelledby="lista-de-contas" className="grid gap-3">
          <h2 id="lista-de-contas" className="text-lg font-semibold">
            Suas contas
          </h2>
          <ul className="divide-y divide-borda rounded-m border border-borda bg-superficie">
            {contas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="grid">
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-sm text-texto-suave">
                    {TIPOS_DE_CONTA[c.tipo]} · {ORIGEM[c.origem]}
                  </span>
                </div>
                <ValorMonetario centavos={c.saldoCentavos} className="font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {manuais.length > 0 ? (
        <NovoLancamento contas={manuais} categorias={categorias} hoje={hojeISO()} lancar={lancarManual} />
      ) : (
        <p className="max-w-[60ch] text-texto-suave">
          Crie uma conta manual para lançar gastos e entradas que não aparecem no extrato do banco, como dinheiro em espécie.
        </p>
      )}

      <NovaConta criar={criarContaManual} />
    </div>
  );
}
