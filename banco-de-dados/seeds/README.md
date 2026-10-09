# Seeds de desenvolvimento

O seed fica em [`supabase/seed.sql`](../../supabase/seed.sql) (caminho configurado em `supabase/config.toml`, `[db.seed] sql_paths`). Ele **só roda no Supabase local** e nunca em produção: `supabase db push` não aplica seed.

## Quando é aplicado

- `npx supabase start` na primeira vez (banco novo).
- `npx supabase db reset`: recria o banco, aplica todas as migrações e depois o seed.

## O que ele cria

- Empresa de demonstração `00000000-0000-4000-a000-000000000001` — "Tocantins Climatização e Elétrica (demo)", com as sementes padrão (18 categorias, 4 centros de custo, 11 regras).
- Uma conexão fictícia (Sicoob Empresas, `id_externo = demo-item-sicoob`) com conta corrente e poupança.
- 120 transações nos **6 últimos meses** (datas relativas a `current_date`): recebimentos de condomínios, supermercado e clínica; posto de combustível, Elétrica Tocantins, peças de refrigeração, extintores, tarifas, IOF, DARF, Simples Nacional, Energisa, aluguel, folha, FGTS e transferências entre contas.
- Categorização: as regras padrão já aplicadas (`categoria_origem = 'regra'`); algumas correções "do usuário" nos meses anteriores (`categoria_definida_pelo_usuario = true`); o mês atual tem lançamentos **sem categoria** e uma transação **pendente**, para exercitar o painel e o extrato.

O seed não cria usuários.

## Associar seu login local à empresa de demonstração

1. Rode o app (`npm run dev`) e entre em `http://localhost:3000` com seu e-mail (precisa estar em `EMAIL_AUTORIZADO`).
2. Abra o link mágico no Mailpit: <http://127.0.0.1:54324>.
3. No primeiro login o `garantir_empresa` cria uma empresa vazia para você. Para trocar pela demo, rode como `postgres` (Studio → SQL editor em <http://127.0.0.1:54323>, ou psql):

   ```sql
   select privado.dev_vincular_usuario_a_demo('voce@exemplo.com');
   ```

   A função apaga a empresa vazia do seu usuário (se você for o único membro dela) e cria a membership `dono` na empresa demo. Ela existe **só** no seed, no schema `privado`, sem grant para `anon`, `authenticated` ou `service_role`.

   Por psql:

   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select privado.dev_vincular_usuario_a_demo('voce@exemplo.com');"
   ```

4. Recarregue a página. Depois de um `db reset` o usuário some (o `auth` é recriado): entre de novo e repita o passo 3.
