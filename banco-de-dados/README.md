# Banco de dados (Supabase / Postgres 17)

Especificação: [`documentos/arquitetura/modelo-de-dados.md`](../documentos/arquitetura/modelo-de-dados.md). Desvios e complementos: [ADR 0013](../documentos/arquitetura/decisoes/0013-ajustes-no-modelo-de-dados.md).

| Onde | O quê |
|---|---|
| `supabase/config.toml` | Stack local (projeto `rastro`), auth por link mágico, Mailpit |
| `supabase/migrations/` | Migrações versionadas, uma por assunto |
| `supabase/seed.sql` | Seed de desenvolvimento ([como usar](seeds/README.md)) |
| `supabase/tests/` | Testes pgTAP (RLS, `garantir_empresa`, painéis, proteção da categoria) |
| `src/acesso-a-dados/tipos-do-banco.ts` | Tipos gerados (`supabase gen types`) |

## Como rodar

Requer Docker Desktop. O CLI é devDependency (`npx supabase`). Só ambiente **local**.

```bash
npx supabase start            # sobe a stack (primeira vez baixa as imagens)
npx supabase db reset         # recria o banco: migrações + seed
npx supabase test db          # testes pgTAP
npx supabase db lint          # plpgsql_check
npx supabase gen types typescript --local > src/acesso-a-dados/tipos-do-banco.ts
npx supabase status           # URLs e chaves locais
npx supabase stop             # para a stack (mantém os dados)
```

Nova migração: `npx supabase migration new <assunto>`, depois `db reset` + `test db` + regenerar os tipos.

| Serviço local | URL |
|---|---|
| API (REST/Auth/Storage) | http://127.0.0.1:54321 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio | http://127.0.0.1:54323 |
| Mailpit (e-mails do link mágico) | http://127.0.0.1:54324 |

## Migrações

| Arquivo | Assunto |
|---|---|
| `20261009120000_extensoes_e_esquema_privado` | `pgcrypto`, `pg_trgm`, schema `privado`, gatilho `definir_atualizado_em` |
| `20261009120100_empresas_e_membros` | `empresas`, `membros_empresa`, `privado.empresa_do_usuario()` |
| `20261009120200_conexoes_e_contas` | `conexoes`, `contas` |
| `20261009120300_categorias_centros_e_regras` | `categorias`, `centros_de_custo`, `regras_categorizacao` |
| `20261009120400_transacoes` | `transacoes`, índices do extrato, gatilho de proteção da categoria do usuário |
| `20261009120500_anexos_e_storage` | `anexos`, bucket privado `anexos` e policies do Storage |
| `20261009120600_eventos_webhook_e_limites` | `eventos_webhook`, `limites_de_requisicao` |
| `20261009120700_funcoes_rpc` | `garantir_empresa`, `painel_*`, `consumir_limite_de_requisicao`, `aplicar_categorizacao_automatica` |

## Esquema

```mermaid
erDiagram
  empresas ||--o{ membros_empresa : tem
  auth_users ||--o{ membros_empresa : participa
  empresas ||--o{ conexoes : tem
  conexoes ||--o{ contas : tem
  conexoes ||--o{ transacoes : origina
  contas ||--o{ transacoes : tem
  empresas ||--o{ categorias : tem
  empresas ||--o{ centros_de_custo : tem
  empresas ||--o{ regras_categorizacao : tem
  categorias ||--o{ regras_categorizacao : alvo
  centros_de_custo |o--o{ regras_categorizacao : alvo_opcional
  categorias |o--o{ transacoes : classifica
  centros_de_custo |o--o{ transacoes : atribui
  regras_categorizacao |o--o{ transacoes : aplicou
  transacoes ||--o{ anexos : tem
  empresas |o--o{ eventos_webhook : "resolvida depois"

  empresas { uuid id PK; text nome }
  membros_empresa { uuid empresa_id PK; uuid user_id PK; text papel }
  conexoes { uuid id PK; uuid empresa_id; text provedor; text id_externo; text status }
  contas { uuid id PK; uuid empresa_id; uuid conexao_id; text id_externo; text tipo; numeric saldo }
  categorias { uuid id PK; uuid empresa_id; text nome; text tipo; bool entra_no_resultado }
  centros_de_custo { uuid id PK; uuid empresa_id; text nome }
  regras_categorizacao { uuid id PK; uuid empresa_id; text padrao; text campo; int prioridade; uuid categoria_id }
  transacoes { uuid id PK; uuid empresa_id; text id_externo; date data; numeric valor; uuid categoria_id; bool categoria_definida_pelo_usuario }
  anexos { uuid id PK; uuid empresa_id; uuid transacao_id; text caminho }
  eventos_webhook { text event_id PK; uuid empresa_id }
  limites_de_requisicao { text chave PK; timestamptz janela PK; int contador }
```

Pontos-chave:

- **Dinheiro** em `numeric(14,2)`, negativo = saída. Os painéis devolvem `bigint` em centavos.
- **`empresa_id` em toda tabela de negócio**, e as referências entre tabelas são **FKs compostas** `(empresa_id, x_id)`: não dá para apontar para a categoria/conta/transação de outra empresa (ADR 0013).
- **Upsert da sincronização**: `on conflict (empresa_id, id_externo) do update` só com `data, descricao, descricao_original, valor, pendente, contraparte, metodo_de_pagamento, categoria_do_provedor, conta_id`. Nunca as colunas de categoria.
- **Categoria do usuário** (`categoria_definida_pelo_usuario = true`): o gatilho `privado.proteger_categoria_do_usuario` impede desligar o flag; o check `origem = 'usuario'` barra escrita automática; a RPC `aplicar_categorizacao_automatica` filtra `not categoria_definida_pelo_usuario`.
- `atualizado_em` em `conexoes`, `contas` e `transacoes`, mantido pelo gatilho `privado.definir_atualizado_em()`.
- Índices do extrato: `(empresa_id, data desc, id)`, `(empresa_id, categoria_id, data)`, `(empresa_id, centro_de_custo_id, data)`, parcial de pendentes de categorização, GIN trigram em `descricao` e `contraparte`, e índices em todas as FKs.

## Segurança

- **RLS habilitada e forçada** em todas as tabelas do `public`.
- `privado.empresa_do_usuario()` (`security definer`, `search_path = ''`, schema não exposto) devolve as empresas do usuário logado. As policies usam `empresa_id in (select privado.empresa_do_usuario())`.
- **Grants explícitos** (`auto_expose_new_tables = false`): `anon` não tem acesso a nenhuma tabela nem RPC.

| Tabela | `authenticated` | Observação |
|---|---|---|
| `empresas` | select; update (`nome`) | criação só por `garantir_empresa` |
| `membros_empresa` | select (só as próprias) | escrita só por função/service role |
| `conexoes`, `contas` | select, update | insert/delete só pela sincronização (service role) |
| `transacoes` | select; update só das colunas de categorização | insert/delete só pela sincronização |
| `categorias`, `centros_de_custo`, `regras_categorizacao`, `anexos` | select, insert, update, delete | |
| `eventos_webhook`, `limites_de_requisicao` | — | nenhuma policy: só `service_role` |

Storage: bucket `anexos` privado (10 MB; PDF, JPEG, PNG, WebP). Policies de select/insert/update/delete em `storage.objects` exigem que a primeira pasta do caminho seja uma empresa do usuário (`{empresa_id}/{transacao_id}/{uuid}.{ext}`). Download só por URL assinada gerada no servidor.

## RPCs

| Assinatura | Segurança | Quem executa |
|---|---|---|
| `garantir_empresa(p_nome text) returns uuid` | definer, idempotente (advisory lock no uid) | authenticated, service_role |
| `painel_fluxo_mensal(p_empresa uuid, p_de date, p_ate date) returns table (mes text, entradas_centavos bigint, saidas_centavos bigint)` | invoker | authenticated, service_role |
| `painel_por_categoria(p_empresa uuid, p_de date, p_ate date) returns table (categoria_id uuid, nome text, total_centavos bigint, quantidade integer)` | invoker | authenticated, service_role |
| `painel_por_centro_de_custo(p_empresa uuid, p_de date, p_ate date) returns table (centro_de_custo_id uuid, nome text, entradas_centavos bigint, saidas_centavos bigint)` | invoker | authenticated, service_role |
| `aplicar_categorizacao_automatica(p_empresa uuid, p_resultados jsonb) returns integer` | invoker | authenticated, service_role |
| `consumir_limite_de_requisicao(p_chave text, p_maximo integer, p_janela_segundos integer) returns boolean` | definer | só service_role |

Painéis: excluem `pendente = true` e categorias com `entra_no_resultado = false` (Transferências); `null` = "Sem categoria" / "Sem centro de custo"; meses sem movimento aparecem com zero; período inválido ou acima de ~24 meses gera `22023 periodo_invalido`. `transacoes.data` é `date`; o app calcula o período no fuso `America/Araguaina`.

## Testes

`npx supabase test db` roda os arquivos de `supabase/tests/` (pgTAP, cada um numa transação com rollback):

- `01_rls_isolamento_entre_empresas.sql`: A não lê, insere, altera nem remove nada de B em cada tabela e no Storage; FKs compostas barram referência cruzada; `anon` não lê nada; infraestrutura só service role.
- `02_garantir_empresa.sql`: idempotência, membro dono, sementes, recusa sem sessão.
- `03_painel.sql`: somas em centavos, meses vazios, transferências e pendentes ignorados, `entra_no_resultado` respeitado.
- `04_categoria_do_usuario_e_limites.sql`: upsert não toca a categoria do usuário, gatilho de proteção, RPC de aplicação automática, `atualizado_em`, rate limit.
