import "server-only";
import { z } from "zod";
import type { RepositorioDeConexoes } from "@/acesso-a-dados/contratos";
import { exigirLimite, LIMITES, type ConsumirLimite } from "../acesso";
import { ErroDeNegocio, entradaInvalida } from "../erros";
import type { Conexao, ContextoDoUsuario, Id } from "../tipos";
import type { ProvedorBancario } from "./provedor-bancario";

export interface ServicoDeConexaoBancaria {
  /** Rate limit: 10/h por usuário. */
  iniciarConexao(
    ctx: ContextoDoUsuario,
    opcoes?: { conexaoIdParaReconectar?: Id },
  ): Promise<{ token: string }>;

  /** Valida idExterno (uuid) e chama obterConexao: null => 'conexao_nao_encontrada';
   *  identificadorDoUsuario !== ctx.empresaId => 'conexao_nao_encontrada'. Upsert e retorno. */
  registrarConexao(ctx: ContextoDoUsuario, idExterno: string): Promise<Conexao>;

  listarConexoes(ctx: ContextoDoUsuario): Promise<Conexao[]>;
}

export const conexaoNaoEncontrada = () =>
  new ErroDeNegocio(
    "conexao_nao_encontrada",
    "Não encontramos essa conexão bancária.",
  );

const uuid = z.uuid();

export function criarServicoDeConexaoBancaria(deps: {
  provedor: ProvedorBancario;
  /** conexoes só aceita insert pelo service role (RLS); todo método filtra por ctx.empresaId. */
  conexoes: RepositorioDeConexoes;
  consumirLimite: ConsumirLimite;
}): ServicoDeConexaoBancaria {
  return {
    async iniciarConexao(ctx, opcoes) {
      let idExternoParaReconectar: string | undefined;
      if (opcoes?.conexaoIdParaReconectar !== undefined) {
        if (!uuid.safeParse(opcoes.conexaoIdParaReconectar).success)
          throw conexaoNaoEncontrada();
        const conexao = await deps.conexoes.buscarPorId(
          ctx.empresaId,
          opcoes.conexaoIdParaReconectar,
        );
        if (!conexao) throw conexaoNaoEncontrada();
        idExternoParaReconectar = conexao.idExterno;
      }
      await exigirLimite(
        deps.consumirLimite,
        `conexao:usuario:${ctx.usuarioId}`,
        LIMITES.conexao,
      );
      return deps.provedor.criarTokenDeConexao({
        identificadorDoUsuario: ctx.empresaId,
        idExternoParaReconectar,
      });
    },

    async registrarConexao(ctx, idExterno) {
      const valido = uuid.safeParse(idExterno);
      if (!valido.success) throw entradaInvalida("Conexão inválida.");
      // Não confiamos no navegador: o item precisa existir na NOSSA aplicação Pluggy
      // e ter sido criado com o token desta empresa.
      const doProvedor = await deps.provedor.obterConexao(valido.data);
      if (!doProvedor || doProvedor.identificadorDoUsuario !== ctx.empresaId)
        throw conexaoNaoEncontrada();
      const existente = await deps.conexoes.buscarPorIdExterno(valido.data);
      if (existente && existente.empresaId !== ctx.empresaId)
        throw conexaoNaoEncontrada();
      return deps.conexoes.salvar(
        ctx.empresaId,
        {
          idExterno: doProvedor.idExterno,
          banco: doProvedor.banco,
          status: doProvedor.status,
          erro: doProvedor.erro,
          consentimentoExpiraEm: doProvedor.consentimentoExpiraEm,
        },
        ctx.usuarioId,
      );
    },

    listarConexoes: (ctx) => deps.conexoes.listar(ctx.empresaId),
  };
}
