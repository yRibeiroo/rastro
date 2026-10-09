/**
 * Dados falsos do protótipo (Fase 2.1): HOMETEC SERVIÇOS, prestadora de serviços em Palmas (TO).
 * Determinísticos (semente fixa), datas relativas a hoje no fuso de Araguaína.
 * Mutáveis de propósito: as ações simuladas alteram estes arrays para o protótipo "lembrar"
 * das mudanças entre telas. Some quando o backend ligar os serviços reais.
 */
import { hojeISO, somarDias } from "@/ferramentas-internas/formatar-data";
import type {
  Anexo,
  Categoria,
  CentroDeCusto,
  Conexao,
  Conta,
  OrigemDaCategoria,
  Regra,
  Transacao,
} from "./tipos-provisorios";

export const EMPRESA_ID = "6f1c2a40-0000-4000-8000-000000000001";
const CONEXAO_ID = "6f1c2a40-0000-4000-8000-0000000000c1";
const CONTA_ID = "6f1c2a40-0000-4000-8000-0000000000a1";

const agora = new Date();
const minutosAtras = (m: number) => new Date(agora.getTime() - m * 60_000);
const hoje = hojeISO(agora);

// ── Categorias ──────────────────────────────────────────────────────────────
const cat = (id: string, nome: string, tipo: Categoria["tipo"], extra: Partial<Categoria> = {}): Categoria => ({
  id,
  empresaId: EMPRESA_ID,
  nome,
  tipo,
  entraNoResultado: true,
  padrao: true,
  arquivada: false,
  ...extra,
});

export const categorias: Categoria[] = [
  cat("cat-receita", "Receita de serviços", "entrada"),
  cat("cat-combustivel", "Combustível", "saida"),
  cat("cat-material-eletrico", "Material elétrico", "saida"),
  cat("cat-pecas-refrigeracao", "Peças de refrigeração", "saida"),
  cat("cat-extintores", "Extintores e recarga", "saida"),
  cat("cat-impostos", "Impostos", "saida"),
  cat("cat-folha", "Folha de pagamento", "saida"),
  cat("cat-tarifas", "Tarifas bancárias", "saida"),
  cat("cat-ferramentas", "Ferramentas", "saida"),
  cat("cat-alimentacao", "Alimentação", "saida", { padrao: false }),
  cat("cat-transferencia", "Transferência entre contas", "ambos", { entraNoResultado: false }),
  cat("cat-outros", "Outros", "ambos"),
  cat("cat-aluguel", "Aluguel de andaime", "saida", { padrao: false, arquivada: true }),
];

// ── Centros de custo ────────────────────────────────────────────────────────
const centro = (id: string, nome: string): CentroDeCusto => ({ id, empresaId: EMPRESA_ID, nome, padrao: true, arquivado: false });

export const centrosDeCusto: CentroDeCusto[] = [
  centro("cc-ar", "Ar-condicionado/Refrigeração"),
  centro("cc-eletrica", "Elétrica"),
  centro("cc-incendio", "Prevenção contra incêndio"),
  centro("cc-adm", "Administrativo"),
];

// ── Regras ──────────────────────────────────────────────────────────────────
const regra = (
  id: string,
  padrao: string,
  categoriaId: string,
  centroDeCustoId: string | null,
  prioridade: number,
  extra: Partial<Regra> = {},
): Regra => ({
  id,
  empresaId: EMPRESA_ID,
  padrao,
  campo: "descricao",
  prioridade,
  categoriaId,
  centroDeCustoId,
  origem: "padrao",
  ativa: true,
  criadaEm: new Date("2026-04-02T13:00:00-03:00"),
  ...extra,
});

export const regras: Regra[] = [
  regra("re-posto", "POSTO", "cat-combustivel", null, 10),
  regra("re-darf", "DARF", "cat-impostos", "cc-adm", 10),
  regra("re-das", "DAS SIMPLES", "cat-impostos", "cc-adm", 10),
  regra("re-tarifa", "TARIFA", "cat-tarifas", "cc-adm", 20),
  regra("re-alfa", "CONDOMINIO RESIDENCIAL ALFA", "cat-receita", "cc-ar", 30, { campo: "contraparte", origem: "usuario" }),
  regra("re-eletronorte", "ELETRO NORTE", "cat-material-eletrico", "cc-eletrica", 40, { origem: "correcao" }),
  regra("re-frio", "FRIO PECAS", "cat-pecas-refrigeracao", "cc-ar", 40, { origem: "correcao" }),
  regra("re-extintor", "EXTINTORES", "cat-extintores", "cc-incendio", 40, { origem: "correcao", ativa: false }),
];

// ── Conexão e conta ─────────────────────────────────────────────────────────
export const conexoes: Conexao[] = [
  {
    id: CONEXAO_ID,
    empresaId: EMPRESA_ID,
    provedor: "pluggy",
    idExterno: "b7d0e1f4-3c2a-4d8e-9f10-2a3b4c5d6e7f",
    banco: "Sicredi Empresas",
    status: "atualizada",
    erro: null,
    consentimentoExpiraEm: new Date(`${somarDias(hoje, 5)}T23:59:00-03:00`),
    ultimaSincronizacaoEm: minutosAtras(4),
    criadaEm: new Date("2026-04-02T13:00:00-03:00"),
    atualizadaEm: minutosAtras(4),
  },
];

// ── Transações ──────────────────────────────────────────────────────────────
/** PRNG com semente (mulberry32): mesmos dados a cada execução. */
function aleatorio(semente: number) {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sortear = aleatorio(20261009);
const entre = (min: number, max: number) => Math.round((min + sortear() * (max - min)) / 10) * 10;

type Modelo = {
  descricao: string;
  contraparte: string | null;
  metodo: string;
  faixa: [number, number]; // centavos, sinal define entrada/saída
  categoriaId: string | null;
  centroDeCustoId: string | null;
  origem: OrigemDaCategoria | null;
  regraId?: string;
  vezesPorMes: number;
  categoriaDoProvedor?: string;
};

const MODELOS: Modelo[] = [
  { descricao: "PIX RECEBIDO CONDOMINIO RESIDENCIAL ALFA", contraparte: "CONDOMINIO RESIDENCIAL ALFA", metodo: "PIX", faixa: [380000, 630000], categoriaId: "cat-receita", centroDeCustoId: "cc-ar", origem: "regra", regraId: "re-alfa", vezesPorMes: 1 },
  { descricao: "PIX RECEBIDO COND EDIFICIO PALMAS CENTER", contraparte: "CONDOMINIO EDIFICIO PALMAS CENTER", metodo: "PIX", faixa: [210000, 320000], categoriaId: "cat-receita", centroDeCustoId: "cc-eletrica", origem: "ia", vezesPorMes: 1 },
  { descricao: "TED RECEBIDA HOSPITAL SAO LUCAS GURUPI", contraparte: "HOSPITAL SAO LUCAS LTDA", metodo: "TED", faixa: [180000, 260000], categoriaId: "cat-receita", centroDeCustoId: "cc-incendio", origem: "usuario", vezesPorMes: 1 },
  { descricao: "PIX RECEBIDO ESCOLA SESI PALMAS", contraparte: "SERVICO SOCIAL DA INDUSTRIA", metodo: "PIX", faixa: [90000, 190000], categoriaId: "cat-receita", centroDeCustoId: "cc-ar", origem: "ia", vezesPorMes: 1 },
  { descricao: "PIX RECEBIDO MARIA DAS GRACAS SOUSA", contraparte: "MARIA DAS GRACAS SOUSA", metodo: "PIX", faixa: [45000, 85000], categoriaId: "cat-receita", centroDeCustoId: "cc-eletrica", origem: "usuario", vezesPorMes: 1 },
  { descricao: "POSTO TOCANTINS LTDA", contraparte: "POSTO TOCANTINS LTDA", metodo: "DEBITO", faixa: [-32000, -18000], categoriaId: "cat-combustivel", centroDeCustoId: null, origem: "regra", regraId: "re-posto", vezesPorMes: 3 },
  { descricao: "POSTO SHELL QD 104 SUL", contraparte: "AUTO POSTO 104 SUL LTDA", metodo: "DEBITO", faixa: [-26000, -15000], categoriaId: "cat-combustivel", centroDeCustoId: null, origem: "regra", regraId: "re-posto", vezesPorMes: 1 },
  { descricao: "ELETRO NORTE MAT ELETRICOS", contraparte: "ELETRO NORTE COMERCIO LTDA", metodo: "BOLETO", faixa: [-120000, -40000], categoriaId: "cat-material-eletrico", centroDeCustoId: "cc-eletrica", origem: "regra", regraId: "re-eletronorte", vezesPorMes: 1 },
  { descricao: "FRIO PECAS REFRIGERACAO", contraparte: "FRIO PECAS E REFRIGERACAO EIRELI", metodo: "PIX", faixa: [-90000, -30000], categoriaId: "cat-pecas-refrigeracao", centroDeCustoId: "cc-ar", origem: "regra", regraId: "re-frio", vezesPorMes: 1 },
  { descricao: "EXTINTORES TOCANTINS RECARGA", contraparte: "EXTINTORES TOCANTINS LTDA", metodo: "PIX", faixa: [-70000, -30000], categoriaId: "cat-extintores", centroDeCustoId: "cc-incendio", origem: "usuario", vezesPorMes: 1 },
  { descricao: "PAGAMENTO DARF", contraparte: "RECEITA FEDERAL", metodo: "BOLETO", faixa: [-125000, -95000], categoriaId: "cat-impostos", centroDeCustoId: "cc-adm", origem: "regra", regraId: "re-darf", vezesPorMes: 1 },
  { descricao: "DAS SIMPLES NACIONAL", contraparte: "RECEITA FEDERAL", metodo: "BOLETO", faixa: [-98000, -82000], categoriaId: "cat-impostos", centroDeCustoId: "cc-adm", origem: "regra", regraId: "re-das", vezesPorMes: 1 },
  { descricao: "TARIFA PACOTE DE SERVICOS", contraparte: null, metodo: "TARIFA", faixa: [-5990, -5990], categoriaId: "cat-tarifas", centroDeCustoId: "cc-adm", origem: "regra", regraId: "re-tarifa", vezesPorMes: 1 },
  { descricao: "PIX ENVIADO RAIMUNDO NONATO ALVES", contraparte: "RAIMUNDO NONATO ALVES", metodo: "PIX", faixa: [-195000, -195000], categoriaId: "cat-folha", centroDeCustoId: "cc-adm", origem: "usuario", vezesPorMes: 1 },
  { descricao: "PIX ENVIADO FRANCISCO DAS CHAGAS LIMA", contraparte: "FRANCISCO DAS CHAGAS LIMA", metodo: "PIX", faixa: [-180000, -180000], categoriaId: "cat-folha", centroDeCustoId: "cc-adm", origem: "usuario", vezesPorMes: 1 },
  { descricao: "RESTAURANTE SABOR DO CERRADO", contraparte: "SABOR DO CERRADO REFEICOES", metodo: "DEBITO", faixa: [-9000, -3500], categoriaId: "cat-alimentacao", centroDeCustoId: null, origem: "ia", vezesPorMes: 2, categoriaDoProvedor: "Eating out" },
  { descricao: "MERCADOLIVRE*FERRAMENTAS", contraparte: "MERCADO LIVRE", metodo: "CARTAO", faixa: [-45000, -12000], categoriaId: "cat-ferramentas", centroDeCustoId: null, origem: "pluggy", vezesPorMes: 1, categoriaDoProvedor: "Online shopping" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function gerarTransacoes(): Transacao[] {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const itens: Transacao[] = [];
  let n = 0;
  for (let voltar = 5; voltar >= 0; voltar--) {
    const d = new Date(Date.UTC(ano, mes - 1 - voltar, 1));
    const a = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const ultimoDia = voltar === 0 ? dia : new Date(Date.UTC(a, m, 0)).getUTCDate();
    for (const modelo of MODELOS) {
      for (let v = 0; v < modelo.vezesPorMes; v++) {
        const diaDoMes = 1 + Math.floor(sortear() * 28);
        if (diaDoMes > ultimoDia) continue;
        n++;
        const data = `${a}-${pad(m)}-${pad(diaDoMes)}`;
        const instante = new Date(`${data}T${pad(8 + (n % 10))}:${pad((n * 7) % 60)}:00-03:00`);
        const valor = entre(...modelo.faixa);
        itens.push({
          id: `6f1c2a40-0000-4000-9000-${String(n).padStart(12, "0")}`,
          empresaId: EMPRESA_ID,
          conexaoId: CONEXAO_ID,
          contaId: CONTA_ID,
          idExterno: `px-${n}`,
          data,
          descricao: modelo.descricao,
          descricaoOriginal: modelo.descricao,
          valorCentavos: valor,
          pendente: false,
          contraparte: modelo.contraparte,
          metodoDePagamento: modelo.metodo,
          categoriaDoProvedor: modelo.categoriaDoProvedor ?? null,
          categoriaId: modelo.categoriaId,
          centroDeCustoId: modelo.centroDeCustoId,
          categoriaOrigem: modelo.origem,
          categoriaDefinidaPeloUsuario: modelo.origem === "usuario",
          regraId: modelo.regraId ?? null,
          confiancaIa: modelo.origem === "ia" ? Math.round((0.7 + sortear() * 0.28) * 100) / 100 : null,
          categorizacaoAutomaticaEm: modelo.origem === "usuario" ? null : instante,
          criadaEm: instante,
          atualizadaEm: instante,
        });
      }
    }
  }

  // Casos especiais que as telas precisam mostrar.
  const especial = (id: string, data: string, descricao: string, contraparte: string | null, valor: number, extra: Partial<Transacao>): Transacao => ({
    ...itens[0],
    id,
    idExterno: id,
    data,
    descricao,
    descricaoOriginal: descricao,
    contraparte,
    valorCentavos: valor,
    metodoDePagamento: "PIX",
    categoriaDoProvedor: null,
    categoriaId: null,
    centroDeCustoId: null,
    categoriaOrigem: null,
    categoriaDefinidaPeloUsuario: false,
    regraId: null,
    confiancaIa: null,
    categorizacaoAutomaticaEm: minutosAtras(30),
    criadaEm: minutosAtras(40),
    atualizadaEm: minutosAtras(40),
    ...extra,
  });
  itens.push(
    // Sem categoria (a IA não soube): alvo do fluxo "corrigir e criar regra".
    especial("6f1c2a40-0000-4000-9000-900000000001", somarDias(hoje, -1), "JK COMBUSTIVEIS PARAISO TO", "POSTO JK COMBUSTIVEIS LTDA", -27840, {
      metodoDePagamento: "DEBITO",
      categoriaId: "cat-outros",
      categoriaOrigem: "ia",
      confiancaIa: 0.41,
    }),
    especial("6f1c2a40-0000-4000-9000-900000000002", somarDias(hoje, -2), "PIX ENVIADO JOSE RIBAMAR COSTA", "JOSE RIBAMAR COSTA", -35000, {}),
    especial("6f1c2a40-0000-4000-9000-900000000003", somarDias(hoje, -3), "SAQUE TERMINAL 24H", null, -20000, { metodoDePagamento: "SAQUE" }),
    // Aguardando a IA (estado "categorizando").
    especial("6f1c2a40-0000-4000-9000-900000000004", hoje, "PIX ENVIADO REFRIGERACAO PALMAS SUL", "REFRIGERACAO PALMAS SUL LTDA", -64500, {
      categorizacaoAutomaticaEm: null,
    }),
    especial("6f1c2a40-0000-4000-9000-900000000005", hoje, "PIX RECEBIDO CONDOMINIO VILLAGE DO LAGO", "CONDOMINIO VILLAGE DO LAGO", 280000, {
      categorizacaoAutomaticaEm: null,
    }),
    // Pendente no banco (não entra no painel).
    especial("6f1c2a40-0000-4000-9000-900000000006", hoje, "COMPRA CARTAO LEROY MERLIN", "LEROY MERLIN", -18990, {
      pendente: true,
      metodoDePagamento: "CARTAO",
      categoriaId: "cat-ferramentas",
      categoriaOrigem: "ia",
      confiancaIa: 0.88,
    }),
    // Transferência: não entra no resultado.
    especial("6f1c2a40-0000-4000-9000-900000000007", somarDias(hoje, -6), "TRANSF ENTRE CONTAS POUPANCA", "HOMETEC SERVICOS LTDA", -500000, {
      metodoDePagamento: "TED",
      categoriaId: "cat-transferencia",
      categoriaOrigem: "usuario",
      categoriaDefinidaPeloUsuario: true,
    }),
  );

  return itens.sort((x, y) => (x.data === y.data ? y.criadaEm.getTime() - x.criadaEm.getTime() : x.data < y.data ? 1 : -1));
}

export const transacoes: Transacao[] = gerarTransacoes();

const saldoInicial = 1_240_000;
export const contas: Conta[] = [
  {
    id: CONTA_ID,
    empresaId: EMPRESA_ID,
    conexaoId: CONEXAO_ID,
    idExterno: "acc-4821",
    nome: "Conta Corrente PJ",
    tipo: "corrente",
    numeroFinal: "4821",
    saldoCentavos: saldoInicial + transacoes.filter((t) => !t.pendente).reduce((s, t) => s + t.valorCentavos, 0),
    saldoAtualizadoEm: minutosAtras(4),
  },
];

// ── Anexos ──────────────────────────────────────────────────────────────────
const comNota = transacoes.filter((t) => t.descricao.startsWith("ELETRO NORTE")).slice(0, 2);
export const anexos: Anexo[] = comNota.map((t, i) => ({
  id: `6f1c2a40-0000-4000-a000-${String(i + 1).padStart(12, "0")}`,
  empresaId: EMPRESA_ID,
  transacaoId: t.id,
  caminho: `anexos/${EMPRESA_ID}/${t.id}/nf-${i + 1}.pdf`,
  nomeArquivo: `NF-e ${48213 + i} Eletro Norte.pdf`,
  tipoMime: "application/pdf",
  tamanhoBytes: 182_340 + i * 9_120,
  criadoEm: t.criadaEm,
}));
