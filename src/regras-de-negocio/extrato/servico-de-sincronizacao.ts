import "server-only";
import { z } from "zod";
import type {
  RepositorioDeConexoes,
  RepositorioDeContas,
  RepositorioDeEmpresas,
  RepositorioDeEventosDeWebhook,
  RepositorioDeTransacoes,
} from "@/acesso-a-dados/contratos";
import { exigirLimite, LIMITES, type ConsumirLimite } from "../acesso";
import {
  conexaoNaoEncontrada,
  type ConexaoDoProvedor,
  type EventoDeWebhook,
  type FiltrosDeTransacoesDoProvedor,
  type ProvedorBancario,
} from "../conexao-bancaria";
import { ErroDeNegocio, registrarFalha } from "../erros";
import type { Conexao, Conta, ContextoDoUsuario, Id } from "../tipos";

export interface ServicoDeSincronizacao {
  /** Chamado dentro de after() no webhook. Nunca lança: registra erro em eventos_webhook e no log. */
  processarEvento(evento: EventoDeWebhook): Promise<void>;

  /** Sincroniza contas (saldo) e transações de uma conexão. Sem criadasDesde => histórico completo.
   *  Ao final: marcarSincronizada e categorizacao.categorizarPendentes(empresaId). */
  sincronizarConexao(
    conexaoIdExterno: string,
    opcoes?: { criadasDesde?: Date },
  ): Promise<{ transacoesGravadas: number }>;

  /** Usado pelo cron diário: todas as conexões, criadasDesde = agora − 7 dias. */
  ressincronizarTodas(): Promise<{ conexoes: number; falhas: number }>;

  /** Botão "Sincronizar agora". Rate limit 6/h por usuário. */
  sincronizarAgora(
    ctx: ContextoDoUsuario,
    conexaoId: Id,
  ): Promise<{ transacoesGravadas: number }>;
}

const DIA_EM_MS = 86_400_000;
export const TAMANHO_DO_LOTE_DE_IDS = 500;

/** Status vindos do item/error que já dizem o que fazer; o resto vira 'erro'. */
const STATUS_ESPECIFICOS_DE_ERRO = new Set([
  "erro_de_login",
  "aguardando_usuario",
  "desatualizada",
]);

export function criarServicoDeSincronizacao(deps: {
  provedor: ProvedorBancario;
  // Todos com service role: a sincronização grava em tabelas sem insert para authenticated.
  conexoes: RepositorioDeConexoes;
  contas: RepositorioDeContas;
  transacoes: RepositorioDeTransacoes;
  eventos: RepositorioDeEventosDeWebhook;
  empresas: Pick<RepositorioDeEmpresas, "existe">;
  categorizacao: { categorizarPendentes(empresaId: Id): Promise<unknown> };
  consumirLimite: ConsumirLimite;
  agora?: () => Date;
}): ServicoDeSincronizacao {
  const agora = deps.agora ?? (() => new Date());

  async function obterDoProvedor(
    idExterno: string,
  ): Promise<ConexaoDoProvedor> {
    const doProvedor = await deps.provedor.obterConexao(idExterno);
    if (!doProvedor) throw conexaoNaoEncontrada();
    return doProvedor;
  }

  /**
   * A conexão salva, criando-a se o webhook chegou antes do registrarConexao.
   * Nesse caso a empresa vem do clientUserId (= empresaId do token), validado contra `empresas`.
   */
  async function garantirConexao(
    idExterno: string,
    doProvedor?: ConexaoDoProvedor,
  ): Promise<Conexao> {
    const salva = await deps.conexoes.buscarPorIdExterno(idExterno);
    if (salva) return salva;
    const dados = doProvedor ?? (await obterDoProvedor(idExterno));
    const empresaId = dados.identificadorDoUsuario;
    if (
      !empresaId ||
      !z.uuid().safeParse(empresaId).success ||
      !(await deps.empresas.existe(empresaId))
    )
      throw conexaoNaoEncontrada();
    return deps.conexoes.salvar(
      empresaId,
      {
        idExterno: dados.idExterno,
        banco: dados.banco,
        status: dados.status,
        erro: dados.erro,
        consentimentoExpiraEm: dados.consentimentoExpiraEm,
      },
      null,
    );
  }

  /** GET /items/{id} é a fonte da verdade do status (ADR 0007). */
  async function atualizarStatus(
    conexao: Conexao,
    doProvedor: ConexaoDoProvedor,
    sobrescrever?: Partial<Pick<ConexaoDoProvedor, "status" | "erro">>,
  ): Promise<ConexaoDoProvedor> {
    const dados = { ...doProvedor, ...sobrescrever };
    await deps.conexoes.atualizarStatus(conexao.empresaId, conexao.id, {
      status: dados.status,
      erro: dados.erro,
      consentimentoExpiraEm: dados.consentimentoExpiraEm,
    });
    return dados;
  }

  /** Atualiza saldos e devolve só as contas correntes (P-04), por idExterno. */
  async function sincronizarContas(
    conexao: Conexao,
  ): Promise<Map<string, Conta>> {
    const contas = (await deps.provedor.listarContas(conexao.idExterno)).filter(
      (c) => c.tipo === "corrente",
    );
    const salvas = contas.length
      ? await deps.contas.salvarVarias(conexao.empresaId, conexao.id, contas)
      : [];
    return new Map(salvas.map((c) => [c.idExterno, c]));
  }

  /** Percorre todas as páginas e grava; nunca toca nas colunas de categoria. */
  async function gravarTransacoes(
    conexao: Conexao,
    conta: Conta,
    filtros?: FiltrosDeTransacoesDoProvedor,
  ): Promise<number> {
    let total = 0;
    let cursor: string | undefined;
    do {
      const pagina = await deps.provedor.listarTransacoes(conta.idExterno, {
        ...filtros,
        cursor,
      } as FiltrosDeTransacoesDoProvedor);
      // valor = 0 não é movimento (e o banco recusa); contas diferentes não entram nesta.
      const linhas = pagina.itens
        .filter(
          (t) => t.valorCentavos !== 0 && t.contaIdExterno === conta.idExterno,
        )
        .map((t) => ({ ...t, contaId: conta.id }));
      if (linhas.length)
        total += await deps.transacoes.salvarDoProvedor(
          conexao.empresaId,
          conexao.id,
          linhas,
        );
      cursor = pagina.proximoCursor ?? undefined;
    } while (cursor);
    return total;
  }

  async function categorizarSemQuebrar(empresaId: Id) {
    try {
      await deps.categorizacao.categorizarPendentes(empresaId);
    } catch (erro) {
      // A categorização nunca derruba a sincronização: fica pendente para a próxima.
      registrarFalha("categorização após sincronizar", erro);
    }
  }

  async function sincronizar(
    conexao: Conexao,
    criadasDesde?: Date,
  ): Promise<{ transacoesGravadas: number }> {
    const contas = await sincronizarContas(conexao);
    let transacoesGravadas = 0;
    for (const conta of contas.values())
      transacoesGravadas += await gravarTransacoes(
        conexao,
        conta,
        criadasDesde ? { criadasDesde } : undefined,
      );
    await deps.conexoes.marcarSincronizada(
      conexao.empresaId,
      conexao.id,
      agora(),
    );
    await categorizarSemQuebrar(conexao.empresaId);
    return { transacoesGravadas };
  }

  async function sincronizarConexao(
    conexaoIdExterno: string,
    opcoes?: { criadasDesde?: Date },
  ) {
    const conexao = await deps.conexoes.buscarPorIdExterno(conexaoIdExterno);
    if (!conexao) throw conexaoNaoEncontrada();
    return sincronizar(conexao, opcoes?.criadasDesde);
  }

  async function contaDoEvento(conexao: Conexao, contaIdExterno: string) {
    return (await sincronizarContas(conexao)).get(contaIdExterno) ?? null;
  }

  /** Executa o evento e devolve a empresa afetada (para eventos_webhook.empresa_id). */
  async function executar(evento: EventoDeWebhook): Promise<Id | null> {
    switch (evento.tipo) {
      case "conexao_criada": {
        const doProvedor = await obterDoProvedor(evento.conexaoIdExterno);
        const conexao = await garantirConexao(
          evento.conexaoIdExterno,
          doProvedor,
        );
        const atual = await atualizarStatus(conexao, doProvedor);
        // Primeira sincronização: o item já pode ter dados coletados.
        if (atual.status === "atualizada") await sincronizar(conexao);
        return conexao.empresaId;
      }
      case "conexao_atualizada": {
        const doProvedor = await obterDoProvedor(evento.conexaoIdExterno);
        const conexao = await garantirConexao(
          evento.conexaoIdExterno,
          doProvedor,
        );
        await atualizarStatus(conexao, doProvedor);
        // Folga de 2 dias sobre a última sincronização; completa se for a primeira.
        const desde = conexao.ultimaSincronizacaoEm
          ? new Date(conexao.ultimaSincronizacaoEm.getTime() - 2 * DIA_EM_MS)
          : undefined;
        await sincronizar(conexao, desde);
        return conexao.empresaId;
      }
      case "conexao_com_erro": {
        const doProvedor = await obterDoProvedor(evento.conexaoIdExterno);
        const conexao = await garantirConexao(
          evento.conexaoIdExterno,
          doProvedor,
        );
        await atualizarStatus(conexao, doProvedor, {
          status: STATUS_ESPECIFICOS_DE_ERRO.has(doProvedor.status)
            ? doProvedor.status
            : "erro",
          erro: doProvedor.erro ?? evento.erro,
        });
        return conexao.empresaId;
      }
      case "transacoes_criadas": {
        const conexao = await garantirConexao(evento.conexaoIdExterno);
        const conta = await contaDoEvento(conexao, evento.contaIdExterno);
        if (conta) {
          await gravarTransacoes(conexao, conta, {
            criadasDesde: evento.criadasDesde,
          });
          await deps.conexoes.marcarSincronizada(
            conexao.empresaId,
            conexao.id,
            agora(),
          );
          await categorizarSemQuebrar(conexao.empresaId);
        }
        return conexao.empresaId;
      }
      case "transacoes_atualizadas": {
        const conexao = await garantirConexao(evento.conexaoIdExterno);
        const conta = await contaDoEvento(conexao, evento.contaIdExterno);
        if (conta) {
          const ids = evento.transacaoIdsExternos;
          for (let i = 0; i < ids.length; i += TAMANHO_DO_LOTE_DE_IDS)
            await gravarTransacoes(conexao, conta, {
              ids: ids.slice(i, i + TAMANHO_DO_LOTE_DE_IDS),
            });
          await categorizarSemQuebrar(conexao.empresaId);
        }
        return conexao.empresaId;
      }
      case "transacoes_removidas": {
        const conexao = await deps.conexoes.buscarPorIdExterno(
          evento.conexaoIdExterno,
        );
        if (!conexao) throw conexaoNaoEncontrada();
        await deps.transacoes.removerPorIdsExternos(
          conexao.empresaId,
          evento.transacaoIdsExternos,
        );
        return conexao.empresaId;
      }
      case "ignorado":
        return null;
    }
  }

  return {
    async processarEvento(evento) {
      let empresaId: Id | null = null;
      let erro: string | null = null;
      try {
        empresaId = await executar(evento);
      } catch (falha) {
        registrarFalha(`webhook ${evento.nomeOriginal}`, falha);
        // Mensagem curta, sem payload (eventos_webhook.erro ≤ 500).
        erro =
          falha instanceof ErroDeNegocio
            ? falha.codigo
            : `falha_inesperada:${falha instanceof Error ? falha.name : typeof falha}`;
      }
      try {
        await deps.eventos.marcarProcessado(evento.eventoId, {
          empresaId,
          erro,
        });
      } catch (falha) {
        registrarFalha("marcar evento processado", falha);
      }
    },

    sincronizarConexao,

    async ressincronizarTodas() {
      // Conexões 'arquivo' (extrato importado, ADR 0016) não têm o que buscar no provedor.
      const conexoes = (await deps.conexoes.listarTodas()).filter(
        (c) => c.provedor === "pluggy",
      );
      const desde = new Date(agora().getTime() - 7 * DIA_EM_MS);
      let falhas = 0;
      for (const conexao of conexoes) {
        try {
          const doProvedor = await deps.provedor.obterConexao(
            conexao.idExterno,
          );
          if (doProvedor) await atualizarStatus(conexao, doProvedor);
          await sincronizar(conexao, desde);
        } catch (erro) {
          falhas++;
          registrarFalha("ressincronização diária", erro);
        }
      }
      return { conexoes: conexoes.length, falhas };
    },

    async sincronizarAgora(ctx, conexaoId) {
      const conexao = z.uuid().safeParse(conexaoId).success
        ? await deps.conexoes.buscarPorId(ctx.empresaId, conexaoId)
        : null;
      if (!conexao || conexao.provedor !== "pluggy")
        throw conexaoNaoEncontrada();
      await exigirLimite(
        deps.consumirLimite,
        `sincronizar:usuario:${ctx.usuarioId}`,
        LIMITES.sincronizar,
      );
      // P-07: o manual busca os últimos 90 dias.
      return sincronizar(conexao, new Date(agora().getTime() - 90 * DIA_EM_MS));
    },
  };
}
