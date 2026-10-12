# ADR 0007 — Webhook da Pluggy: Bearer secreto, deduplicação, `after()`, `GET /items` como fonte da verdade

**Status:** Aceita (2026-10-09)

## Contexto
Aprendizados do protótipo e do `CONTEXTO.md` §4:
- A Pluggy **não assina** webhooks. A autenticação é feita por cabeçalho customizado, registrado via API.
- Um `webhookUrl` passado no connect token chega **sem** o cabeçalho secreto.
- A rota precisa de HTTPS e de resposta 2XX em até 10 s. A Pluggy reenvia até 3 vezes (na hora, ~15 min, ~2 h) e **não** reenvia 400/401/403/404/405.
- O payload do item pode estar desatualizado. `GET /items/{id}` é a fonte da verdade.
- No Flask, o processamento ia para uma fila em threads. Na Vercel não existe processo persistente.

## Decisão
1. Rota `POST /api/webhooks/pluggy` (Route Handler, runtime Node.js, `maxDuration = 60`).
2. **Autenticação**: `Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>` comparado com `crypto.timingSafeEqual`. Falha → **401** (não reenviado). Segredo não configurado → 401 e log de erro.
3. **Validação**: `provedor.interpretarWebhook(corpo)` com Zod. Inválido → **400**.
4. **Deduplicação**: `INSERT INTO eventos_webhook (event_id …) ON CONFLICT DO NOTHING`. Duplicado → 200 `{ duplicado: true }`. **Falha do banco → 500**, para a Pluggy reenviar.
5. **Processamento depois da resposta** com `after(() => sincronizacao.processarEvento(evento))`. A resposta sai em milissegundos.
6. `processarEvento` **sempre** consulta `obterConexao(itemId)` (`GET /items/{id}`) para status, e busca transações pela API (`fetchTransactionsCursor` com `createdAtFrom`, ou com `ids` em lotes de 500), nunca confiando em dados do payload além dos identificadores.
7. **Sem `webhookUrl` no connect token.** O registro dos webhooks (6 eventos, com o cabeçalho secreto) é feito por `npm run registrar-webhook -- https://<domínio>/api/webhooks/pluggy`, que porta o `register_webhook.py`: idempotente, atualiza se (evento, url) já existe. Rodar uma vez por ambiente (produção; preview, se precisar).
8. **Rede de segurança**: se o `after()` falhar, a Pluggy não reenvia (já recebeu 200). Por isso:
   - o erro fica em `eventos_webhook.erro` (sem payload) e no log;
   - a **Vercel Cron** chama `GET /api/tarefas/ressincronizar` 1×/dia (`Authorization: Bearer <CRON_SECRET>`), que ressincroniza todas as conexões com `criadasDesde = agora − 7 dias` e limpa `eventos_webhook` com mais de 90 dias e `limites_de_requisicao` com mais de 1 dia;
   - a tela de conexões tem o botão "Sincronizar agora".
9. O upsert é idempotente por `(empresa_id, id_externo)`, então reprocessar um evento ou ressincronizar não duplica nem apaga a categoria do usuário.

## Consequências
- (+) Atende o prazo de 10 s com folga. Eventos repetidos não geram trabalho repetido.
- (+) Um segredo vazado é trocado só com nova variável + `registrar-webhook`.
- (−) A deduplicação acontece antes do processamento: se a função morrer no meio, o evento não é reprocessado automaticamente. A perda é coberta pelo cron diário (atraso máximo de ~24 h) ou pelo botão manual.
- (−) `after()` fica sujeito ao `maxDuration` do plano. Uma sincronização completa de 12 meses de uma conta PJ cabe com folga em 60 s. Se não couber, dividir por conta em vários `after()`.
- (−) O cabeçalho secreto fica guardado na Pluggy. Isso é inerente à falta de assinatura.

## Alternativas consideradas
- **Fila externa (QStash, SQS, Inngest)**: mais robusta, mas é mais um serviço/conta e talvez pago. Fica para quando houver volume multiempresa (roteiro de evolução).
- **Processar de forma síncrona antes de responder**: arrisca os 10 s na primeira sincronização.
- **Supabase Queues (pgmq) + Edge Function**: viável, mas leva lógica de negócio para fora do Next e duplica o código do adaptador.
