# ADR 0006 — Multiempresa com `empresa_id` + RLS desde a v1

**Status:** Aceita (2026-10-09)

## Contexto
A v1 tem um usuário e uma empresa, mas o roteiro prevê um SaaS regional. Adicionar o isolamento entre empresas depois exige migrar todos os dados e revisar todas as consultas, o que é caro e arriscado. O Supabase expõe as tabelas pela API com a chave publicável, então a RLS é obrigatória de qualquer forma.

## Decisão
- Toda tabela de negócio tem `empresa_id not null` e índice que começa por `empresa_id`.
- `membros_empresa (empresa_id, user_id, papel)` liga usuários a empresas (N:N, pronto para multiusuário).
- Função `privado.empresa_do_usuario() returns setof uuid` (`security definer`, `search_path = ''`, schema não exposto), usada nas policies como `empresa_id in (select privado.empresa_do_usuario())`. O `select` envolvendo a função faz o Postgres avaliá-la uma vez por consulta.
- **RLS ligada e forçada em todas as tabelas**, inclusive nas de infraestrutura (sem policy = só service role).
- `transacoes`, `contas` e `conexoes` não aceitam `insert`/`delete` pela sessão do usuário: só a sincronização cria e remove.
- Storage: o caminho começa com `empresa_id`, e a policy de `storage.objects` usa a mesma função.
- Teste de integração obrigatório: um usuário da empresa B não lê nem altera nada da empresa A (tabelas, RPCs e Storage).
- A empresa é criada no primeiro login (ADR 0008).

## Consequências
- (+) O SaaS não exige migração de dados, só de interface (convites, troca de empresa).
- (+) Defesa em profundidade: mesmo um bug no código não vaza dados pela sessão do usuário.
- (−) Toda consulta e índice carrega `empresa_id`.
- (−) O caminho com service role ignora a RLS. Mitigação: `empresaId` obrigatório nos repositórios (ADR 0005) e teste específico.
- Na v1 o contexto usa **a primeira** membership do usuário. A troca de empresa fica para a versão multiempresa (flag `RECURSO_MULTIEMPRESA`).

## Alternativas consideradas
- **Schema por empresa**: isolamento forte, mas migrações N vezes e incompatível com a API do Supabase.
- **Projeto Supabase por empresa**: custo e operação inviáveis.
- **Sem RLS, filtrando só no código**: com a chave publicável exposta, qualquer um leria tudo.
