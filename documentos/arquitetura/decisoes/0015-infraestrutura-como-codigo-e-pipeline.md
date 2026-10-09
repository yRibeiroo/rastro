# ADR 0015 — Infraestrutura como código e pipeline de CI

**Status:** Aceita (2026-10-09)

## Contexto
O PROMPT §8 pede infraestrutura versionada, um comando para subir o ambiente local, gitleaks no pre-commit e no CI, e um CI que bloqueie o merge se lint, tipos, testes (unidade, integração, ponta a ponta), build, Lighthouse ou varredura de segredos falharem. A equipe é de uma pessoa e o custo deve ser zero (GitHub Actions gratuito, Supabase local em Docker).

## Decisão

**O que é código no repositório**

| Arquivo | Papel |
|---|---|
| `supabase/config.toml` + `supabase/migrations/` | Banco, Auth, Storage e RLS (CLI do Supabase via `npx`, versão travada no `package-lock.json`) |
| `vercel.json` | Região `gru1` (São Paulo, perto do Supabase e da Pluggy) e Cron diário `GET /api/tarefas/ressincronizar` às 09:00 UTC (06:00 em Brasília), dentro do limite do Hobby (ADR 0007, ADR 0012) |
| `next.config.ts` | CSP e cabeçalhos de segurança (ADR 0014) |
| `.env.example` | Todas as variáveis, sem valores. Valores reais só no `.env.local` e na Vercel |
| `src/configuracao/ambiente.ts` | Leitura única das variáveis do servidor, validada com Zod e **preguiçosa**: o `next build` não precisa de segredos, e a falta de uma variável vira erro claro em português só quando ela é usada. `ambiente-publico.ts` faz o mesmo para as `NEXT_PUBLIC_` |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | Pipeline e atualização semanal de dependências e actions |
| `.githooks/pre-commit` | `gitleaks git --staged --redact` antes de cada commit |

**Ambiente local**: `npm run dev:completo` (`comandos/dev-completo.mjs`) roda `supabase start` e depois `next dev`, no Windows e no Linux. O `npm install` executa o script `prepare`, que aponta `core.hooksPath` para `.githooks/`.

**Segredos**: `npm run segredos` (`comandos/segredos.mjs`) procura o gitleaks no PATH ou em `~/bin` e varre **o git** (o histórico, ou só o stage com `--staged` no hook), nunca o diretório. Assim, arquivos ignorados como `.env.local` não geram falso positivo e nunca são lidos. No CI, o binário é baixado com versão fixa e checksum conferido, e o histórico inteiro é varrido (`fetch-depth: 0`). O binário foi preferido à `gitleaks/gitleaks-action` porque a action exige licença em contas de organização. Não há `.gitleaks.toml`: as regras padrão não acusam nada hoje. Crie um, com allowlist pontual, só se surgir falso positivo.

**Pipeline** (`pull_request` e `push` na `main`; cancela execuções antigas da mesma branch; permissão só de leitura):

| Job | O que roda | Depende de |
|---|---|---|
| `qualidade` | `lint`, `tipos`, `formatar:verificar` | — |
| `unidade` | `testar:cobertura` (≥ 80% em `src/regras-de-negocio/**`) | — |
| `integracao` | `supabase start` → `db reset` → `testar:banco` (pgTAP) → `testar:integracao` | — |
| `build` | `next build` com variáveis falsas | — |
| `e2e` | Supabase local + build + Playwright (Chromium desktop e celular) | `qualidade` |
| `lighthouse` | Supabase local + build + `lhci autorun` (≥ 0,9 em performance, acessibilidade e boas práticas) | `qualidade` |
| `segredos` | gitleaks no histórico completo | — |

Nos jobs, as chaves do Supabase vêm do próprio Supabase local (`comandos/ambiente-supabase-local.mjs`, mascaradas no log). As demais variáveis são valores **falsos** declarados no workflow. O CI não usa nenhum segredo real.

**Deploy**: pela integração Git da Vercel (preview por branch, produção a partir da `main`), não pelo Actions. A proteção da `main` exige todos os jobs acima (passo a passo em `documentos/qualidade/ci.md`).

## Consequências
- (+) Um clone limpo roda tudo com `npm ci` + Docker, e o CI é reproduzível localmente com os mesmos scripts.
- (+) Nenhum segredo no GitHub. Vazamento é barrado no commit e no CI.
- (−) Os jobs com Supabase local levam alguns minutos para subir os containers (serviços não usados são excluídos com `-x`).
- (−) `e2e` e `lighthouse` fazem o próprio build em vez de reaproveitar o do job `build`: troca tempo de CI por simplicidade. Se o tempo incomodar, publicar `.next` como artefato.
- (−) As actions estão fixadas por tag maior (`@v4`), não por SHA. O Dependabot as mantém atualizadas. Fixar por SHA se o repositório virar público ou comercial.

## Alternativas consideradas
- **Terraform para Vercel/Supabase**: exagero para um projeto e uma pessoa. O `vercel.json` e as migrações cobrem o que muda com frequência.
- **Husky/lefthook**: mais uma dependência para um único hook. `core.hooksPath` é nativo do git.
- **Supabase de staging na nuvem para os testes**: custo e segredos no CI. O Supabase local roda as mesmas migrações.
- **Deploy pelo GitHub Actions (`vercel deploy`)**: exigiria token da Vercel no GitHub. A integração nativa faz o mesmo sem segredo.
