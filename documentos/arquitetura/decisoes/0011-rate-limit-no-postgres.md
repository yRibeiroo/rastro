# ADR 0011 — Rate limit em tabela do Postgres com função atômica

**Status:** Aceita (2026-10-09)

## Contexto
O PROMPT pede rate limit nas rotas sensíveis. Em serverless, contadores em memória não funcionam: cada instância tem a sua memória, e ela some entre invocações. Queremos evitar serviço extra pago. O volume é baixíssimo (um usuário), então a latência de uma chamada a mais ao banco é irrelevante.

## Decisão
- Tabela `limites_de_requisicao (chave, janela, contador)` e função `consumir_limite_de_requisicao(p_chave, p_maximo, p_janela_segundos) returns boolean`, com **janela fixa**:
  ```sql
  insert into public.limites_de_requisicao as l (chave, janela, contador)
  values (p_chave, to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos), 1)
  on conflict (chave, janela) do update set contador = l.contador + 1
  returning contador <= p_maximo;
  ```
  O upsert é atômico, sem condição de corrida entre instâncias.
- Executável **só pelo service role**. RLS ligada sem policies. Chamada por `consumirLimite()` no módulo `acesso`.
- Chaves com **hash SHA-256** de IP e e-mail (nunca texto puro, por causa da LGPD). O IP vem do primeiro valor de `x-forwarded-for`, que a Vercel define.
- Limites:

| Ação | Chave | Limite |
|---|---|---|
| Enviar link mágico | `entrar:ip:<hash>` / `entrar:email:<hash>` | 5 / 15 min, 3 / 15 min |
| Criar token de conexão | `conexao:usuario:<id>` | 10 / h |
| Sincronizar agora | `sincronizar:usuario:<id>` | 6 / h |
| Recategorizar com IA (manual) | `ia:empresa:<id>` | 5 / h |
| Enviar anexo | `anexo:usuario:<id>` | 30 / h |

- Excedeu → `ErroDeNegocio('limite_excedido', 'Muitas tentativas. Tente de novo em alguns minutos.')`. Em Route Handler, 429.
- **Falha do banco ao consultar o limite → bloqueia (fail-closed)** no envio do link mágico e libera (fail-open) nas ações de usuário já autenticado.
- O webhook **não** tem rate limit: ele é protegido pelo segredo e pela deduplicação. Responder 429 faria a Pluggy reenviar.
- A limpeza das janelas com mais de 1 dia é feita pelo cron diário (ADR 0007).

## Consequências
- (+) Zero custo e zero serviço novo. Funciona igual em todas as instâncias. Testável no Supabase local.
- (−) Janela fixa permite pico de até 2× o limite na virada da janela, o que é aceitável aqui.
- (−) Uma ida ao banco por ação limitada (~10–30 ms).
- Se o SaaS crescer: migrar a implementação de `consumirLimite` para Upstash Redis ou para regras do Vercel Firewall, sem mudar quem chama.

## Alternativas consideradas
- **Upstash Redis (`@upstash/ratelimit`)**: tem plano gratuito, mas é mais uma conta, mais um segredo e mais um fornecedor de dados.
- **Memória do processo**: não funciona em serverless.
- **Vercel Firewall / WAF rate limiting**: depende do plano e é configurado fora do código. Pode ser uma camada extra depois.
