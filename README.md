# Rastro

> Saiba para onde vai cada real.

Controle financeiro da **HOMETEC SERVIÇOS**. O Rastro importa o extrato OFX da conta PJ do Sicredi, categoriza cada lançamento (regras, depois a categoria do banco, depois o Claude), separa por centro de custo (ar condicionado, elétrica, incêndio etc.) e mostra um painel de entradas e saídas. Comprovantes (Pix, boleto, NFC-e, NF-e, recibo) são lidos pelo Claude e conciliados sozinhos com a transação certa. A integração Open Finance via Pluggy está pronta no código, mas desligada (`RECURSO_OPEN_FINANCE=0`).

Versão atual: **1.0.0** (ver [CHANGELOG.md](CHANGELOG.md)).

## Stack

- **Next.js 16** (App Router) com **TypeScript estrito** e **Tailwind CSS 4**
- **Supabase**: Postgres com RLS, Auth (link mágico) e Storage
- **Vercel**: hospedagem (região `gru1`) e cron diário
- **Claude** (API da Anthropic): categorização e leitura de comprovantes
- Testes: Vitest, pgTAP (`supabase test db`), Playwright + axe, Lighthouse CI, gitleaks

## Como rodar local

Pré-requisitos: Node 22.18 ou mais novo e Docker Desktop aberto (o Supabase local roda em contêineres).

```bash
npm install
cp .env.example .env.local   # preencha os valores (veja "Variáveis de ambiente")
npm run dev:completo         # sobe o Supabase local e o Next em http://localhost:3000
```

- `npm run dev:completo` roda `npx supabase start` e depois `next dev`. Ao sair (Ctrl+C) o Supabase continua no ar; para parar: `npx supabase stop`.
- As chaves do Supabase local aparecem em `npx supabase status`. Use a URL da API, a chave publicável e a chave secreta no `.env.local`.
- Os e-mails do link mágico chegam no Mailpit local (endereço também em `npx supabase status`).
- `npm run dev` sobe só o Next (útil se o Supabase local já estiver rodando).
- `npm run tipos-do-banco` regenera `src/acesso-a-dados/supabase/tipos-do-banco.ts` a partir do banco local.

## Testes e verificações

| Comando                    | O que faz                                                                         |
| -------------------------- | --------------------------------------------------------------------------------- |
| `npm run tipos`            | Gera os tipos de rota do Next e roda `tsc --noEmit`                               |
| `npm run lint`             | ESLint                                                                            |
| `npm run formatar`         | Prettier em todo o projeto (`formatar:verificar` só confere)                      |
| `npm run testar`           | Testes de unidade (regras de negócio e componentes)                               |
| `npm run testar:cobertura` | Os mesmos, com relatório de cobertura                                             |
| `npm run testar:banco`     | Testes pgTAP do banco (RLS, funções); precisa do Supabase local                   |
| `npm run testar:e2e`       | Playwright sobre o build de produção (rode `npm run build` antes; Supabase local) |
| `npm run lighthouse`       | Lighthouse CI (desempenho, acessibilidade, boas práticas)                         |
| `npm run segredos`         | Procura segredos vazados com o gitleaks                                           |

O CI (`.github/workflows/ci.yml`) roda 7 jobs em todo pull request: `qualidade`, `unidade`, `integracao`, `build`, `e2e`, `lighthouse` e `segredos`. Detalhes em [documentos/qualidade/ci.md](documentos/qualidade/ci.md).

## Variáveis de ambiente

A lista completa, sem valores, está em [.env.example](.env.example). Resumo:

- **Públicas** (vão para o navegador): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Secretas** (só no servidor): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `EMAIL_AUTORIZADO` e, se a Pluggy for religada, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET`.
- **Configuração**: `URL_DO_SITE`, `ANTHROPIC_MODELO`, `ANTHROPIC_MODELO_COMPROVANTES`, `IA_LIMITE_COMPROVANTES_MES` e as flags `RECURSO_*` (0 ou 1).

Nunca coloque valores reais no `.env.example` nem no git. O `.env.local` é ignorado pelo git.

## Deploy

- A Vercel fica ligada ao repositório GitHub **yRibeiroo/rastro**: cada push na `main` publica em produção e cada pull request ganha uma prévia.
- Região das funções: `gru1` (São Paulo), definida em [vercel.json](vercel.json).
- Cron diário em `vercel.json`: `GET /api/tarefas/ressincronizar` às 09:00 UTC (06:00 em Araguaína), autenticado por `CRON_SECRET`. Reconcilia comprovantes pendentes e, com Open Finance ligado, ressincroniza a Pluggy.
- Migrações do banco **não** rodam no deploy: são aplicadas à parte com a CLI do Supabase.

Passo a passo de produção (variáveis, migrações, Auth, backup, segredos): [documentos/operacao.md](documentos/operacao.md).

## Documentos

- [documentos/PARA-O-DAVI.md](documentos/PARA-O-DAVI.md): o que falta o dono fazer, em ordem
- [documentos/operacao.md](documentos/operacao.md): guia de operação
- [documentos/evolucao/roteiro.md](documentos/evolucao/roteiro.md): próximas versões
- [documentos/especificacao/](documentos/especificacao/): requisitos, histórias, premissas, riscos, viabilidade e fora do escopo
- [documentos/arquitetura/](documentos/arquitetura/): visão geral, modelo de dados, contratos, glossário e [decisões (ADRs)](documentos/arquitetura/decisoes/)
- [documentos/design/](documentos/design/): design system, fluxos, wireframes e contraste
- [documentos/qualidade/](documentos/qualidade/): plano de testes, CI e revisões de código
- [documentos/rastreabilidade.md](documentos/rastreabilidade.md): requisito → história → código → testes
- [CONTEXTO.md](CONTEXTO.md): histórico e estado do projeto
