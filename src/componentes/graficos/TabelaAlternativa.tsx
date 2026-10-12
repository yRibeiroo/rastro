/** Alternativa em tabela para todo gráfico (RNF-09, RF-24). Fechada por padrão, abre com teclado. */
export function TabelaAlternativa({
  legenda,
  colunas,
  linhas,
}: {
  legenda: string;
  colunas: string[];
  linhas: string[][];
}) {
  return (
    <details className="group text-sm">
      <summary className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-full text-primaria-texto underline-offset-4 hover:underline md:h-9">
        <span className="group-open:hidden">Ver como tabela</span>
        <span className="hidden group-open:inline">Esconder tabela</span>
      </summary>
      <div className="mt-2 overflow-x-auto rounded-m border border-borda">
        <table className="w-full min-w-max text-left">
          <caption className="sr-only">{legenda}</caption>
          <thead className="bg-superficie-2">
            <tr>
              {colunas.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l[0]} className="border-t border-borda">
                {l.map((celula, i) =>
                  i === 0 ? (
                    <th
                      key={i}
                      scope="row"
                      className="px-3 py-2 font-normal capitalize"
                    >
                      {celula}
                    </th>
                  ) : (
                    <td
                      key={i}
                      className="valor-monetario px-3 py-2 text-right"
                    >
                      {celula}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
