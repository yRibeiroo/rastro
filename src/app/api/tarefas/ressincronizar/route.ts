import { ambiente } from "@/configuracao/ambiente";
import { webhookAutorizado } from "@/regras-de-negocio/conexao-bancaria";
import { registrarFalha } from "@/regras-de-negocio/erros";
import { servicosDoSistema } from "@/regras-de-negocio/montagem";

// Vercel Cron diário (ADR 0007): rede de segurança do webhook + limpeza da infraestrutura.
export const maxDuration = 60;

function segredoDoCron(): string | undefined {
  try {
    return ambiente.CRON_SECRET;
  } catch (erro) {
    registrarFalha("CRON_SECRET ausente: recusando a tarefa", erro);
    return undefined;
  }
}

export async function GET(requisicao: Request) {
  // A Vercel Cron envia "Authorization: Bearer <CRON_SECRET>" (mesma comparação em tempo constante).
  if (
    !webhookAutorizado(requisicao.headers.get("authorization"), segredoDoCron())
  )
    return Response.json({ erro: "não autorizado" }, { status: 401 });

  const sistema = servicosDoSistema();
  try {
    const resultado = await sistema.sincronizacao.ressincronizarTodas();
    await sistema.limpeza();
    return Response.json(resultado);
  } catch (erro) {
    registrarFalha("tarefa de ressincronização", erro);
    return Response.json({ erro: "falhou" }, { status: 500 });
  }
}
