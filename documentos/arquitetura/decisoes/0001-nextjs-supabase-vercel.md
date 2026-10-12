# ADR 0001 — Next.js + Supabase + Vercel no lugar de Flask + SQLite

**Status:** Aceita (2026-10-09)

## Contexto
O protótipo (`prototipo-flask/`) provou a integração com a Pluggy em Flask + SQLite, com fila em `ThreadPoolExecutor` e React separado em Vite. A v1 precisa de login, RLS, armazenamento privado de arquivos, deploy gerenciado, HTTPS público para o webhook e manutenção por uma pessoa. Num serverless, SQLite e threads em memória não sobrevivem.

## Decisão
- **Next.js 16 (App Router) + TypeScript estrito + Tailwind 4**, um único projeto com interface e servidor (Server Components, Server Actions e Route Handlers).
- **Supabase**: Postgres com RLS, Auth (link mágico), Storage privado e migrações via CLI.
- **Vercel**: deploy, preview por branch, Cron e `after()` para o trabalho depois da resposta.
- O protótipo Flask fica **só como referência** de regras de negócio.
- Monólito modular (ver [visão geral](../visao-geral.md)).

## Consequências
- (+) Uma linguagem só, tipos compartilhados entre a interface e o servidor, HTTPS sem ngrok em preview e produção.
- (+) Segurança por RLS no banco em vez de só no código.
- (−) Sem processo de longa duração: a fila em memória do Flask vira `after()` + deduplicação + cron (ADR 0007).
- (−) Dependência de três fornecedores (Vercel, Supabase, Pluggy) e dos limites dos planos gratuitos (ADR 0012).
- (−) O Next 16 tem mudanças de API (`proxy.ts`, `cacheComponents`): a equipe consulta `node_modules/next/dist/docs/` antes de codar.

## Alternativas consideradas
- **Manter Flask + Postgres em VPS**: exigiria manter servidor, TLS, backups e deploy. É trabalho de operação demais para uma pessoa.
- **Remix/SvelteKit**: viáveis, mas o PROMPT define o caminho pavimentado e o `react-pluggy-connect` é React.
- **Firebase**: modelo de documentos ruim para agregações financeiras. Postgres é a escolha natural para dados relacionais com ACID.
