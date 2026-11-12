import "server-only";
import { z } from "zod";
import {
  chaveComHash,
  exigirLimite,
  type ConsumirLimite,
  type LimiteDeRequisicoes,
} from "../acesso/limites";
import { ErroDeNegocio, entradaInvalida } from "../erros";
import type { ContextoDoUsuario, DataISO } from "../tipos";
import type { FerramentaDoAgente } from "./ferramentas";

// Assistente financeiro: pergunta em linguagem natural, resposta com números vindos das ferramentas.

export interface MensagemDoAgente {
  papel: "usuario" | "assistente";
  texto: string;
}

/** Porta para o modelo (implementada pelo adaptador do Claude). Devolve o texto final. */
export interface ModeloDoAgente {
  responder(pedido: {
    hoje: DataISO;
    mensagens: readonly MensagemDoAgente[];
    ferramentas: readonly FerramentaDoAgente[];
  }): Promise<string>;
}

export interface ServicoDoAgente {
  /** `mensagens` vem do navegador: é validada aqui. A última precisa ser do usuário. */
  perguntar(
    ctx: ContextoDoUsuario,
    ferramentas: readonly FerramentaDoAgente[],
    mensagens: unknown,
    ip: string | null,
  ): Promise<string>;
}

export const MAXIMO_DE_MENSAGENS = 20;
export const MAXIMO_DE_CARACTERES = 1000;
/** Respostas anteriores do assistente voltam no histórico e podem ser mais longas que uma pergunta. */
const MAXIMO_DE_CARACTERES_NO_HISTORICO = 8000;

/** Por IP: segura um visitante só. Por empresa ao dia: teto de custo (na demo, todos dividem a empresa). */
export const LIMITE_DO_AGENTE_POR_IP: LimiteDeRequisicoes = {
  maximo: 20,
  janelaEmSegundos: 3600,
};
const UM_DIA_EM_SEGUNDOS = 24 * 3600;

const esquemaDasMensagens = z
  .array(
    z.object({
      papel: z.enum(["usuario", "assistente"]),
      texto: z.string().trim().min(1).max(MAXIMO_DE_CARACTERES_NO_HISTORICO),
    }),
  )
  .min(1)
  .max(MAXIMO_DE_MENSAGENS)
  .refine((m) => {
    // O refine roda mesmo com a lista vazia (o min(1) já falhou): `ultima` pode não existir.
    const ultima = m.at(-1);
    return (
      ultima?.papel === "usuario" && ultima.texto.length <= MAXIMO_DE_CARACTERES
    );
  });

export function criarServicoDoAgente(deps: {
  modelo: ModeloDoAgente;
  consumirLimite: ConsumirLimite;
  hoje: () => DataISO;
  ligado: () => boolean;
  limiteDiarioPorEmpresa: () => number;
}): ServicoDoAgente {
  return {
    async perguntar(ctx, ferramentas, mensagensInformadas, ip) {
      if (!deps.ligado())
        throw new ErroDeNegocio(
          "recurso_desligado",
          "O assistente está desligado.",
        );
      const r = esquemaDasMensagens.safeParse(mensagensInformadas);
      if (!r.success)
        throw entradaInvalida(
          `Escreva uma pergunta de até ${MAXIMO_DE_CARACTERES} caracteres.`,
        );
      // Fechada: sem o banco de limites não há teto de custo, então não chama o modelo.
      if (ip)
        await exigirLimite(
          deps.consumirLimite,
          chaveComHash("agente:ip", ip),
          LIMITE_DO_AGENTE_POR_IP,
          "fechada",
        );
      await exigirLimite(
        deps.consumirLimite,
        `agente:empresa:${ctx.empresaId}`,
        {
          maximo: deps.limiteDiarioPorEmpresa(),
          janelaEmSegundos: UM_DIA_EM_SEGUNDOS,
        },
        "fechada",
      );
      return deps.modelo.responder({
        hoje: deps.hoje(),
        mensagens: r.data,
        ferramentas,
      });
    },
  };
}
