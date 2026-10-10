import "server-only";
import { AutenticacaoSupabase } from "@/acesso-a-dados/autenticacao-supabase";
import type {
  RepositorioDeEventosDeWebhook,
  RepositorioDeLimites,
} from "@/acesso-a-dados/contratos";
import {
  ArmazenamentoDeArquivosSupabase,
  RepositorioDeAnexosSupabase,
} from "@/acesso-a-dados/repositorio-de-anexos";
import {
  RepositorioDeCategoriasSupabase,
  RepositorioDeCentrosDeCustoSupabase,
} from "@/acesso-a-dados/repositorio-de-categorias";
import { RepositorioDeConexoesSupabase } from "@/acesso-a-dados/repositorio-de-conexoes";
import { RepositorioDeContasSupabase } from "@/acesso-a-dados/repositorio-de-contas";
import { RepositorioDeEmpresasSupabase } from "@/acesso-a-dados/repositorio-de-empresas";
import {
  RepositorioDeEventosDeWebhookSupabase,
  RepositorioDeLimitesSupabase,
  RepositorioDoPainelSupabase,
} from "@/acesso-a-dados/repositorio-de-infraestrutura";
import { RepositorioDeRegrasSupabase } from "@/acesso-a-dados/repositorio-de-regras";
import { RepositorioDeTransacoesSupabase } from "@/acesso-a-dados/repositorio-de-transacoes";
import { clienteDoSistema } from "@/acesso-a-dados/supabase/cliente-do-sistema";
import {
  clienteDoUsuario,
  type ClienteDoBanco,
} from "@/acesso-a-dados/supabase/cliente-do-usuario";
import { ambiente } from "@/configuracao/ambiente";
import {
  criarServicoDeAcesso,
  type ConsumirLimite,
  type ServicoDeAcesso,
} from "./acesso";
import { criarServicoDeAnexos, type ServicoDeAnexos } from "./anexos";
import {
  classificadorClaude,
  criarServicoDeCategorizacao,
  EstrategiaPorCategoriaDoProvedor,
  EstrategiaPorIa,
  EstrategiaPorRegras,
  type ServicoDeCategorizacao,
} from "./categorizacao";
import {
  criarServicoDeCentrosDeCusto,
  type ServicoDeCentrosDeCusto,
} from "./centros-de-custo";
import {
  criarServicoDeConexaoBancaria,
  provedorPluggy,
  type ProvedorBancario,
  type ServicoDeConexaoBancaria,
} from "./conexao-bancaria";
import {
  criarServicoDeExtrato,
  criarServicoDeSincronizacao,
  type ServicoDeExtrato,
  type ServicoDeSincronizacao,
} from "./extrato";
import { criarServicoDoPainel, type ServicoDoPainel } from "./painel";
import type { ContextoDoUsuario } from "./tipos";

// Raiz de composição (contratos.md §11): o único lugar que instancia repositórios,
// adaptadores e serviços. Os testes trocam as peças chamando as fábricas criar*().

export interface ServicosDoUsuario {
  ctx: ContextoDoUsuario;
  conexoes: ServicoDeConexaoBancaria;
  extrato: ServicoDeExtrato;
  sincronizacao: Pick<ServicoDeSincronizacao, "sincronizarAgora">;
  categorizacao: ServicoDeCategorizacao;
  centrosDeCusto: ServicoDeCentrosDeCusto;
  painel: ServicoDoPainel;
  anexos: ServicoDeAnexos;
}

export interface ServicosDoSistema {
  provedor: ProvedorBancario;
  eventos: RepositorioDeEventosDeWebhook;
  sincronizacao: ServicoDeSincronizacao;
  limites: RepositorioDeLimites;
  limpeza(): Promise<void>; // eventos > 90 dias, limites > 1 dia
}

const DIA_EM_MS = 86_400_000;

const consumidorDeLimite =
  (limites: RepositorioDeLimites): ConsumirLimite =>
  (chave, limite) =>
    limites.consumir(chave, limite.maximo, limite.janelaEmSegundos);

/** O Classificador só lê a chave da Anthropic quando a IA é chamada de fato. */
const estrategiaPorIa = new EstrategiaPorIa({
  classificar: (lote, opcoes) =>
    classificadorClaude({
      apiKey: ambiente.ANTHROPIC_API_KEY,
      modelo: ambiente.ANTHROPIC_MODELO,
    }).classificar(lote, opcoes),
});

function categorizacaoCom(banco: ClienteDoBanco): ServicoDeCategorizacao {
  return criarServicoDeCategorizacao({
    transacoes: new RepositorioDeTransacoesSupabase(banco),
    regras: new RepositorioDeRegrasSupabase(banco),
    categorias: new RepositorioDeCategoriasSupabase(banco),
    centrosDeCusto: new RepositorioDeCentrosDeCustoSupabase(banco),
    estrategias: [
      new EstrategiaPorRegras(),
      new EstrategiaPorCategoriaDoProvedor(),
      estrategiaPorIa,
    ],
    iaLigada: () => ambiente.RECURSO_CATEGORIZACAO_IA,
  });
}

function acessoCom(banco: ClienteDoBanco): ServicoDeAcesso {
  return criarServicoDeAcesso({
    // Mesmo cliente: a sessão trocada no callback vale para o garantir_empresa.
    autenticacao: new AutenticacaoSupabase(banco),
    empresas: new RepositorioDeEmpresasSupabase(banco),
    consumirLimite: consumidorDeLimite(
      new RepositorioDeLimitesSupabase(clienteDoSistema()),
    ),
    emailsAutorizados: () => ambiente.EMAIL_AUTORIZADO,
    urlDoSite: () => ambiente.URL_DO_SITE,
  });
}

/** Funções de acesso (contratos.md §9) ligadas ao cliente com cookies desta requisição. */
export async function servicoDeAcesso(): Promise<ServicoDeAcesso> {
  return acessoCom(await clienteDoUsuario());
}

let sistema: ServicosDoSistema | undefined;

/** Service role. Só para webhook, cron, rate limit e as escritas da sincronização. */
export function servicosDoSistema(): ServicosDoSistema {
  if (sistema) return sistema;
  const banco = clienteDoSistema();
  const provedor = provedorPluggy(() => ({
    clientId: ambiente.PLUGGY_CLIENT_ID,
    clientSecret: ambiente.PLUGGY_CLIENT_SECRET,
  }));
  const eventos = new RepositorioDeEventosDeWebhookSupabase(banco);
  const limites = new RepositorioDeLimitesSupabase(banco);
  const sincronizacao = criarServicoDeSincronizacao({
    provedor,
    conexoes: new RepositorioDeConexoesSupabase(banco),
    contas: new RepositorioDeContasSupabase(banco),
    transacoes: new RepositorioDeTransacoesSupabase(banco),
    eventos,
    empresas: new RepositorioDeEmpresasSupabase(banco),
    categorizacao: categorizacaoCom(banco),
    consumirLimite: consumidorDeLimite(limites),
  });
  sistema = {
    provedor,
    eventos,
    sincronizacao,
    limites,
    async limpeza() {
      const agora = Date.now();
      await eventos.removerAntigos(new Date(agora - 90 * DIA_EM_MS));
      await limites.removerAntigos(new Date(agora - DIA_EM_MS));
    },
  };
  return sistema;
}

/** Cliente com cookies (RLS). Chama obterContextoDoUsuario() — lança se não autenticado/autorizado. */
export async function servicosDoUsuario(): Promise<ServicosDoUsuario> {
  const banco = await clienteDoUsuario();
  const ctx = await acessoCom(banco).obterContextoDoUsuario();
  const doSistema = servicosDoSistema();
  const consumirLimite = consumidorDeLimite(doSistema.limites);
  const transacoes = new RepositorioDeTransacoesSupabase(banco);
  return {
    ctx,
    conexoes: criarServicoDeConexaoBancaria({
      provedor: doSistema.provedor,
      // conexoes não aceita insert pela sessão (RLS): service role, sempre filtrado por ctx.empresaId.
      conexoes: new RepositorioDeConexoesSupabase(clienteDoSistema()),
      consumirLimite,
    }),
    extrato: criarServicoDeExtrato({ transacoes }),
    sincronizacao: {
      sincronizarAgora: (c, id) =>
        doSistema.sincronizacao.sincronizarAgora(c, id),
    },
    categorizacao: categorizacaoCom(banco),
    centrosDeCusto: criarServicoDeCentrosDeCusto({
      centrosDeCusto: new RepositorioDeCentrosDeCustoSupabase(banco),
    }),
    painel: criarServicoDoPainel({
      painel: new RepositorioDoPainelSupabase(banco),
      contas: new RepositorioDeContasSupabase(banco),
      transacoes,
    }),
    anexos: criarServicoDeAnexos({
      anexos: new RepositorioDeAnexosSupabase(banco),
      armazenamento: new ArmazenamentoDeArquivosSupabase(banco),
      transacoes,
      consumirLimite,
      anexosLigados: () => ambiente.RECURSO_ANEXOS,
    }),
  };
}
