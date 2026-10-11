import Link from "next/link";
import { IndicadorDeSituacao } from "@/componentes/conexao-bancaria/IndicadorDeSituacao";
import { situacaoDaConexao } from "@/componentes/conexao-bancaria/situacao";
import type { Conexao } from "@/regras-de-negocio";
import { formatarTempoRelativo } from "@/ferramentas-internas/formatar-data";

/** Dias inteiros desde a última importação/sincronização (null = nunca). */
export function diasDesde(instante: Date | null, agora = new Date()): number | null {
  return instante ? Math.floor((agora.getTime() - instante.getTime()) / 86_400_000) : null;
}

/** "Última importação há X dias" a partir da conexão de arquivo mais recente. */
export function ultimaImportacao(conexoes: Conexao[]): Date | null {
  const datas = conexoes.filter((c) => c.provedor !== "pluggy").map((c) => c.ultimaSincronizacaoEm?.getTime() ?? 0);
  const maior = Math.max(0, ...datas);
  return maior ? new Date(maior) : null;
}

export function textoDaUltimaImportacao(ultima: Date | null, agora = new Date()): string {
  const dias = diasDesde(ultima, agora);
  if (dias === null) return "Nenhum extrato importado";
  if (dias === 0) return "Última importação hoje";
  if (dias === 1) return "Última importação ontem";
  return `Última importação há ${dias} dias`;
}

/**
 * Indicador compacto do shell. Open Finance ligado: banco, situação e última sincronização (RF-07).
 * Desligado: quando o extrato foi importado pela última vez.
 */
export function StatusDaConexao({ conexoes, openFinance }: { conexoes: Conexao[]; openFinance: boolean }) {
  if (!openFinance) {
    const ultima = ultimaImportacao(conexoes);
    const atrasada = (diasDesde(ultima) ?? Infinity) > 7;
    return (
      <Link
        href="/importar"
        className={`grid gap-0.5 rounded-m px-2 py-1.5 text-xs transition-colors duration-[180ms] hover:bg-superficie-2 ${atrasada ? "text-alerta" : "text-texto-suave"}`}
      >
        {textoDaUltimaImportacao(ultima)}
      </Link>
    );
  }
  const c = conexoes.find((x) => x.provedor === "pluggy");
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
      {c.ultimaSincronizacaoEm && <span className="text-texto-suave">Sincronizou {formatarTempoRelativo(c.ultimaSincronizacaoEm)}</span>}
    </Link>
  );
}

/** Faixa no topo: banco a reconectar (Open Finance) ou extrato sem importação há mais de 7 dias. */
export function AvisoDeReconexao({ conexoes, openFinance }: { conexoes: Conexao[]; openFinance: boolean }) {
  if (!openFinance) {
    const ultima = ultimaImportacao(conexoes);
    const dias = diasDesde(ultima);
    // Nunca importou: o painel e o extrato já mostram o estado vazio com a ação.
    if (dias === null || dias <= 7) return null;
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-alerta-suave px-4 py-2.5 text-sm md:px-8">
        <p className="text-texto">
          <strong className="font-semibold text-alerta">{textoDaUltimaImportacao(ultima)}.</strong> O extrato pode estar desatualizado.
        </p>
        <Link href="/importar" className="font-medium text-primaria-texto underline underline-offset-4">
          Importar extrato
        </Link>
      </div>
    );
  }
  const precisa = conexoes.find((c) => c.provedor === "pluggy" && situacaoDaConexao(c).aviso);
  if (!precisa) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-alerta-suave px-4 py-2.5 text-sm md:px-8">
      <p className="text-texto">
        <strong className="font-semibold text-alerta">Seu banco precisa ser reconectado.</strong> {situacaoDaConexao(precisa).detalhe} O
        extrato fica parado até lá.
      </p>
      <Link href="/conexoes-bancarias" className="font-medium text-primaria-texto underline underline-offset-4">
        Reconectar
      </Link>
    </div>
  );
}
