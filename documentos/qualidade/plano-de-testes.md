# Plano de testes — Rastro v1

Escopo: as histórias ativas HU-01, HU-02, HU-06 a HU-11, HU-13, HU-15 a HU-23 e a parte sempre ativa da HU-14. As HU-03, HU-04, HU-05 e HU-12 (e os dois primeiros critérios da HU-14) dependem de `RECURSO_OPEN_FINANCE`, que está desligado na v1: o código delas tem testes de unidade, mas não há E2E nem verificação manual nesta versão.

A matriz requisito → história → código → teste está em [`../rastreabilidade.md`](../rastreabilidade.md). O registro das revisões fica em [`revisoes.md`](revisoes.md).

## Níveis

| Nível | Ferramenta | Onde | O que cobre | Meta |
|---|---|---|---|---|
| Unidade (domínio) | Vitest (node) | `testes/unidade/regras-de-negocio/` | Serviços com repositórios falsos (`falsos.ts`): acesso e allowlist, rate limit, categorização (regras, provedor, IA simulada, mascaramento de CPF), correção que vira regra, centros, painel, anexos (tipo pelos bytes), importação e leitor OFX, comprovantes (leitura simulada, dedupe pela chave, conciliação, teto mensal), Open Finance desligado e sincronização | ≥ 80% de linhas, ramos, funções e instruções em `src/regras-de-negocio` (o `vitest.config.mts` reprova abaixo disso) |
| Unidade (interface) | Vitest (jsdom) + Testing Library | `testes/unidade/componentes/`, `testes/unidade/ferramentas-internas/` | Funções puras da interface (filtros na URL, escala dos gráficos, textos de situação, centros zerados) e componentes pequenos (`ValorMonetario`); moeda, datas e chave de acesso | sem meta numérica |
| Banco | pgTAP (`supabase test db`) | `supabase/tests/` | RLS e isolamento entre empresas, `garantir_empresa`, RPCs do painel, proteção da categoria do usuário (gatilho), rate limit atômico, importação, comprovantes, campos corrigidos | todos verdes |
| Integração | Vitest (projeto `integracao`) | `testes/integracao/` | Repositórios contra o Supabase local | **vazio na v1**: o caminho repositório → banco é exercitado pelos E2E (que passam pelos repositórios reais) e pelo pgTAP. Por isso `testar:integracao` mantém `--passWithNoTests` |
| Ponta a ponta | Playwright 1.64 (só Chromium) | `testes/ponta-a-ponta/` | Fluxos do usuário no build de produção (`next build && next start`) com o Supabase local e o seed demo | todos verdes; reexecutáveis sem `db reset` |
| Acessibilidade | `@axe-core/playwright` | `testes/ponta-a-ponta/acessibilidade.spec.ts` | Cada rota (logado e `/entrar`), 390 px e 1280 px, claro e escuro: zero violações *serious*/*critical* (WCAG 2.0/2.1/2.2 A e AA), sem rolagem lateral; teclado (pular para o conteúdo, entrar só com o teclado) | zero violações graves |
| Performance | Lighthouse CI (`npm run lighthouse`) | `lighthouserc.json` | `/` (→ `/entrar`) no preset desktop, 3 execuções | ≥ 0,9 em performance, acessibilidade e boas práticas |

## Ponta a ponta: como funciona

- `npm run testar:e2e` = `node comandos/ambiente-e2e.mjs playwright test`. O script lê `npx supabase status -o json` e injeta `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `MAILPIT_URL` **sem imprimir** os valores; define `EMAIL_AUTORIZADO=davi@exemplo.com` (ou o do CI), `URL_DO_SITE=http://localhost:3000` e força `RECURSO_OPEN_FINANCE=0`, `RECURSO_COMPROVANTES_IA=0` e `RECURSO_CATEGORIZACAO_IA=0`. Variáveis do processo têm prioridade sobre o `.env.local`, então nenhuma chave real é usada. Nenhum teste chama a Anthropic ou a Pluggy.
- O `webServer` do Playwright roda `npm run build && npm run start` (no CI só `start`, o build vem do passo anterior). Com um servidor já rodando na porta 3000 ele é reaproveitado.
- Projeto `preparo` (`preparo.setup.ts`): limpa `limites_de_requisicao`, pede o link mágico pela tela, busca o e-mail na API do Mailpit, abre o link, vincula o usuário à empresa demo com `privado.dev_vincular_usuario_a_demo` (psql no container `supabase_db_rastro`) e salva a sessão em `testes/ponta-a-ponta/.sessao/` (ignorada pelo git).
- Um worker, em série: o banco é compartilhado. Cada arquivo que muda dados devolve o seed ao estado inicial no `beforeAll`/`beforeEach` (SQL direto), então a suíte roda de novo sem `db reset`. `sair.spec.ts` fica por último (o `signOut` encerra a sessão salva).
- A abertura animada cobre a tela por 2,4 s: os testes marcam `sessionStorage['rastro:abertura-vista']`, menos os da própria abertura.
- `?estado=` não é usado: em produção ele é ignorado (`lerEstadoForcado`).

### Cenários por história

| HU | Arquivo | Cenários |
|---|---|---|
| HU-01 | `preparo.setup.ts`, `acesso.spec.ts`, `sair.spec.ts` | login autorizado pelo link do Mailpit; e-mail fora da lista recebe a mesma tela e nenhum e-mail; seis rotas protegidas redirecionam com `?proximo=`; link inválido → aviso; `proximo=//site` não vira open redirect; 4º pedido do mesmo e-mail → "Muitas tentativas"; sair encerra a sessão |
| HU-02 | `abertura-e-tema.spec.ts` | aparece na 1ª visita; "Pular" some na hora; Enter pula; termina sozinha em < 2,5 s; não volta ao recarregar/navegar; movimento reduzido = só fade, sem traçado |
| HU-06 | `extrato-e-painel.spec.ts`, `acessibilidade.spec.ts` | mês atual em ordem decrescente; busca "pôsto" casa "POSTO" e fica na URL; Saídas + Combustível + Mês passado → as 2 transações certas, filtros na URL e após recarregar; vazio com "Limpar filtros"; 390 px sem rolagem lateral |
| HU-08 / HU-10 | `extrato-e-painel.spec.ts` | corrigir a categoria → mensagem + oferta de regra → "Criar regra" → regra listada → painel "Para onde foi" mostra a nova categoria com o valor; "Classificar" leva ao extrato filtrado sem centro |
| HU-09 | `categorias-e-centros.spec.ts` | os 4 centros do seed aparecem (inclusive sem movimento); criar e arquivar; arquivado some das opções da transação |
| HU-11 | `anexos.spec.ts` | anexar PDF, abrir por URL assinada do Storage, remover; arquivo com bytes de executável recusado. **Pendente** (`test.fixme`): clipe no extrato para anexo manual |
| HU-13 | `categorias-e-centros.spec.ts` | criar categoria → aparece no filtro do extrato; nome repetido → "Já existe uma categoria com esse nome."; arquivar → some das opções; criar regra, subir na lista, excluir |
| HU-15 / HU-16 | `importacao.spec.ts` | importar `sicredi-sgml-latin1.ofx` (4 novas, FITID repetido descartado) e ver no extrato; reimportar → 0 novas, 4 atualizadas, sem duplicar; histórico e "Última importação hoje"; OFX corrompido recusado sem gravar; não-OFX recusado no navegador |
| HU-17 | `comprovantes.spec.ts` | com `RECURSO_COMPROVANTES_IA=0` o envio responde "A leitura de comprovantes está desligada no momento." e nada é gravado (caminho real da v1 nos E2E; a leitura com IA é coberta na unidade com o leitor simulado) |
| HU-20 / HU-22 | `comprovantes.spec.ts` | lista os 6 do seed com a situação escrita; filtros na URL (3 conciliados, 1 ambíguo); escolher a transação do ambíguo → conciliado → "Abrir transação"; "Desligar da transação" volta a pendente |
| HU-23 / HU-14 | `acesso.spec.ts` | `/api/webhooks/pluggy` → 404 com a flag desligada; menu sem "Conexões bancárias"; CSP, `nosniff`, `X-Frame-Options`, sem `x-powered-by` |
| RNF-08/09/11/14 | `acessibilidade.spec.ts`, `abertura-e-tema.spec.ts` | axe em 8 rotas × 2 larguras × 2 temas; teclado; troca de tema persiste |

## Como rodar

```bash
# 1. Docker Desktop aberto. Supabase local enxuto (Mailpit e Storage são necessários):
npx supabase start -x studio,edge-runtime,imgproxy,vector,logflare,realtime,supavisor,postgres-meta
npx supabase db reset            # opcional: banco limpo com o seed

# 2. Suítes
npm run tipos && npm run lint
npm run testar:cobertura         # unidade + componentes, cobertura de src/regras-de-negocio
npx supabase test db             # pgTAP
npm run testar:e2e               # build de produção + Playwright (preparo + chromium)
npx playwright install chromium  # se faltar o navegador

# 3. Lighthouse (com as variáveis locais)
node comandos/ambiente-e2e.mjs npx lhci autorun

# 4. Devolver a memória
npx supabase stop
```

Rotas logadas no Lighthouse: o `lhci` não faz login. Para medir, rode o projeto `preparo` e passe o cookie da sessão salva em `settings.extraHeaders` (feito na revisão de 11/10/2026; ver `revisoes.md`).

## Fora do automatizado (verificação manual ou pendente)

- Câmera, leitura de QR pelo `BarcodeDetector` e remoção de EXIF/GPS no navegador (HU-17): dependem de aparelho; a extração da chave do QR tem teste de unidade.
- Expiração real do link temporário após 60 s (HU-11/HU-22): a validade é parâmetro do serviço (teste de unidade); o E2E confere que o arquivo é servido por URL assinada.
- Pre-commit bloqueando `.env` (HU-14): `.githooks` + `npm run segredos` (gitleaks).
