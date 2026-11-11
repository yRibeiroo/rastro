import "server-only";
import { z } from "zod";
import type { ServicoDeExtrato } from "../extrato";
import type { PeriodoDoPainel, ServicoDoPainel } from "../painel";
import type { Categoria, Centavos, ContextoDoUsuario } from "../tipos";

// Ferramentas do assistente financeiro. Todas SOMENTE LEITURA e pré-definidas: o modelo escolhe
// uma ferramenta e os parâmetros, nunca escreve SQL. As dependências só expõem leituras (Pick),
// e tudo passa pelos serviços da sessão do usuário, então a RLS continua valendo.

export interface FerramentaDoAgente {
  nome: string;
  descricao: string;
  esquema: z.ZodType;
  /** Valida a entrada (não confiável: vem do modelo) e devolve dados serializáveis. */
  executar(entrada: unknown): Promise<unknown>;
}

export const MAXIMO_DE_MAIORES_GASTOS = 20;
export const MAXIMO_DE_TRANSACOES_NA_BUSCA = 50;
const PAGINA = 200;
const PAGINAS_NO_MAXIMO = 5;

const data = z.iso.date().describe("Data no formato AAAA-MM-DD");
const periodo = z.object({
  de: data.describe("Primeiro dia do período (AAAA-MM-DD)"),
  ate: data.describe("Último dia do período (AAAA-MM-DD)"),
});

const reais = (centavos: Centavos) => Number((centavos / 100).toFixed(2));

function ferramenta<E extends z.ZodType>(definicao: {
  nome: string;
  descricao: string;
  esquema: E;
  executar: (entrada: z.output<E>) => Promise<unknown>;
}): FerramentaDoAgente {
  return {
    nome: definicao.nome,
    descricao: definicao.descricao,
    esquema: definicao.esquema,
    // async: entrada inválida vira promessa rejeitada, nunca exceção síncrona.
    executar: async (entrada) =>
      definicao.executar(definicao.esquema.parse(entrada)),
  };
}

export function criarFerramentasDoAgente(deps: {
  ctx: ContextoDoUsuario;
  painel: Pick<ServicoDoPainel, "obterResumo">;
  extrato: Pick<ServicoDeExtrato, "listar">;
  categorias: () => Promise<Categoria[]>;
}): FerramentaDoAgente[] {
  const { ctx } = deps;

  async function totais(p: PeriodoDoPainel) {
    const r = await deps.painel.obterResumo(ctx, p);
    const entradas = r.fluxoMensal.reduce((s, m) => s + m.entradasCentavos, 0);
    const saidas = r.fluxoMensal.reduce((s, m) => s + m.saidasCentavos, 0);
    return { r, entradas, saidas };
  }
  type Totais = Awaited<ReturnType<typeof totais>>;

  const porCategoria = ({ r, saidas }: Totais) =>
    r.gastosPorCategoria.map((g) => ({
      categoria: g.nome,
      total: reais(g.totalCentavos),
      quantidadeDeTransacoes: g.quantidade,
      percentualDasSaidas: saidas
        ? Number(((g.totalCentavos / saidas) * 100).toFixed(1))
        : 0,
    }));

  return [
    ferramenta({
      nome: "resumo_financeiro",
      descricao:
        "Entradas, saídas e resultado de um período (total e mês a mês), mais o saldo atual das contas. " +
        "Não conta transferências entre contas próprias, transações pendentes nem ocultas. Período de até 24 meses.",
      esquema: periodo,
      async executar(p) {
        const { r, entradas, saidas } = await totais(p);
        return {
          periodo: p,
          entradas: reais(entradas),
          saidas: reais(saidas),
          resultado: reais(entradas - saidas),
          porMes: r.fluxoMensal.map((m) => ({
            mes: m.mes,
            entradas: reais(m.entradasCentavos),
            saidas: reais(m.saidasCentavos),
            resultado: reais(m.resultadoCentavos),
          })),
          saldoAtualDasContas: reais(r.saldoAtualCentavos),
          transacoesSemCategoria: r.transacoesSemCategoria,
        };
      },
    }),

    ferramenta({
      nome: "gastos_por_categoria",
      descricao:
        "Total de saídas por categoria em um período, da maior para a menor, com a participação de cada uma. " +
        "Use para 'quanto gastei com X' e 'para onde foi o dinheiro'. Período de até 24 meses.",
      esquema: periodo,
      async executar(p) {
        const t = await totais(p);
        return {
          periodo: p,
          totalDeSaidas: reais(t.saidas),
          categorias: porCategoria(t),
        };
      },
    }),

    ferramenta({
      nome: "comparar_periodos",
      descricao:
        "Compara dois períodos (por exemplo, dois meses): entradas, saídas, resultado e a variação de cada categoria de gasto (B menos A).",
      esquema: z.object({
        periodoA: periodo.describe("Período de referência (o mais antigo)"),
        periodoB: periodo.describe("Período comparado (o mais recente)"),
      }),
      async executar({ periodoA, periodoB }) {
        const [a, b] = await Promise.all([totais(periodoA), totais(periodoB)]);
        const lado = (t: Totais, p: PeriodoDoPainel) => ({
          periodo: p,
          entradas: reais(t.entradas),
          saidas: reais(t.saidas),
          resultado: reais(t.entradas - t.saidas),
        });
        const gastos = new Map<string, { a: Centavos; b: Centavos }>();
        for (const g of a.r.gastosPorCategoria)
          gastos.set(g.nome, { a: g.totalCentavos, b: 0 });
        for (const g of b.r.gastosPorCategoria)
          gastos.set(g.nome, {
            a: gastos.get(g.nome)?.a ?? 0,
            b: g.totalCentavos,
          });
        return {
          a: lado(a, periodoA),
          b: lado(b, periodoB),
          variacaoPorCategoria: [...gastos]
            .map(([categoria, v]) => ({
              categoria,
              gastoEmA: reais(v.a),
              gastoEmB: reais(v.b),
              diferenca: reais(v.b - v.a),
            }))
            .sort((x, y) => Math.abs(y.diferenca) - Math.abs(x.diferenca)),
        };
      },
    }),

    ferramenta({
      nome: "maiores_gastos",
      descricao:
        "As maiores saídas individuais de um período, com data, descrição, quem recebeu e categoria. " +
        "Não inclui transferências entre contas próprias, pendentes nem ocultas.",
      esquema: periodo.extend({
        quantidade: z
          .number()
          .int()
          .min(1)
          .max(MAXIMO_DE_MAIORES_GASTOS)
          .default(10)
          .describe("Quantas transações devolver (padrão 10, máximo 20)"),
      }),
      async executar({ de, ate, quantidade }) {
        const categorias = new Map(
          (await deps.categorias()).map((c) => [c.id, c]),
        );
        const saidas = [];
        let cursor: string | undefined;
        let incompleto = false;
        // ponytail: ordena em memória até 1.000 saídas do período; se passar disso, avisa em
        // `incompleto`. Trocar por ordenação no banco se os períodos consultados crescerem.
        for (let pagina = 0; pagina < PAGINAS_NO_MAXIMO; pagina++) {
          const r = await deps.extrato.listar(ctx, {
            dataDe: de,
            dataAte: ate,
            sentido: "saida",
            limite: PAGINA,
            cursor,
          });
          saidas.push(...r.itens);
          if (!r.proximoCursor) break;
          cursor = r.proximoCursor;
          incompleto = pagina === PAGINAS_NO_MAXIMO - 1;
        }
        const categoriaDe = (id: string | null) =>
          id ? categorias.get(id) : undefined;
        return {
          periodo: { de, ate },
          incompleto,
          gastos: saidas
            .filter(
              (t) =>
                !t.pendente &&
                !t.oculta &&
                (categoriaDe(t.categoriaId)?.entraNoResultado ?? true),
            )
            .sort((x, y) => x.valorCentavos - y.valorCentavos)
            .slice(0, quantidade)
            .map((t) => ({
              data: t.data,
              descricao: t.descricao,
              paraQuem: t.contraparte,
              valor: reais(-t.valorCentavos),
              categoria: categoriaDe(t.categoriaId)?.nome ?? null,
            })),
        };
      },
    }),

    ferramenta({
      nome: "buscar_transacoes",
      descricao:
        "Lista transações do extrato, das mais recentes para as mais antigas, filtrando por texto " +
        "(descrição ou nome de quem pagou/recebeu), período, categoria e tipo. " +
        "Valor positivo é entrada e negativo é saída.",
      esquema: z.object({
        texto: z
          .string()
          .trim()
          .max(100)
          .optional()
          .describe("Trecho da descrição ou do nome, ex.: 'posto'"),
        de: data.optional(),
        ate: data.optional(),
        categoria: z
          .string()
          .trim()
          .max(60)
          .optional()
          .describe(
            "Nome exato de uma categoria existente, ou 'sem categoria'",
          ),
        tipo: z.enum(["entrada", "saida"]).optional(),
        quantidade: z
          .number()
          .int()
          .min(1)
          .max(MAXIMO_DE_TRANSACOES_NA_BUSCA)
          .default(20)
          .describe("Quantas transações devolver (padrão 20, máximo 50)"),
      }),
      async executar({ texto, de, ate, categoria, tipo, quantidade }) {
        const categorias = await deps.categorias();
        const nome = new Map(categorias.map((c) => [c.id, c.nome]));
        let categoriaId: string | undefined;
        if (categoria) {
          const alvo = categoria.toLowerCase();
          categoriaId =
            alvo === "sem categoria"
              ? "sem_categoria"
              : categorias.find((c) => c.nome.toLowerCase() === alvo)?.id;
          if (!categoriaId)
            return {
              erro: "Categoria não encontrada.",
              categoriasExistentes: categorias
                .filter((c) => !c.arquivada)
                .map((c) => c.nome),
            };
        }
        const r = await deps.extrato.listar(ctx, {
          busca: texto,
          dataDe: de,
          dataAte: ate,
          categoriaId,
          sentido: tipo,
          limite: quantidade,
        });
        return {
          haMaisResultados: r.proximoCursor !== null,
          transacoes: r.itens.map((t) => ({
            data: t.data,
            descricao: t.descricao,
            quem: t.contraparte,
            valor: reais(t.valorCentavos),
            categoria: t.categoriaId ? (nome.get(t.categoriaId) ?? null) : null,
            pendente: t.pendente,
          })),
        };
      },
    }),
  ];
}
