import "server-only";
import { exigirLimite, LIMITES, type ConsumirLimite } from "../acesso/limites";
import type { FiltrosDoExtrato, PaginaDoExtrato } from "../extrato";
import type { ContextoDoUsuario, DataISO, Id, Transacao } from "../tipos";

// Exportação do extrato em CSV (Fase 5, ADR 0017). Formato do Excel em português:
// BOM UTF-8, ";" como separador, vírgula decimal, data DD/MM/AAAA, CRLF.

/** Acima disso o arquivo sai cortado (e o nome avisa): exporte um período menor. */
export const LIMITE_DE_LINHAS = 20_000;
const PAGINA = 200;

export interface ArquivoExportado {
  nomeDoArquivo: string;
  conteudo: string;
  linhas: number;
  truncado: boolean;
}

export interface ServicoDeExportacao {
  exportarExtrato(
    ctx: ContextoDoUsuario,
    filtros: FiltrosDoExtrato,
  ): Promise<ArquivoExportado>;
}

/**
 * Célula de texto: neutraliza fórmula (CSV injection: "=", "+", "-", "@", tab, CR viram texto com ')
 * e põe entre aspas quando tem separador, aspas ou quebra de linha.
 */
export function celulaDeTexto(valor: string | null | undefined): string {
  let t = (valor ?? "").replace(/\r?\n|\r/g, " ");
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** -123456 → "-1234,56" (sem milhar: o Excel em pt-BR lê como número). */
export function celulaDeValor(centavos: number): string {
  const sinal = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  return `${sinal}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

const dataBr = (iso: DataISO) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export const CABECALHO = [
  "Data",
  "Descrição",
  "Valor",
  "Categoria",
  "Centro de custo",
  "Conta",
  "Contraparte",
  "Forma de pagamento",
  "Fora dos totais",
  "Pendente",
];

export function montarCsv(
  transacoes: readonly Transacao[],
  nomes: {
    categorias: Map<Id, string>;
    centros: Map<Id, string>;
    contas: Map<Id, string>;
  },
): string {
  const linhas = transacoes.map((t) =>
    [
      dataBr(t.data),
      celulaDeTexto(t.descricao),
      celulaDeValor(t.valorCentavos),
      celulaDeTexto(t.categoriaId ? nomes.categorias.get(t.categoriaId) : ""),
      celulaDeTexto(
        t.centroDeCustoId ? nomes.centros.get(t.centroDeCustoId) : "",
      ),
      celulaDeTexto(nomes.contas.get(t.contaId)),
      celulaDeTexto(t.contraparte),
      celulaDeTexto(t.metodoDePagamento),
      t.oculta ? "sim" : "não",
      t.pendente ? "sim" : "não",
    ].join(";"),
  );
  return `﻿${[CABECALHO.join(";"), ...linhas].join("\r\n")}\r\n`;
}

export function criarServicoDeExportacao(deps: {
  listarPagina: (
    ctx: ContextoDoUsuario,
    filtros: FiltrosDoExtrato,
  ) => Promise<PaginaDoExtrato>;
  nomes: (ctx: ContextoDoUsuario) => Promise<Parameters<typeof montarCsv>[1]>;
  consumirLimite: ConsumirLimite;
  hoje: () => DataISO;
}): ServicoDeExportacao {
  return {
    async exportarExtrato(ctx, filtros) {
      await exigirLimite(
        deps.consumirLimite,
        `exportacao:usuario:${ctx.usuarioId}`,
        LIMITES.exportacao,
      );
      const transacoes: Transacao[] = [];
      let cursor: string | undefined;
      let truncado = false;
      do {
        // listar valida os filtros (entrada_invalida) e é ordenado por data desc.
        const pagina = await deps.listarPagina(ctx, {
          ...filtros,
          cursor,
          limite: PAGINA,
        });
        transacoes.push(...pagina.itens);
        cursor = pagina.proximoCursor ?? undefined;
        if (transacoes.length >= LIMITE_DE_LINHAS) {
          truncado =
            cursor !== undefined || transacoes.length > LIMITE_DE_LINHAS;
          transacoes.length = Math.min(transacoes.length, LIMITE_DE_LINHAS);
          break;
        }
      } while (cursor);

      const periodo =
        [filtros.dataDe, filtros.dataAte].filter(Boolean).join("_a_") ||
        `ate_${deps.hoje()}`;
      return {
        nomeDoArquivo: `rastro-extrato_${periodo}${truncado ? "_parcial" : ""}.csv`,
        conteudo: montarCsv(transacoes, await deps.nomes(ctx)),
        linhas: transacoes.length,
        truncado,
      };
    },
  };
}
