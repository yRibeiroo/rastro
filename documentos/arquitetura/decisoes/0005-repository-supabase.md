# ADR 0005 — Repository sobre o Supabase

**Status:** Aceita (2026-10-09)

## Contexto
As regras de negócio precisam ler e gravar no Postgres em dois contextos: com a sessão do usuário (RLS aplicada) e com service role (webhook, cron), em que a RLS **não** se aplica. Os testes de unidade não devem precisar de banco. A conversão `numeric(14,2)` ↔ centavos e `snake_case` ↔ `camelCase` não deve vazar para o domínio.

## Decisão
- Padrão **Repository**: uma interface por agregado (contratos §10), implementada em `src/acesso-a-dados/repositorio-de-*.ts` sobre `SupabaseClient<BancoDeDados>` (tipos gerados pelo `supabase gen types`).
- O repositório **recebe o cliente no construtor**. A raiz de composição (`montagem.ts`) decide se injeta `clienteDoUsuario()` ou `clienteDoSistema()`.
- **Todo método recebe `empresaId`** e filtra por ele, mesmo com a RLS. No caminho com service role essa é a única proteção entre empresas. As exceções são explícitas e restritas ao sistema: `buscarPorIdExterno`, `listarTodas`.
- Mapeamento linha → domínio em funções puras no próprio arquivo (`paraTransacao(linha)`), com conversão de dinheiro `Math.round(Number(valor) * 100)`.
- Agregações do painel ficam em **funções SQL** (`painel_*`, `security invoker`), chamadas por `rpc()`. A soma é exata em `numeric`, e o resultado já vem em centavos.
- Operações que precisam de atomicidade (`garantir_empresa`, `consumir_limite_de_requisicao`) são funções SQL, não sequências de chamadas.

## Consequências
- (+) A interface nunca toca no banco. Os serviços são testados com repositórios em memória.
- (+) Um só lugar para a regra "o upsert da sincronização nunca altera a categoria".
- (−) Mais arquivos que chamar o Supabase direto nas telas.
- (−) O PostgREST não faz transação entre várias chamadas. Onde for preciso, usa-se função SQL.

## Alternativas consideradas
- **ORM (Drizzle/Prisma) com conexão direta ao Postgres**: perderia a RLS por sessão do usuário (a conexão é de serviço) e adicionaria pool de conexões em serverless.
- **Supabase direto nos Server Components**: rápido no começo, mas acopla a interface ao esquema e viola a separação pedida no PROMPT §6.
