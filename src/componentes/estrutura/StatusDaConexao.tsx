import Link from "next/link";
import { IndicadorDeSituacao } from "@/componentes/conexao-bancaria/IndicadorDeSituacao";
import { situacaoDaConexao } from "@/componentes/conexao-bancaria/situacao";
import { textoDaSituacaoDoExtrato } from "@/componentes/importacao/extrato";
import type { Conexao, SituacaoDoExtrato } from "@/regras-de-negocio";
import { formatarTempoRelativo } from "@/ferramentas-internas/formatar-data";
import { Icone } from "./Icone";

/** Indicador compacto do shell sem Open Finance (RF-34): quando o extrato foi importado pela última vez. */
export function SituacaoDoExtratoNoMenu({
  situacao,
}: {
  situacao: SituacaoDoExtrato;
}) {
  return (
    <Link
      href="/importar"
      className={`flex items-center gap-1.5 rounded-m px-2 py-1.5 text-xs transition-colors duration-[180ms] hover:bg-superficie-2 ${
        situacao.desatualizado ? "font-medium text-alerta" : "text-texto-suave"
      }`}
    >
      {situacao.desatualizado && <Icone nome="atencao" className="size-4" />}
      {textoDaSituacaoDoExtrato(situacao)}
    </Link>
  );
}

/** Faixa no topo quando o extrato está há 7 dias ou mais sem importação (RF-34). Texto + ícone, não só cor. */
export function AvisoDeExtratoDesatualizado({
  situacao,
}: {
  situacao: SituacaoDoExtrato;
}) {
  // Nunca importou: o painel e o extrato já mostram o estado vazio com a ação.
  if (!situacao.desatualizado) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-alerta-suave px-4 py-2.5 text-sm md:px-8"
    >
      <p className="flex items-center gap-2 text-texto">
        <Icone nome="atencao" className="size-4 text-alerta" />
        <span>
          <strong className="font-semibold text-alerta">
            {textoDaSituacaoDoExtrato(situacao)}.
          </strong>{" "}
          O painel pode estar desatualizado.
        </span>
      </p>
      <Link
        href="/importar"
        className="font-medium text-primaria-texto underline underline-offset-4"
      >
        Importar extrato
      </Link>
    </div>
  );
}

/** Indicador compacto do shell com Open Finance: banco, situação e última sincronização (RF-07). */
export function StatusDaConexao({ conexoes }: { conexoes: Conexao[] }) {
  const c = conexoes.find((x) => x.provedor === "pluggy");
  if (!c)
    return (
      <Link
        href="/conexoes-bancarias"
        className="text-xs text-texto-suave underline-offset-4 hover:underline"
      >
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
        <span className="text-texto-suave">
          Sincronizou {formatarTempoRelativo(c.ultimaSincronizacaoEm)}
        </span>
      )}
    </Link>
  );
}

/** Faixa no topo quando o banco precisa ser reconectado (Open Finance). */
export function AvisoDeReconexao({ conexoes }: { conexoes: Conexao[] }) {
  const precisa = conexoes.find(
    (c) => c.provedor === "pluggy" && situacaoDaConexao(c).aviso,
  );
  if (!precisa) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-alerta-suave px-4 py-2.5 text-sm md:px-8"
    >
      <p className="text-texto">
        <strong className="font-semibold text-alerta">
          Seu banco precisa ser reconectado.
        </strong>{" "}
        {situacaoDaConexao(precisa).detalhe} O extrato fica parado até lá.
      </p>
      <Link
        href="/conexoes-bancarias"
        className="font-medium text-primaria-texto underline underline-offset-4"
      >
        Reconectar
      </Link>
    </div>
  );
}
