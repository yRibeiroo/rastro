# Estrutura de pastas

Baseada na árvore do PROMPT §7, ajustada ao Next.js 16 (ver [ADR 0009](decisoes/0009-nomes-de-pastas-em-portugues.md)). Os nomes são em português, sem `utils`, `helpers`, `lib`, `misc`, `common` ou `services`. As exceções são o que o framework ou as ferramentas exigem: `src/app`, `public`, `supabase`, `.github`, `node_modules`, `proxy.ts`, `route.ts`, `page.tsx`, `layout.tsx` e os arquivos de configuração na raiz.

```
rastro/
├── src/
│   ├── proxy.ts                         # Next 16: substitui middleware.ts. Renova a sessão Supabase,
│   │                                    #   redireciona para /entrar e confere EMAIL_AUTORIZADO
│   ├── app/                             # rotas (exigido pelo Next.js). URLs em português
│   │   ├── layout.tsx                   # html, fontes, tema, <AnimacaoDeAbertura/>
│   │   ├── page.tsx                     # redireciona para /painel
│   │   ├── globals.css
│   │   ├── (entrada)/                   # grupo sem sessão (não aparece na URL)
│   │   │   └── entrar/
│   │   │       ├── page.tsx             # formulário do link mágico
│   │   │       ├── acoes.ts             # Server Action enviarLinkMagico
│   │   │       └── confirmar/route.ts   # callback do link mágico (troca o code, allowlist, garantir_empresa)
│   │   ├── (sistema)/                   # grupo com sessão obrigatória (não aparece na URL)
│   │   │   ├── layout.tsx               # chama servicosDoUsuario(); navegação
│   │   │   ├── painel/page.tsx
│   │   │   ├── extrato/{page.tsx, acoes.ts}
│   │   │   ├── categorias/{page.tsx, acoes.ts}          # categorias + regras
│   │   │   ├── centros-de-custo/{page.tsx, acoes.ts}
│   │   │   └── conexoes-bancarias/{page.tsx, acoes.ts}
│   │   └── api/
│   │       ├── webhooks/pluggy/route.ts          # POST da Pluggy (Bearer + dedup + after())
│   │       └── tarefas/ressincronizar/route.ts   # GET da Vercel Cron (Bearer CRON_SECRET)
│   ├── componentes/                     # peças de interface reutilizáveis (tabela do extrato, gráficos, filtros)
│   ├── identidade-visual/               # tokens de design, logo SVG, animação de abertura, <Carregando/>
│   ├── regras-de-negocio/
│   │   ├── tipos.ts                     # tipos de domínio compartilhados
│   │   ├── erros.ts                     # ErroDeNegocio, ResultadoDaAcao
│   │   ├── montagem.ts                  # raiz de composição: servicosDoUsuario() / servicosDoSistema()
│   │   ├── acesso/                      # sessão, allowlist, empresa, rate limit
│   │   ├── conexao-bancaria/
│   │   │   ├── index.ts                 # interface pública do módulo
│   │   │   ├── provedor-bancario.ts     # contrato ProvedorBancario + tipos neutros
│   │   │   ├── servico.ts
│   │   │   ├── webhook.ts               # webhookAutorizado()
│   │   │   └── adaptadores/pluggy/      # ÚNICO lugar com import de 'pluggy-sdk'
│   │   ├── extrato/                     # sincronização + consulta do extrato
│   │   ├── categorizacao/
│   │   │   ├── index.ts
│   │   │   ├── servico.ts
│   │   │   ├── normalizar-texto.ts
│   │   │   ├── classificador.ts         # contrato Classificador
│   │   │   ├── estrategias/             # por-regras.ts, por-categoria-do-provedor.ts, por-ia.ts
│   │   │   └── adaptadores/claude/      # ÚNICO lugar com import de '@anthropic-ai/sdk'
│   │   ├── centros-de-custo/
│   │   ├── painel/
│   │   └── anexos/
│   ├── acesso-a-dados/                  # repositórios (Repository) sobre o Supabase
│   │   ├── supabase/
│   │   │   ├── cliente-do-usuario.ts    # @supabase/ssr + cookies (RLS)
│   │   │   ├── cliente-do-sistema.ts    # service role: só webhook, cron e rate limit
│   │   │   └── tipos-do-banco.ts        # gerado: supabase gen types typescript
│   │   ├── repositorio-de-empresas.ts
│   │   ├── repositorio-de-conexoes.ts
│   │   ├── repositorio-de-contas.ts
│   │   ├── repositorio-de-transacoes.ts
│   │   ├── repositorio-de-categorias.ts
│   │   ├── repositorio-de-centros-de-custo.ts
│   │   ├── repositorio-de-regras.ts
│   │   ├── repositorio-de-anexos.ts     # + ArmazenamentoDeArquivos (Storage)
│   │   ├── repositorio-de-eventos-de-webhook.ts
│   │   ├── repositorio-do-painel.ts
│   │   └── repositorio-de-limites.ts
│   ├── configuracao/                    # ambiente.ts (env validado com Zod), recursos.ts (feature flags)
│   └── ferramentas-internas/            # formatação de moeda/data (pt-BR, America/Araguaina), validações Zod reutilizáveis
├── comandos/
│   └── registrar-webhook.ts             # npm run registrar-webhook -- https://…/api/webhooks/pluggy
├── banco-de-dados/seeds/                # sementes de DESENVOLVIMENTO (nunca em produção)
├── supabase/
│   ├── config.toml
│   └── migrations/                      # migrações versionadas (inclui as sementes padrão de garantir_empresa)
├── testes/
│   ├── unidade/                         # Vitest: estratégias, normalização, mapeamento Pluggy, webhookAutorizado
│   ├── integracao/                      # Vitest + Supabase local: repositórios, RLS com 2 empresas, rotas
│   └── ponta-a-ponta/                   # Playwright + axe
├── documentos/{especificacao,design,arquitetura,qualidade,evolucao}/
├── prototipo-flask/                     # referência; não roda em produção
├── public/
├── vercel.json                          # crons: /api/tarefas/ressincronizar, diário
└── .github/workflows/
```

## Por que cada ajuste

| Ajuste em relação ao PROMPT §7 | Motivo |
|---|---|
| `src/proxy.ts` | No Next 16 o `middleware` foi renomeado para `proxy` e roda em Node.js por padrão. Ele fica em `src/` porque o projeto usa `src/app` |
| Grupo `(sistema)` | Um único `layout.tsx` exige a sessão para todas as telas internas, sem mudar as URLs (`/painel`, `/extrato`…). Mesmo assim, cada Server Action revalida a sessão, porque a documentação do Next avisa que Server Actions não devem depender só do proxy |
| `acoes.ts` ao lado de cada `page.tsx` | As mutações da interface são Server Actions, próximas da tela que as usa. Route Handlers ficam só para quem chama de fora (Pluggy, Vercel Cron, link do e-mail) |
| `entrar/confirmar/route.ts` | O callback do link mágico precisa ser um GET com `code` na URL |
| `api/tarefas/ressincronizar` | Rede de segurança do webhook (ADR 0007) e limpeza das tabelas de infraestrutura |
| `adaptadores/` dentro do módulo | O adaptador pertence ao módulo que define o contrato. O ESLint restringe os imports do SDK a essas pastas |
| `regras-de-negocio/montagem.ts` | Um único ponto de montagem facilita trocar implementações em testes (Pluggy e Claude simulados) |
| `src/configuracao/` | Leitura e validação do ambiente e das flags em um só lugar (`server-only`). Não é "ferramenta" genérica |
| `comandos/` | Porte do `register_webhook.py`. Fica fora de `src/` porque não faz parte do bundle do app. Roda com `node --env-file=.env.local comandos/registrar-webhook.ts` (o Node ≥ 22.18 remove os tipos sozinho, então não precisa de dependência extra). Usa `pluggy-sdk` direto e **não importa `src/`**, porque `server-only` e o alias `@/` só existem dentro do Next |
| `regras-de-negocio/tipos.ts` e `erros.ts` | Tipos e erros do domínio usados por mais de um módulo. Tipos exclusivos de um módulo ficam nele |
