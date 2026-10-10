import { Suspense, type ReactNode } from "react";
import { NavegacaoComCaminho, NavegacaoDoSistema } from "@/componentes/estrutura/NavegacaoDoSistema";
import { AvisoDeReconexao, StatusDaConexao } from "@/componentes/estrutura/StatusDaConexao";
import { sair } from "@/componentes/prototipo/acoes-simuladas";
import { listarConexoes } from "@/componentes/prototipo/fonte-de-dados";

// Backend: aqui entra servicosDoUsuario() (sessão obrigatória) e a lista real de conexões.
async function Status() {
  return <StatusDaConexao conexoes={await listarConexoes()} />;
}

async function Aviso() {
  return <AvisoDeReconexao conexoes={await listarConexoes()} />;
}

const statusCarregando = <span className="text-xs text-texto-suave">Verificando o banco…</span>;
const status = (
  <Suspense fallback={statusCarregando}>
    <Status />
  </Suspense>
);

export default function LayoutDoSistema({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-full bg-primaria px-4 py-2 font-medium text-sobre-primaria focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      {/* Shell estático sem item ativo; a versão com a URL atual entra logo depois. */}
      <Suspense fallback={<NavegacaoDoSistema sair={sair} status={statusCarregando} caminho={null} />}>
        <NavegacaoComCaminho sair={sair} status={status} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <Aviso />
        </Suspense>
        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 outline-none md:px-8 lg:pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
