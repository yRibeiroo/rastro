import Link from "next/link";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";
import { formatarData } from "@/ferramentas-internas/formatar-data";
import type { Anexo, Comprovante } from "@/regras-de-negocio";
import { CONFIANCA_BAIXA, mascararDocumento, TIPOS } from "./comprovante";
import { Miniatura, type AcoesDosComprovantes } from "./ListaDeComprovantes";

type Props = {
  comprovantes: Comprovante[];
  anexos: Anexo[];
  gerarLinkTemporario: AcoesDosComprovantes["gerarLinkTemporario"];
};

/** No detalhe da transação: o comprovante conciliado, com os itens lidos. */
export function ComprovantesDaTransacao({
  comprovantes,
  anexos,
  gerarLinkTemporario,
}: Props) {
  if (comprovantes.length === 0) return null;
  return (
    <section aria-labelledby="comprovante" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="comprovante" className="text-xl font-semibold">
          {comprovantes.length === 1 ? "Comprovante" : "Comprovantes"}
        </h2>
        <Link
          href="/comprovantes?situacao=conciliado"
          className="text-sm text-primaria-texto underline underline-offset-4"
        >
          Ver todos
        </Link>
      </div>
      {comprovantes.map((c) => {
        const documento = mascararDocumento(c.documentoEmissor);
        return (
          <article
            key={c.id}
            className="grid gap-4 rounded-m border border-borda bg-superficie p-4"
          >
            <div className="grid grid-cols-[auto_1fr] items-start gap-4">
              <Miniatura
                anexoId={
                  anexos.find((a) => a.comprovanteId === c.id)?.id ?? null
                }
                gerarLinkTemporario={gerarLinkTemporario}
                tamanho="size-20"
              />
              <dl className="grid gap-1 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="sr-only">Tipo</dt>
                  <dd className="text-base font-semibold">
                    {c.tipo ? TIPOS[c.tipo] : "Comprovante"}
                  </dd>
                  {c.data && (
                    <>
                      <dt className="sr-only">Data</dt>
                      <dd className="text-texto-suave">
                        {formatarData(c.data)}
                      </dd>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-texto-suave">Emissor:</dt>
                  <dd>
                    {c.emissor ?? "Não identificado"}
                    {documento && (
                      <span className="valor-monetario text-texto-suave">
                        {" "}
                        · {documento}
                      </span>
                    )}
                  </dd>
                </div>
                {c.valorCentavos !== null && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-texto-suave">Valor lido:</dt>
                    <dd>
                      <ValorMonetario centavos={c.valorCentavos} />
                    </dd>
                  </div>
                )}
                {c.chaveDeAcesso && (
                  <div className="grid">
                    <dt className="text-texto-suave">Chave de acesso</dt>
                    <dd className="font-mono text-xs break-all">
                      {c.chaveDeAcesso}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            {c.confianca !== null && c.confianca < CONFIANCA_BAIXA && (
              <p className="w-fit rounded-full border border-alerta/50 bg-alerta-suave px-2.5 py-0.5 text-xs font-semibold text-alerta">
                Confira os dados lidos
              </p>
            )}
            {c.itens.length > 0 && (
              <table className="w-full text-sm">
                <caption className="pb-2 text-left font-medium">Itens</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Descrição</th>
                    <th scope="col">Quantidade</th>
                    <th scope="col">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda border-t border-borda">
                  {c.itens.map((item, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3">{item.descricao}</td>
                      <td className="valor-monetario py-1.5 pr-3 text-right whitespace-nowrap text-texto-suave">
                        {item.quantidade !== null ? `${item.quantidade}×` : ""}
                      </td>
                      <td className="py-1.5 text-right">
                        {item.valorCentavos !== null && (
                          <ValorMonetario centavos={item.valorCentavos} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        );
      })}
    </section>
  );
}
