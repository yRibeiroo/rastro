# ADR 0013 — Ajustes no modelo de dados durante a implementação

**Status:** Aceita (2026-10-09)

## Contexto
Ao implementar `modelo-de-dados.md` em `supabase/migrations/`, apareceram lacunas que deixariam a RLS furável ou que quebram em tempo de execução. Este ADR registra cada desvio; o resto do modelo foi implementado literalmente.

## Decisão

1. **FKs compostas por empresa.** As policies só conferem a coluna `empresa_id` da linha. Com FK simples, um usuário da empresa A podia gravar na própria transação um `categoria_id` (ou centro de custo, regra, conta) da empresa B: a FK só verifica existência. Por isso as tabelas referenciadas têm `unique (empresa_id, id)` e as FKs são compostas: `transacoes (empresa_id, conta_id | conexao_id | categoria_id | centro_de_custo_id | regra_id)`, `contas (empresa_id, conexao_id)`, `regras_categorizacao (empresa_id, categoria_id | centro_de_custo_id)` e `anexos (empresa_id, transacao_id)`. O `on delete set null` vira `on delete set null (coluna)` (Postgres 15+), para não anular `empresa_id`. O `unique (empresa_id, id)` também serve como o índice `(empresa_id)` pedido em `conexoes` e `contas`.
2. **`regras_categorizacao.categoria_id`: `no action` em vez de `restrict`.** `restrict` é verificado na hora e quebra o `delete from empresas` em cascata (as categorias somem antes das regras). `no action` é verificado no fim do comando e continua impedindo apagar uma categoria usada por regra.
3. **Policy do Storage compara texto.** `(storage.foldername(name))[1]::uuid` gera erro de cast em nomes que não são uuid. A policy usa `(storage.foldername(name))[1] in (select e::text from privado.empresa_do_usuario() e)`, que simplesmente não casa.
4. **`transacoes`: update só nas colunas de categorização.** O modelo diz que o usuário só altera categoria e centro de custo, mas a policy de update libera a linha inteira. Grant de update por coluna para `authenticated`: `categoria_id, centro_de_custo_id, categoria_origem, categoria_definida_pelo_usuario, regra_id, confianca_ia, categorizacao_automatica_em`. Valor, data e descrição só mudam pelo service role.
5. **`empresas`: o nome é editável** (ADR 0008 diz "O nome é editável depois", mas o modelo só dava `select`). Policy de update para membros e grant só da coluna `nome`.
6. **Categoria do usuário defendida no banco**, além do upsert que não lista as colunas de categoria:
   - gatilho `privado.proteger_categoria_do_usuario()`: se um update tenta desligar `categoria_definida_pelo_usuario`, as colunas de categoria voltam ao valor anterior;
   - o check `not categoria_definida_pelo_usuario or categoria_origem = 'usuario'` barra escrita automática que mantenha o flag;
   - nova RPC `public.aplicar_categorizacao_automatica(p_empresa uuid, p_resultados jsonb) returns integer` (`security invoker`) para `RepositorioDeTransacoes.aplicarCategorizacaoAutomatica`: o filtro `not categoria_definida_pelo_usuario` fica no SQL e marca `categorizacao_automatica_em`.
7. **Funções auxiliares em `privado`:** `semear_empresa(uuid)` (sementes usadas por `garantir_empresa` e pelo seed de dev) e `validar_periodo(date, date)` (os painéis recusam período invertido ou acima de ~24 meses com `22023 periodo_invalido`).
8. **Fuso horário nos painéis.** `transacoes.data` já é `date`, então os painéis agrupam por ela sem conversão; o período (`p_de`, `p_ate`) é calculado pelo app em `America/Araguaina`. **Ponto em aberto para a sincronização:** o modelo diz que `data` é a "data UTC do campo `date` da Pluggy". Um lançamento às 22h em Palmas é 01h UTC do dia seguinte; converter o `date` da Pluggy para `America/Araguaina` antes de truncar evita cair no dia (e às vezes no mês) errado.
9. **Sementes:** `premissas.md` (P-09) e `modelo-de-dados.md` listam categorias diferentes. Foi implementada a lista do modelo de dados (mais recente e específica do cliente). Não entraram as regras `DAS` e `CESTA` sozinhas: "contém DAS" casa com "VENDAS", "TODAS" etc. Elas são cobertas por `SIMPLES NACIONAL` e `CESTA DE RELACIONAMENTO`.
10. **Checks extras baratos:** `regras_categorizacao.padrao` precisa estar em maiúsculas e com espaços colapsados (o app ainda remove acentos); `contas.numero` tem no máximo 4 caracteres (minimização); `anexos.caminho` precisa começar com `{empresa_id}/{transacao_id}/`; `eventos_webhook.erro` tem no máximo 500 caracteres.
11. **Nada é exposto por padrão:** `auto_expose_new_tables = false` no `config.toml` e grants explícitos por tabela/função (anon não tem grant em nada do `public`). Faça o mesmo no projeto hospedado (Data API → desligar exposição automática), ou os grants padrão do Supabase reaparecem em tabelas novas.
12. **Função de dev fora das migrações:** `privado.dev_vincular_usuario_a_demo(email)` existe só em `supabase/seed.sql`, no schema privado e sem grant para nenhum papel da API.

## Consequências
- (+) Um bug no app com a sessão do usuário não consegue cruzar empresas nem por FK, nem alterar dados bancários.
- (+) A proteção da categoria do usuário não depende só da disciplina do repositório.
- (−) FKs compostas exigem `empresa_id` em todo insert/update que referencie outra tabela (o repositório já recebe `empresaId`).
- (−) O app precisa usar a RPC (ou repetir o filtro) para a categorização automática.

## Alternativas consideradas
- **Validar a empresa das referências em gatilhos**: mais código e mais lento que FK composta.
- **Policies de update com subconsultas nas tabelas referenciadas**: custo por linha e fácil de esquecer em tabela nova.
