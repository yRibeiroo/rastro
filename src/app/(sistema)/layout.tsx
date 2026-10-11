import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense, type ReactNode } from "react";
import {
  NavegacaoComCaminho,
  NavegacaoDoSistema,
} from "@/componentes/estrutura/NavegacaoDoSistema";
import {
  AvisoDeExtratoDesatualizado,
  AvisoDeReconexao,
  SituacaoDoExtratoNoMenu,
  StatusDaConexao,
} from "@/componentes/estrutura/StatusDaConexao";
import {
  carregarConexoes,
  carregarRecursos,
  carregarSituacaoDoExtrato,
  contarAlertas,
} from "@/regras-de-negocio/interface-web";
import { sair } from "@/regras-de-negocio/interface-web/acoes";

// Uma leitura por requisição, dividida entre o status, o aviso e o selo. connection() antes: o cliente do
// Supabase lê o relógio ao ser criado, e isso não pode acontecer durante o prerender do shell.
// Falha aqui não derruba a tela (o error.tsx do segmento não cobre o próprio layout): vira null.
const semDerrubar = <T,>(ler: () => Promise<T>) =>
  cache(async (): Promise<T | null> => {
    await connection();
    try {
      return await ler();
    } catch (erro) {
      unstable_rethrow(erro); // redirect("/entrar") sem sessão passa direto
      return null;
    }
  });

const conexoes = semDerrubar(carregarConexoes);
const situacaoDoExtrato = semDerrubar(carregarSituacaoDoExtrato);
const alertas = semDerrubar(contarAlertas);

const indisponivel = (
  <span className="text-xs text-texto-suave">
    Situação do extrato indisponível
  </span>
);

async function Status({ openFinance }: { openFinance: boolean }) {
  if (openFinance) {
    const lista = await conexoes();
    return lista ? <StatusDaConexao conexoes={lista} /> : indisponivel;
  }
  const situacao = await situacaoDoExtrato();
  return situacao ? (
    <SituacaoDoExtratoNoMenu situacao={situacao} />
  ) : (
    indisponivel
  );
}

async function Aviso({ openFinance }: { openFinance: boolean }) {
  if (openFinance) {
    const lista = await conexoes();
    return lista && <AvisoDeReconexao conexoes={lista} />;
  }
  const situacao = await situacaoDoExtrato();
  return situacao && <AvisoDeExtratoDesatualizado situacao={situacao} />;
}

/** RF-42: quantos comprovantes estão sem transação no extrato, no item "Comprovantes". */
async function SeloDeAlertas() {
  const n = (await alertas())?.comprovantesSemTransacao ?? 0;
  if (n === 0) return null;
  return (
    <span className="valor-monetario inline-grid h-5 min-w-5 place-items-center rounded-full bg-alerta-suave px-1.5 text-[11px] leading-none font-semibold text-alerta ring-1 ring-alerta/40">
      {n}
      <span className="sr-only"> sem transação no extrato</span>
    </span>
  );
}

const statusCarregando = (
  <span className="text-xs text-texto-suave">Verificando o extrato…</span>
);

export default async function LayoutDoSistema({
  children,
}: {
  children: ReactNode;
}) {
  const { openFinance } = await carregarRecursos();
  const status = (
    <Suspense fallback={statusCarregando}>
      <Status openFinance={openFinance} />
    </Suspense>
  );
  const selo = (
    <Suspense fallback={null}>
      <SeloDeAlertas />
    </Suspense>
  );
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-full bg-primaria px-4 py-2 font-medium text-sobre-primaria focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      {/* Shell estático sem item ativo; a versão com a URL atual entra logo depois. */}
      <Suspense
        fallback={
          <NavegacaoDoSistema
            sair={sair}
            status={statusCarregando}
            caminho={null}
            openFinance={openFinance}
          />
        }
      >
        <NavegacaoComCaminho
          sair={sair}
          status={status}
          seloDosComprovantes={selo}
          openFinance={openFinance}
        />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <Aviso openFinance={openFinance} />
        </Suspense>
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 outline-none md:px-8 lg:pb-16"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
