import Link from "next/link";
import { IndicadorDeSituacao } from "@/componentes/conexao-bancaria/IndicadorDeSituacao";
import { situacaoDaConexao } from "@/componentes/conexao-bancaria/situacao";
import type { Conexao } from "@/componentes/prototipo/tipos-provisorios";
import { formatarTempoRelativo } from "@/ferramentas-internas/formatar-data";

/**
 * Indicador compacto do shell (RF-07): banco, situação e última sincronização.
 * Recebe a lista já lida: o layout decide a fonte (protótipo ou serviço real).
 */
export function StatusDaConexao({ conexoes }: { conexoes: Conexao[] }) {
  const c = conexoes[0];
  if (!c)
    return (
      <Link href="/conexoes-bancarias" className="text-xs text-texto-suave underline-offset-4 hover:underline">
        Nenhum banco conectado
      </Link>
    );
  return (
    <Link
      href="/conexoes-bancarias"
      className="grid gap-0.5 rounded-m px-2 py-1.5 text-xs transition-colors duration-[180ms] hover:bg-superficie-2"
    >
      <span className="font-medium text-texto">{c.banco ?? "Banco"}</span>
      <IndicadorDeSituacao situacao={situacaoDaConexao(c)} />
      {c.ultimaSincronizacaoEm && (
        <span className="text-texto-suave">Sincronizou {formatarTempoRelativo(c.ultimaSincronizacaoEm)}</span>
      )}
    </Link>
  );
}

/** Faixa no topo de todas as telas quando o banco precisa ser reconectado (HU-04). */
export function AvisoDeReconexao({ conexoes }: { conexoes: Conexao[] }) {
  const precisa = conexoes.find((c) => situacaoDaConexao(c).aviso);
  if (!precisa) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-alerta-suave px-4 py-2.5 text-sm md:px-8">
      <p className="text-texto">
        <strong className="font-semibold text-alerta">Seu banco precisa ser reconectado.</strong>{" "}
        {situacaoDaConexao(precisa).detalhe} O extrato fica parado até lá.
      </p>
      <Link href="/conexoes-bancarias" className="font-medium text-primaria-texto underline underline-offset-4">
        Reconectar
      </Link>
    </div>
  );
}
