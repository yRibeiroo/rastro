// Registra (ou atualiza) os webhooks do Rastro na Pluggy. Porte do register_webhook.py (ADR 0007).
//
//   node --env-file=.env.local comandos/registrar-webhook.ts https://<domínio>/api/webhooks/pluggy
//   (ou: npm run registrar-webhook -- https://<domínio>/api/webhooks/pluggy)
//
// A Pluggy não assina os webhooks: cada um é registrado com o cabeçalho
// "Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>", conferido pela rota. A URL precisa ser HTTPS
// (localhost não é aceito: use um túnel). Idempotente: (evento, url) existente é atualizado.
//
// Roda com o type stripping do Node (≥ 22.18): sem enums/decorators, sem importar src/ nem "@/".

import pluggy from "pluggy-sdk";

const EVENTOS = [
  "item/created",
  "item/updated",
  "item/error",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
] as const;

function sair(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}

async function principal(): Promise<void> {
  const url = process.argv[2] ?? "";
  if (process.argv.length !== 3 || !url.startsWith("https://"))
    sair(
      "Uso: node --env-file=.env.local comandos/registrar-webhook.ts https://seu-dominio/api/webhooks/pluggy",
    );
  if (!URL.canParse(url)) sair("URL inválida.");

  const segredo = process.env.PLUGGY_WEBHOOK_SECRET ?? "";
  const clientId = process.env.PLUGGY_CLIENT_ID ?? "";
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET ?? "";
  if (segredo.length < 32)
    sair(
      "Defina PLUGGY_WEBHOOK_SECRET (32+ caracteres) no .env.local (veja o .env.example).",
    );
  if (!clientId || !clientSecret)
    sair("Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env.local.");

  const cliente = new pluggy.PluggyClient({ clientId, clientSecret });
  const cabecalhos = { Authorization: `Bearer ${segredo}` };

  const existentes = new Map(
    ((await cliente.fetchWebhooks()).results ?? []).map((w) => [
      `${w.event} ${w.url}`,
      w,
    ]),
  );
  for (const evento of EVENTOS) {
    const atual = existentes.get(`${evento} ${url}`);
    if (atual) {
      await cliente.updateWebhook(atual.id, {
        url,
        event: evento,
        headers: cabecalhos,
        enabled: true,
      });
      console.log(`atualizado: ${evento}`);
    } else {
      await cliente.createWebhook(evento, url, cabecalhos);
      console.log(`criado:     ${evento}`);
    }
  }
}

principal().catch((erro: unknown) => {
  // O SDK rejeita com o corpo da resposta ({ code, message }): mostra só o código, nunca credenciais.
  const codigo =
    erro && typeof erro === "object" && "code" in erro
      ? String((erro as { code: unknown }).code)
      : "desconhecido";
  sair(
    `Falha ao registrar na Pluggy (código ${codigo}). Confira as credenciais e a URL.`,
  );
});
