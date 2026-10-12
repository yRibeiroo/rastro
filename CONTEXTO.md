---
tags: [rastro, projeto, open-finance, pluggy, hometec]
criado: 2026-10-09
status: v1.0.0 pronta, deploy pendente
atualizado: 2026-10-11
---

# Rastro — Contexto do projeto

> _"Rastro: saiba para onde vai cada real."_

Sistema de controle financeiro da **HOMETEC SERVIÇOS** que puxa o extrato da conta PJ **automaticamente**, sem precisar enviar comprovantes, e categoriza cada gasto. Começa como ferramenta interna e pode virar um SaaS regional (Tocantins → Brasil).

---

## 0. Estado atual (11/10/2026)

- **v1.0.0 pronta** e revisada pelo QA ([documentos/qualidade/revisoes.md](documentos/qualidade/revisoes.md)). Mudanças em [CHANGELOG.md](CHANGELOG.md).
- **Local:** `C:\projetos\rastro` (a pasta antiga no OneDrive pode ser apagada).
- **GitHub:** repositório privado **yRibeiroo/rastro**, pull request #1 (`funcionalidade/v1-em-andamento` → `main`).
- **Stack:** Next.js 16 + TypeScript + Tailwind 4, Supabase (Postgres com RLS, Auth, Storage), Vercel, Claude ([ADR 0001](documentos/arquitetura/decisoes/0001-nextjs-supabase-vercel.md)). O protótipo Flask descrito nas seções 1 a 7 ficou em `prototipo-flask/` como referência.
- **Fonte dos dados:** extrato **OFX** do Sicredi + comprovantes lidos pelo Claude ([ADR 0016](documentos/arquitetura/decisoes/0016-extrato-ofx-e-comprovantes-com-ia.md)). A Pluggy está no código, desligada (`RECURSO_OPEN_FINANCE=0`), porque custaria no mínimo R$ 2.500/mês.
- **Supabase de produção:** projeto `sdglxhgxofttirwfuzlh` (sa-east-1, plano Free) com as migrações aplicadas, **exceto** `supabase/migrations/20261009120600_eventos_webhook_e_limites.sql`, que o Davi precisa rodar no SQL Editor.
- **Deploy na Vercel: pendente.** O conector da Vercel deu 403 neste time; o Davi importa o repositório manualmente.
- **Próximos passos:** [documentos/PARA-O-DAVI.md](documentos/PARA-O-DAVI.md) (o que o dono faz), [documentos/operacao.md](documentos/operacao.md) (operação) e [documentos/evolucao/roteiro.md](documentos/evolucao/roteiro.md) (próximas versões).

> As seções 1 a 8 abaixo registram o início do projeto (protótipo Flask + Pluggy) e ficam como histórico.

---

## 1. Decisões tomadas

| Tema            | Decisão                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| Nome            | **Rastro**. Alternativas consideradas: Cadê, Tostão, Gastô, Contô, Dourado, Jalapa |
| Banco           | **Sicredi**, conta PJ                                                              |
| Fonte dos dados | **Open Finance via Pluggy**, conector _Sicredi Empresas (627)_                     |
| Backend         | Python + Flask                                                                     |
| Frontend        | React + `react-pluggy-connect`                                                     |
| Banco de dados  | SQLite por enquanto, migrar para Postgres depois                                   |
| Categorização   | Regras + API do Claude + centro de custo por serviço                               |

### Por que Pluggy e não a conexão direta

- Para se conectar direto ao Open Finance seria preciso autorização do Banco Central, certificados ICP-Brasil e conformidade com FAPI, o que é inviável para uma empresa pequena.
- Um **agregador** (Pluggy, Belvo...) já é participante regulado e entrega os dados por uma API comum.
- As APIs próprias do Sicredi (**API Pix** e **API de Cobrança**, em developer.sicredi.com.br) só mostram **recebimentos**, sem o extrato completo das saídas.
- O conector direto antigo do Sicredi PJ na Pluggy foi descontinuado. **Use o de Open Finance.**

### Plano B

Exportar o extrato em **OFX** pelo Sicredi Internet e importar manualmente enquanto a integração não estiver pronta.

---

## 2. Arquitetura

```
[React] OpenFinanceConnect.tsx
   │  POST /api/connect-token  → recebe accessToken (curta duração)
   │  abre o widget Pluggy Connect → usuário autoriza no app do Sicredi
   │  POST /api/items {itemId} → backend valida o item na Pluggy e salva
   ▼
[Flask] app.py ──► pluggy_client.py (auth + cache da API Key ~2h)
   ▲                    │
   │                    ▼
   │              sync.py → busca contas + transações → db.py (SQLite)
   │
[Pluggy] POST /api/webhooks/pluggy  (header Authorization: Bearer <segredo>)
   item/created · item/updated · item/error
   transactions/created · transactions/updated · transactions/deleted
```

### Estrutura de arquivos

```
rastro/
├── .env              ← credenciais reais (NUNCA vai para o git)
├── .env.example      ← modelo sem valores
├── .gitignore        ← ignora .env, rastro.db, __pycache__, node_modules
├── app.py            ← rotas Flask (connect-token, items, webhook)
├── pluggy_client.py  ← autenticação na Pluggy + connect token + retrieve_item
├── sync.py           ← sincronização das transações
├── db.py             ← SQLite: conexoes, transacoes, webhook_eventos
├── register_webhook.py ← registra o webhook na Pluggy com o header secreto
├── requirements.txt  ← flask, pluggy-sdk, python-dotenv
└── frontend/OpenFinanceConnect.tsx
```

---

## 3. Endpoints

| Rota                        | O que faz                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/connect-token`   | Body `{clientUserId}` e retorna `{accessToken}` para o widget                                                                           |
| `POST /api/items`           | Body `{clientUserId, itemId}`. Valida o item na Pluggy (404 se não for da sua aplicação) e salva                                        |
| `POST /api/webhooks/pluggy` | Recebe eventos da Pluggy. Exige o header `Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>`, responde em ms e processa em fila (2 workers) |

### Banco de dados (SQLite)

- **conexoes**: item_id, client_user_id, banco, status, erro
- **transacoes**: id, item_id, account_id, data, descricao, valor (**negativo = saída**), tipo (DEBIT/CREDIT), categoria_pluggy, contraparte (quem recebeu/pagou), **categoria** (do Rastro, a preencher)
- **webhook_eventos**: event_id, usado para ignorar eventos duplicados

---

## 4. Detalhes técnicos importantes (aprendidos testando)

- O SDK Python é o `pluggy-sdk` (v1.0). **Não existe `PluggyClient`.** O fluxo é `AuthApi.auth_create(client_id, secret)` → API Key → `Configuration(api_key={"default": key})`.
- O Connect Token é criado com `AuthApi.connect_token_create(ConnectTokenRequest(options=ItemOptions(clientUserId=..., avoidDuplicates=True)))`.
- Alguns ids do SDK chegam como `uuid.UUID`: converta com `str()` antes de salvar.
- A Pluggy **não assina webhooks**. A autenticação é feita com um header customizado, registrado via API (`register_webhook.py`).
- **Não use `webhookUrl` no Connect Token**, porque por ali o evento chega sem o header secreto.
- O webhook precisa de **HTTPS** e responder 2XX em até 10 s. Localhost não é aceito, então teste com **ngrok**.
- A Pluggy tenta reenviar até 3 vezes: na hora, depois de ~15 min e depois de ~2 h. Respostas 400/401/403/404/405 não são reenviadas.
- Para eventos de item, consulte `GET /items/{id}`, que é a fonte da verdade, em vez de confiar no payload.
- `includeSandbox`: `true` só em desenvolvimento (Pluggy Bank de teste).

---

## 5. Configuração (`.env`)

```env
PLUGGY_CLIENT_ID=<copiar do painel da Pluggy>
PLUGGY_CLIENT_SECRET=<copiar do painel da Pluggy>
PLUGGY_WEBHOOK_SECRET=<gerado com: python -c "import secrets; print(secrets.token_urlsafe(32))">
FLASK_DEBUG=1
```

> [!warning] Credenciais
> Os valores reais **não** ficam nesta nota. Estão só no arquivo `.env` do projeto.
> O Client Secret atual apareceu em um print. **Gere um novo no painel da Pluggy** e atualize o `.env`.

**Cuidados com o arquivo:**

- O nome precisa ser exatamente `.env`, não `env.example` nem `.env.txt`.
- Ele fica **na mesma pasta do `app.py`**, não em Downloads.
- Teste: `python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(os.environ.get('PLUGGY_CLIENT_ID'))"`

---

## 6. Como rodar

```bash
pip install -r requirements.txt
python app.py                         # sobe o backend na porta 5000
ngrok http 5000                       # gera a URL HTTPS pública
python register_webhook.py https://SEU-ENDERECO.ngrok.app/api/webhooks/pluggy

# frontend
npm i react-pluggy-connect pluggy-js
```

```tsx
<OpenFinanceConnect
  clientUserId="hometec"
  includeSandbox
  onConnected={(id) => console.log(id)}
/>
```

Com Vite, configure o proxy de `/api` para `http://localhost:5000` no `vite.config.ts`.

---

## 7. Status

- [x] Escolher abordagem (Open Finance via agregador)
- [x] Nome do sistema: Rastro
- [x] Conta e credenciais na Pluggy
- [x] Endpoint de Connect Token
- [x] Widget Pluggy Connect no React
- [x] Rota para salvar o `itemId`
- [x] Webhook com autenticação, deduplicação e sincronização
- [ ] Criar o `.env` corretamente na pasta do projeto
- [ ] Gerar um novo Client Secret
- [ ] Testar no sandbox e depois conectar a conta real do Sicredi
- [ ] **Categorização**: regras (ex.: "POSTO" vira Combustível) + Claude API para o que sobrar, com as correções virando regras novas
- [ ] **Centro de custo** por serviço: ar condicionado / elétrica / incêndio
- [ ] **Painel**: entradas e saídas por mês, por categoria e por serviço, mais saldo projetado
- [ ] Anexar nota fiscal só quando o contador pedir
- [ ] Login de verdade: tirar o `clientUserId` do corpo da requisição e pegar da sessão
- [ ] Verificar a marca no INPI (classes 9 e 42) e o domínio (rastro.com.br / rastro.app / userastro.com.br)

---

## 8. Alternativas de mercado (referência)

Conta Azul, Nibo, Organizze e Mobills já fazem a importação via Open Finance. O Rastro se diferencia pela categorização com IA e pelo centro de custo por tipo de serviço.

## Links

- Docs Pluggy: https://docs.pluggy.ai
- Pluggy Connect: https://docs.pluggy.ai/docs/pluggy-connect
- Webhooks: https://docs.pluggy.ai/docs/webhooks
- Portal Sicredi: https://developer.sicredi.com.br
- INPI: https://busca.inpi.gov.br
