import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BotaoConectarBanco } from "@/componentes/conexao-bancaria/BotaoConectarBanco";
import { IndicadorDeSituacao } from "@/componentes/conexao-bancaria/IndicadorDeSituacao";
import { situacaoDaConexao } from "@/componentes/conexao-bancaria/situacao";
import { Erro, Vazio } from "@/componentes/estados/Estados";
import { lerEstadoForcado } from "@/componentes/estados/estado-forcado";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import { BotaoSincronizar } from "@/componentes/extrato/BotaoSincronizar";
import { botao } from "@/componentes/formulario/classes";
import type { Conexao } from "@/regras-de-negocio";
import { carregarConexoes, carregarRecursos } from "@/regras-de-negocio/interface-web";
import { iniciarConexao, registrarConexao, sincronizarAgora } from "@/regras-de-negocio/interface-web/acoes";
import { formatarData, formatarDataHora, formatarTempoRelativo } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";

export const metadata: Metadata = { title: "Conexões bancárias" };

const carregando = <Carregando contexto="conectando" rotulo="Verificando a conexão com o banco" className="min-h-[40vh]" />;

// Só existe com RECURSO_OPEN_FINANCE ligado (ADR 0016); sem a flag, a rota é 404.
export default async function ConexoesBancarias({ searchParams }: PageProps<"/conexoes-bancarias">) {
  const { openFinance, incluirSandbox } = await carregarRecursos();
  if (!openFinance) notFound();
  const acoes: Acoes = { iniciarConexao, registrarConexao, incluirSandbox };
  return (
    <>
      <CabecalhoDaPagina titulo="Conexões bancárias" descricao="O Rastro lê o extrato pelo Open Finance. Ele nunca movimenta dinheiro." />
      <Suspense fallback={carregando}>
        <Conteudo searchParams={searchParams} acoes={acoes} />
      </Suspense>
    </>
  );
}

type Acoes = Pick<Parameters<typeof BotaoConectarBanco>[0], "iniciarConexao" | "registrarConexao" | "incluirSandbox">;

async function Conteudo({ searchParams, acoes }: Pick<PageProps<"/conexoes-bancarias">, "searchParams"> & { acoes: Acoes }) {
  // Dados por requisição (sessão e relógio): fora do shell e do prefetch.
  await connection();
  const sp = await searchParams;
  const forcado = lerEstadoForcado(sp.estado);
  if (forcado === "carregando") return carregando;

  let conexoes: Conexao[];
  try {
    if (forcado === "erro") throw new Error("forçado");
    conexoes = (await carregarConexoes()).filter((c) => c.provedor === "pluggy");
  } catch (erro) {
    unstable_rethrow(erro);
    return (
      <Erro
        titulo="Não foi possível ver as conexões"
        mensagem="Tente de novo em instantes."
        acao={
          <Link href="/conexoes-bancarias" className={botao.primario}>
            Tentar de novo
          </Link>
        }
      />
    );
  }

  if (forcado === "vazio" || conexoes.length === 0)
    return (
      <Vazio
        titulo="Nenhum banco conectado"
        descricao="Conecte a conta PJ do Sicredi. A autorização é feita no app do banco e vale por até 12 meses."
        acao={<BotaoConectarBanco {...acoes} />}
      />
    );

  return (
    <div className="grid gap-8 pb-8">
      <ul className="grid gap-4">
        {conexoes.map((c) => (
          <CartaoDaConexao key={c.id} conexao={c} acoes={acoes} />
        ))}
      </ul>
      <div className="grid justify-items-start gap-2 border-t border-borda pt-6">
        <h2 className="text-base font-semibold">Outra conta</h2>
        <p className="text-sm text-texto-suave">Cada conexão é uma autorização separada no banco.</p>
        <BotaoConectarBanco {...acoes} variante="secundario" />
      </div>
    </div>
  );
}

function CartaoDaConexao({ conexao: c, acoes }: { conexao: Conexao; acoes: Acoes }) {
  const situacao = situacaoDaConexao(c);
  return (
    <li className="grid gap-5 rounded-g border border-borda bg-superficie p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">{c.banco ?? "Banco"}</h2>
          <p className="text-sm text-texto-suave">Conta PJ · Open Finance via Pluggy</p>
        </div>
        <div className="grid justify-items-end gap-1 text-sm">
          <IndicadorDeSituacao situacao={situacao} className="font-medium" />
          {situacao.detalhe && <span className="text-xs text-texto-suave">{situacao.detalhe}</span>}
        </div>
      </div>

      {c.status === "atualizando" && <Carregando contexto="sincronizando" tamanho="inline" rotulo="Sincronizando transações" />}

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="grid gap-0.5">
          <dt className="text-texto-suave">Última sincronização</dt>
          <dd>{c.ultimaSincronizacaoEm ? `${formatarTempoRelativo(c.ultimaSincronizacaoEm)} (${formatarDataHora(c.ultimaSincronizacaoEm)})` : "Ainda não sincronizou"}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-texto-suave">Autorização do banco</dt>
          <dd className={situacao.reconectar && situacao.tom === "alerta" ? "font-medium text-alerta" : ""}>
            {c.consentimentoExpiraEm
              ? situacao.expirada
                ? `Expirou em ${formatarData(c.consentimentoExpiraEm)}`
                : `Expira em ${formatarData(c.consentimentoExpiraEm)}`
              : "Sem prazo informado"}
          </dd>
        </div>
      </dl>

      {c.erro && c.status === "erro" && <p className="text-sm text-erro">Motivo: {c.erro.mensagem}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-borda pt-4">
        {situacao.reconectar && <BotaoConectarBanco {...acoes} reconectar={{ conexaoId: c.id, idExterno: c.idExterno }} />}
        {!situacao.aviso && <BotaoSincronizar conexaoId={c.id} banco={c.banco} sincronizar={sincronizarAgora} />}
      </div>
    </li>
  );
}
