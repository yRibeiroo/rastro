# Revisões de código (QA)

Cada revisão registra escopo, achados por severidade e a decisão. Severidades: **bloqueante** (não entra na `main`), **alta**, **média**, **baixa**.

---

## 2026-10-11 — `funcionalidade/v1-em-andamento` → `main`

**Escopo:** `git diff c5a072b..HEAD -- src supabase comandos next.config.ts` (157 arquivos, ~19,4 mil linhas: backend, repositórios, migrações, seed, telas, identidade visual, webhook/cron), mais a configuração de testes. Checklist do `.github/pull_request_template.md`.

**Revisor:** engenheiro-de-qualidade.

### Segurança — sem achados bloqueantes

Conferido e aprovado:

- Segredos só no servidor: `src/configuracao/ambiente.ts` com `server-only`, validação preguiçosa e mensagem sem o valor; `NEXT_PUBLIC_*` só URL e chave publicável. O build de produção não contém a service role, `ANTHROPIC_API_KEY` nem `PLUGGY_CLIENT_SECRET` em `.next/static`. `npm run segredos`: nenhum vazamento.
- Sessão e allowlist em toda ação e leitura: `servicosDoUsuario()` chama `obterContextoDoUsuario()` (getClaims, nunca getSession) antes de qualquer serviço; o `proxy.ts` também confere a allowlist. Envio do link com resposta neutra, rate limit por IP e e-mail *fail-closed*, sem revelar a lista nem em falha do provedor. Callback com `destinoSeguro` (sem open redirect) e `signOut` para e-mail fora da lista.
- Zod em todas as entradas: os serviços validam ids (`z.uuid()`), filtros, correções e e-mail; as ações só montam o `FormData`.
- Service role sempre filtrada por `empresaId` (importação, conexões, contas, transações); `listarTodas`/`buscarPorIdExterno` só no webhook e no cron. RLS coberta por pgTAP.
- Uploads validados pelos bytes (`detectarTipo`: PDF, JPEG, PNG, WEBP) e o MIME declarado precisa bater; tamanho ≤ 4 MB; OFX ≤ 5 MB com extensão e leitor robusto. Caminho no Storage gerado pelo servidor (`empresa/transacao/uuid.ext`). Arquivo órfão removido quando a linha falha.
- Webhook e cron: Bearer comparado em tempo constante sobre SHA-256; webhook responde 404 com `RECURSO_OPEN_FINANCE=0` sem ler o corpo.
- CSP estática (ADR 0014) com `frame-ancestors 'none'`, `object-src 'none'`, `nosniff`, `X-Frame-Options`, HSTS, sem `x-powered-by`. Logs (`registrarFalha`) só com o tipo do erro.
- `?estado=` ignorado em produção (`lerEstadoForcado`, e a tela de entrada confere `NODE_ENV`).

### Achados

#### Alta — corrigidos nesta revisão

1. **Centros de custo sem movimento sumiam da tela** (HU-09: "já vejo os 4 centros cadastrados"). `src/app/(sistema)/centros-de-custo/page.tsx` listava só os centros com movimento no período, então centros novos ou parados não podiam ser vistos, renomeados nem arquivados. Correção: `src/componentes/centros-de-custo/resultado.ts` (`comTodosOsCentros`) inclui os ativos zerados. Testes: `testes/unidade/componentes/resultado-dos-centros.test.ts` e `e2e/categorias-e-centros.spec.ts` (falhava antes).
2. **`id` duplicado `nova-categoria`** entre o campo "Nova categoria" (`GerenciarCategorias`) e o seletor de categoria do formulário "Nova regra" (`GerenciarRegras`, prefixo `nova`). O rótulo "Categoria" da regra apontava para o campo de texto (nome acessível errado nos dois controles; leitor de tela e clique no rótulo quebrados). Correção: prefixo `regra-nova` em `GerenciarRegras.tsx:343`. Teste: `e2e/categorias-e-centros.spec.ts` (regra).
3. **Rolagem lateral a 390 px** em `/comprovantes` (615 px: emissor longo com `truncate` dentro de trilhas `auto`/`1fr`) e `/categorias` (393 px: nome longo de categoria). Correção: trilhas `minmax(0,1fr)`/`min-w-0` em `ListaDeComprovantes.tsx` e `GerenciarCategorias.tsx`/`GerenciarRegras.tsx`. Teste: `e2e/acessibilidade.spec.ts` (confere `scrollWidth` em todas as rotas, falhava antes).

#### Média — corrigidos nesta revisão

4. **Enter não pulava a abertura** (HU-02: "aperto Pular (ou Enter)"): só o clique no botão funcionava, sem foco nele. `AberturaAnimada.tsx` passa a ouvir Enter/Esc enquanto a abertura toca. Teste: `e2e/abertura-e-tema.spec.ts` (falhava antes).
5. **Rádios de candidatos compartilhavam o `name="candidato"`** entre todos os comprovantes ambíguos/alertados da tela: marcar um desmarcava o de outro cartão. `ListaDeComprovantes.tsx` usa `useId()` por grupo.
6. **Leitor de tela ouvia "mais R$ …" em valores sem sinal** (valor de comprovante, saldo, itens). `ValorMonetario` só diz "mais" quando o sinal aparece. Teste: `testes/unidade/componentes/valor-monetario.test.tsx` (falhava antes).
7. **Seed usava `current_date` (UTC)**: entre 21h e 0h em Araguaína as transações "de hoje" caíam no dia seguinte e sumiam do extrato do mês (o app usa America/Araguaina). `supabase/seed.sql` passa a usar `(now() at time zone 'America/Araguaina')::date`. Pego pelo E2E rodando depois das 21h.

#### Média — pendentes (não bloqueiam; viram tarefa)

8. **HU-11: clipe no extrato não aparece para anexo manual.** `src/app/(sistema)/extrato/page.tsx:42` (marcado `ponytail:`) só marca transações com comprovante conciliado. Repro: abrir uma transação, anexar um PDF, voltar ao extrato → sem o ícone. Falta uma leitura em lote de "transações com anexo" no backend. `e2e/anexos.spec.ts` tem `test.fixme` para isso.
9. **HU-09: não há seleção de várias transações para atribuir centro de custo** ("seleciono 3 transações no extrato quando escolho Elétrica"). Hoje o centro é atribuído uma a uma no detalhe da transação ou por regra. Precisa de ação em lote + interface.
10. **Comprovantes com `RECURSO_COMPROVANTES_IA=0`**: a tela continua oferecendo "Enviar comprovante" e o servidor recusa ("A leitura de comprovantes está desligada no momento."), sem guardar o arquivo. É coerente com o ADR 0016, mas a interface devia esconder/explicar o envio quando a flag está desligada (decisão de produto).

#### Baixa

11. `/vitrine` é pública em produção e o próprio arquivo diz "Protótipo temporário: o frontend reaproveita as peças e apaga esta rota". Sem dados; remover antes do lançamento.
12. Formulário de entrada não responde a clique antes da hidratação (Server Action ainda não ligada). Em conexão lenta o primeiro clique parece não fazer nada. Os E2E esperam a hidratação.
13. A página 404 não tem `h1`; o callback com `?erro=nao_autorizado` não mostra aviso (neutro, aceitável).
14. Comentário desatualizado em `rn/interface-web/acoes.ts` citando `src/componentes/prototipo/acoes-simuladas.ts` (inexistente): corrigido.
15. `npm run lint`: 6 avisos `no-unused-vars` em parâmetros `_x` dos testes (0 erros). Sugestão: `argsIgnorePattern: "^_"` no ESLint.

### Nomes e arquitetura

- Pastas e arquivos em português, sem `utils`/`helpers`/`lib` (os dois `helpers` são o caminho do SDK da Anthropic). ✔
- Interface só usa `@/regras-de-negocio/interface-web` (leituras e ações) e `import type` do índice; Pluggy, Claude e Supabase só atrás de adaptadores/repositórios; `montagem.ts` é a única raiz de composição. Route handlers (webhook, cron, callback) usam o domínio diretamente, como previsto. ✔

### Testes e infraestrutura de teste (nesta revisão)

- `comandos/ambiente-e2e.mjs` (novo) e `comandos/ambiente-supabase-local.mjs` (agora exporta `variaveisDoSupabaseLocal()`): Supabase local sem imprimir chaves; IA e Open Finance desligados.
- `playwright.config.ts`: build de produção, projeto `preparo` + `chromium`, 1 worker. `testar:e2e` sem `--pass-with-no-tests`. `testar:integracao` mantém `--passWithNoTests` (sem testes de integração na v1; ver plano).
- CI: `RECURSO_OPEN_FINANCE=0` e `RECURSO_COMPROVANTES_IA=0` no `env` para o build bater com o servidor dos E2E.
- Novos: 76 testes E2E (preparo + 9 arquivos `*.spec.ts` em `testes/ponta-a-ponta/`) e 3 testes de unidade.

### Resultados

| Suíte | Resultado |
|---|---|
| `npm run tipos` | ok |
| `npm run lint` | 0 erros, 6 avisos (item 15) |
| `npm run testar:cobertura` | 27 arquivos, 266 testes; `src/regras-de-negocio`: 98,3% instruções, 93,2% ramos, 95,5% funções, 98,9% linhas |
| `npx supabase test db` | 6 arquivos, 139 testes |
| `npm run testar:e2e` | 76 testes: 75 ok (com o preparo), 1 `fixme` (item 8), 2,8 min; verde com banco recém-resetado e em reexecução |
| axe | 8 rotas (7 logadas + `/entrar`) × 390/1280 px × claro/escuro = 32 páginas, zero violações *serious/critical* |
| Lighthouse (desktop) | `/`→`/entrar`: 0,99–1,0 / 1,0 / 1,0 (3 execuções); `/painel` 0,99–1,0 / 1,0 / 1,0; `/extrato` 0,9–0,99 / 1,0 / 1,0 |

### Decisão

**Aprovado para merge na `main`**, com os itens 8, 9 e 10 abertos como tarefas da v1 (critérios de aceite parcialmente atendidos, sem risco de segurança ou de dados) e o item 11 antes do lançamento.
