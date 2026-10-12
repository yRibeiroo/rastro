import { after } from "next/server";
import { ambiente } from "@/configuracao/ambiente";
import { webhookAutorizado } from "@/regras-de-negocio/conexao-bancaria";
import { registrarFalha } from "@/regras-de-negocio/erros";
import { servicosDoSistema } from "@/regras-de-negocio/montagem";

// Webhook da Pluggy (ADR 0007): Bearer secreto, Zod, deduplicação, 200 rápido e trabalho no after().
// Sem rate limit: 429 faria a Pluggy reenviar; o segredo e a deduplicação protegem.
export const maxDuration = 60;

function segredoDoWebhook(): string | undefined {
  try {
    return ambiente.PLUGGY_WEBHOOK_SECRET;
  } catch (erro) {
    registrarFalha("PLUGGY_WEBHOOK_SECRET ausente: recusando webhooks", erro);
    return undefined;
  }
}

export async function POST(requisicao: Request) {
  // RF-45: Open Finance desligado → 404, sem ler o corpo nem conferir o segredo.
  if (!ambiente.RECURSO_OPEN_FINANCE)
    return Response.json({ erro: "não encontrado" }, { status: 404 });
  // 401 não é reenviado pela Pluggy; sem detalhes na resposta.
  if (
    !webhookAutorizado(
      requisicao.headers.get("authorization"),
      segredoDoWebhook(),
    )
  )
    return Response.json({ erro: "não autorizado" }, { status: 401 });

  const sistema = servicosDoSistema();
  const evento = sistema.provedor.interpretarWebhook(
    await requisicao.json().catch(() => null),
  );
  if (!evento)
    return Response.json({ erro: "payload inválido" }, { status: 400 });

  let novo: boolean;
  try {
    novo = await sistema.eventos.registrar(
      evento.eventoId,
      evento.nomeOriginal,
      evento.conexaoIdExterno,
    );
  } catch (erro) {
    // 500: a Pluggy reenvia (o evento ainda não foi registrado).
    registrarFalha("registrar evento do webhook", erro);
    return Response.json({ erro: "indisponível" }, { status: 500 });
  }
  if (!novo) return Response.json({ recebido: true, duplicado: true });

  after(() => sistema.sincronizacao.processarEvento(evento));
  return Response.json({ recebido: true });
}
