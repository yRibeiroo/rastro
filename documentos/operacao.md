# Guia de operação

Como manter o Rastro v1.0.0 no ar: Vercel (aplicação), Supabase (banco, Auth, arquivos) e Anthropic (IA). Para o passo a passo do primeiro deploy, veja também [PARA-O-DAVI.md](PARA-O-DAVI.md).

## 1. Variáveis na Vercel

Cadastre em **Project → Settings → Environment Variables**, no ambiente _Production_ (e em _Preview_, se quiser prévias funcionando). A lista de nomes está em [`.env.example`](../.env.example). Depois de mudar qualquer variável, faça um novo deploy (**Deployments → ⋯ → Redeploy**): o valor só vale para deploys novos.

### Secretas (marque como _Sensitive_)

| Variável                    | De onde vem                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → chave secreta. Ignora a RLS: nunca no navegador nem em `NEXT_PUBLIC_*`   |
| `ANTHROPIC_API_KEY`         | console.anthropic.com → API Keys                                                                          |
| `CRON_SECRET`               | Gere uma sequência aleatória de 16+ caracteres (ex.: `openssl rand -base64 32`). A Vercel a envia ao cron |
| `EMAIL_AUTORIZADO`          | E-mails que podem entrar, separados por vírgula                                                           |

### Públicas (vão para o navegador)

| Variável                               | Valor                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://sdglxhgxofttirwfuzlh.supabase.co`                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | A chave `sb_publishable_...` do painel do Supabase, em **Settings → API Keys** |

### Configuração (não secretas)

| Variável                                            | Valor                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `URL_DO_SITE`                                       | URL de produção, sem barra no fim (ex.: `https://rastro.vercel.app`) |
| `RECURSO_CATEGORIZACAO_IA`                          | `1`                                                                  |
| `RECURSO_ANEXOS`                                    | `1`                                                                  |
| `RECURSO_COMPROVANTES_IA`                           | `1`                                                                  |
| `RECURSO_OPEN_FINANCE`                              | `0` (ver seção 7)                                                    |
| `RECURSO_MULTIEMPRESA`                              | `0`                                                                  |
| `IA_LIMITE_COMPROVANTES_MES`                        | `300` (padrão; ver seção 8)                                          |
| `ANTHROPIC_MODELO`, `ANTHROPIC_MODELO_COMPROVANTES` | Opcionais. Vazias = modelo padrão do código                          |

As variáveis `PLUGGY_*` só são necessárias com `RECURSO_OPEN_FINANCE=1`.

## 2. Supabase de produção

- Projeto: ref **`sdglxhgxofttirwfuzlh`**, região **sa-east-1** (São Paulo), plano **Free**.
- O plano Free **não tem backup automático** e **pausa o projeto após inatividade**. Antes de colocar dados reais, passe para o Pro (decisão D-02 em [especificacao/viabilidade.md](especificacao/viabilidade.md)).

### Aplicar migrações novas

As migrações ficam em [`supabase/migrations/`](../supabase/migrations/). Elas **não** rodam no deploy da Vercel.

```bash
npx supabase login
npx supabase link --project-ref sdglxhgxofttirwfuzlh
npx supabase migration list      # compara local x remoto
npx supabase db push             # aplica as que faltam
```

**Antes do primeiro `db push`:** as migrações iniciais foram aplicadas pelo conector MCP do Supabase, que gravou versões com datas diferentes das dos arquivos locais. Sem acerto, o `db push` tentaria rodar tudo de novo. Faça uma vez:

```bash
# 1) marque como revertidas as versões remotas que não existem localmente (aparecem só na coluna "Remote")
npx supabase migration repair --status reverted <versao_remota> [<versao_remota> ...]

# 2) marque as 10 versões locais como aplicadas
npx supabase migration repair --status applied \
  20261009120000 20261009120100 20261009120200 20261009120300 20261009120400 \
  20261009120500 20261009120600 20261009120700 20261010120000 20261010130000

npx supabase migration list      # agora local e remoto devem bater
```

Atenção: a `20261009120600_eventos_webhook_e_limites.sql` não foi aplicada pelo conector. Rode o conteúdo dela no SQL Editor **antes** do passo 2 (ver [PARA-O-DAVI.md](PARA-O-DAVI.md)); sem ela o limite de requisições do login falha.

Depois de mudar o banco, regenere os tipos localmente (`npm run tipos-do-banco`) e rode `npm run testar:banco`.

### Auth

Em **Authentication → URL Configuration**:

- **Site URL**: a URL de produção (a mesma de `URL_DO_SITE`).
- **Redirect URLs**: a URL de produção e a URL de produção + `/entrar/confirmar` (ex.: `https://rastro.vercel.app/entrar/confirmar`).

Em **Authentication → Emails → SMTP Settings**, configure um **SMTP próprio** (ex.: Resend). O envio padrão do Supabase só entrega para membros do time e tem limite baixo por hora (premissa P-08 em [especificacao/premissas.md](especificacao/premissas.md)).

## 3. Backup

- **Plano Free:** sem backup automático. Faça um dump manual periódico (ex.: semanal) e guarde fora do computador:

  ```bash
  npx supabase db dump --linked -f backup-esquema.sql
  npx supabase db dump --linked --data-only -f backup-dados.sql
  ```

  Os arquivos do Storage (comprovantes e anexos, bucket `anexos`) não entram no dump; baixe pelo painel se precisar.

- **Plano Pro:** backup diário automático (7 dias). Point-in-time recovery é um adicional pago.
- Os dumps têm dados financeiros: nunca os coloque no git.

## 4. Rotação de segredos

Troque um segredo quando ele vazar (apareceu em log, print, chat) ou quando alguém com acesso sair. Em todos os casos: gere o novo, atualize na Vercel, faça redeploy e só então revogue o antigo.

| Segredo                     | Onde gerar o novo                                                              |
| --------------------------- | ------------------------------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → criar nova chave secreta e apagar a antiga    |
| `ANTHROPIC_API_KEY`         | console.anthropic.com → API Keys → criar nova e desativar a antiga             |
| `CRON_SECRET`               | Gere outra sequência aleatória; a Vercel passa a enviar a nova após o redeploy |
| `PLUGGY_CLIENT_SECRET`      | Painel da Pluggy → aplicação → gerar novo Client Secret                        |
| `PLUGGY_WEBHOOK_SECRET`     | Gere outra sequência aleatória e rode `npm run registrar-webhook` de novo      |

Para conferir se nada vazou no repositório: `npm run segredos`.

## 5. Cron diário

Definido em [`vercel.json`](../vercel.json): `GET /api/tarefas/ressincronizar` às 09:00 UTC (06:00 em Araguaína). A rota exige `Authorization: Bearer <CRON_SECRET>`. Ela reconcilia os comprovantes pendentes de todas as empresas e, só com `RECURSO_OPEN_FINANCE=1`, ressincroniza a Pluggy. Execuções aparecem em **Vercel → Project → Settings → Cron Jobs**.

## 6. Leitura de comprovantes pela IA

- `RECURSO_COMPROVANTES_IA=0` desliga a leitura: a tela `/comprovantes` avisa e não oferece o envio.
- O custo estimado é de cerca de US$ 0,04 por comprovante ([especificacao/viabilidade.md](especificacao/viabilidade.md)).

## 7. Religar o Open Finance (Pluggy)

O código está pronto e testado, mas desligado ([ADR 0016](arquitetura/decisoes/0016-extrato-ofx-e-comprovantes-com-ia.md)). A Pluggy em produção custa no mínimo R$ 2.500/mês. Para religar:

1. No painel da Pluggy, **gere um novo Client Secret** (o anterior apareceu num log e deve ser tratado como vazado).
2. Cadastre na Vercel `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET` (sequência aleatória nova) e `PLUGGY_INCLUIR_SANDBOX=0`.
3. Mude `RECURSO_OPEN_FINANCE=1` e faça redeploy.
4. Registre o webhook (com as mesmas variáveis no `.env.local`):

   ```bash
   npm run registrar-webhook -- https://<url-de-producao>/api/webhooks/pluggy
   ```

5. Entre no Rastro e use "Conectar banco".

Para desligar de novo: `RECURSO_OPEN_FINANCE=0` e redeploy. O webhook passa a responder 404.

## 8. Limite de comprovantes por mês

`IA_LIMITE_COMPROVANTES_MES` (padrão 300) é o teto de leituras pela IA por empresa no mês (envios e releituras, contados no fuso de Araguaína). Ao atingir, o comprovante enviado é guardado sem chamar a IA (fica como "erro de leitura", motivo limite) e pode ser preenchido à mão; "Tentar ler de novo" é recusado até o mês seguinte. Com 300, o gasto máximo fica perto de US$ 12/mês. Para mudar: altere a variável na Vercel e faça redeploy. `0` bloqueia todas as leituras.

## 9. Incidentes

1. **Algo quebrou na tela ou um envio falhou:** Vercel → Project → **Logs** (filtre por status 5xx ou pela rota). Os logs registram só o tipo do erro, sem dados pessoais.
2. **Deploy falhou:** Vercel → **Deployments** → abra o deploy e veja o log do build. Para voltar rápido, use **Promote** / **Instant Rollback** num deploy anterior que funcionava.
3. **Banco, login ou arquivos:** Supabase → **Logs** (API, Postgres, Auth, Storage) e **Advisors** (segurança e desempenho). Rode os advisors depois de toda migração nova.
4. **Login não chega:** confira o SMTP próprio, as Redirect URLs e se o e-mail está em `EMAIL_AUTORIZADO`.
5. **Suspeita de vazamento:** siga a seção 4 imediatamente para o segredo afetado.
6. **Projeto pausado (Free):** Supabase → projeto → **Restore**. Para evitar, passe para o Pro.
