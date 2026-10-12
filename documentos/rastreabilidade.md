# Rastreabilidade — requisito → história → código → testes

Atualizada na revisão de QA de 11/10/2026 (branch `funcionalidade/v1-em-andamento`). Situação:

- **verificado**: o critério de aceite tem teste automatizado verde (unidade, banco e/ou E2E).
- **condicionado**: depende de `RECURSO_OPEN_FINANCE` (desligado na v1, ADR 0016). Tem teste de unidade do código; sem E2E nesta versão.
- **parcial**: verificado, com um critério pendente descrito em `qualidade/revisoes.md`.

Abreviações de caminho: `rn/` = `src/regras-de-negocio/`, `ad/` = `src/acesso-a-dados/`, `ui/` = `src/componentes/`, `tu/` = `testes/unidade/`, `e2e/` = `testes/ponta-a-ponta/`, `db/` = `supabase/tests/`.

## Requisitos funcionais

| RF | HU | Código principal | Unidade | Banco | E2E | Situação |
|---|---|---|---|---|---|---|
| RF-01 Link mágico | HU-01 | `rn/acesso/servico.ts`, `ad/autenticacao-supabase.ts`, `src/app/(entrada)/entrar/` | `tu/regras-de-negocio/acesso/acesso.test.ts` | `02_garantir_empresa` | `preparo.setup.ts`, `acesso.spec.ts` (link inválido, open redirect) | verificado |
| RF-02 Allowlist | HU-01 | `rn/acesso/servico.ts`, `src/proxy.ts` | `acesso.test.ts` | — | `acesso.spec.ts` (e-mail fora da lista: mesma tela, nenhum e-mail, sem sessão) | verificado |
| RF-03 Rotas protegidas e sair | HU-01, HU-23 | `src/proxy.ts`, `rn/interface-web/leituras.ts`, `acoes.ts#sair` | `interface-web.test.ts` | `01_rls_isolamento_entre_empresas` | `acesso.spec.ts` (6 rotas), `sair.spec.ts` | verificado |
| RF-04 Abertura | HU-02 | `src/identidade-visual/AberturaAnimada.tsx`, `abertura.css`, `tema.ts` | — | — | `abertura-e-tema.spec.ts` (aparece, Pular, Enter, ≤ 2,5 s, uma vez por sessão, movimento reduzido) | verificado |
| RF-05 a RF-13 Pluggy (conectar, validar, status, reconectar, webhook, dedupe, after, eventos) | HU-03, HU-04, HU-05, HU-14 | `rn/conexao-bancaria/**`, `rn/extrato/servico-de-sincronizacao.ts`, `src/app/api/webhooks/pluggy/` | `conexao-bancaria/*.test.ts`, `extrato/sincronizacao.test.ts`, `open-finance-desligado.test.ts` | `04_categoria_do_usuario_e_limites` | `acesso.spec.ts` (webhook → 404 com a flag desligada) | condicionado |
| RF-14 Mapeamento → Transação | HU-05, HU-15 | `provedor-bancario-pluggy.ts`, `rn/importacao-de-extrato/leitor-ofx.ts` | `provedor-pluggy.test.ts`, `importacao.test.ts` | `05_importacao_e_comprovantes` | `importacao.spec.ts` | verificado (OFX); Pluggy condicionado |
| RF-15 Categoria do usuário nunca sobrescrita | HU-05, HU-08, HU-15, HU-19 | `rn/categorizacao/servico.ts`, gatilho `transacoes_proteger_categoria_do_usuario` | `categorizacao/servico.test.ts`, `importacao.test.ts` | `04_categoria_do_usuario_e_limites` | `importacao.spec.ts` (reimportar), `extrato-e-painel.spec.ts` | verificado |
| RF-16 Listar extrato | HU-06 | `rn/extrato/servico-de-extrato.ts`, `ui/extrato/ListaDoExtrato.tsx` | `extrato/extrato.test.ts` | `01_rls…` | `extrato-e-painel.spec.ts` (mês atual, ordem) | verificado |
| RF-17 Busca | HU-06 | `servico-de-extrato.ts`, `ad/repositorio-de-transacoes.ts`, `ui/extrato/FiltrosDoExtrato.tsx` | `extrato.test.ts`, `tu/componentes/filtros-da-url.test.ts` | — | `extrato-e-painel.spec.ts` ("pôsto" → POSTO) | verificado |
| RF-18 Filtros | HU-06 | `ui/extrato/filtros-da-url.ts`, `FiltrosDoExtrato.tsx` | `filtros-da-url.test.ts` | — | `extrato-e-painel.spec.ts` (Saídas + Combustível + Mês passado, vazio + Limpar) | verificado |
| RF-19 Regras | HU-07, HU-08, HU-13 | `rn/categorizacao/estrategias/por-regras.ts` | `estrategias.test.ts`, `categorizacao/servico.test.ts` | — | `categorias-e-centros.spec.ts` (criar/subir/excluir regra) | verificado |
| RF-20 IA (Claude) | HU-07, HU-15 | `rn/categorizacao/adaptadores/claude/`, `estrategias/por-ia.ts` | `classificador-claude.test.ts` (SDK simulado), `estrategias.test.ts` | — | — (E2E sem IA real, flag 0) | verificado (unidade) |
| RF-21 Correção vira regra | HU-08, HU-09 | `categorizacao/servico.ts`, `ui/extrato/OfertaDeRegra.tsx` | `categorizacao/servico.test.ts` | `04_…` | `extrato-e-painel.spec.ts` (recategorizar + Criar regra) | verificado |
| RF-22 Gerenciar categorias e regras | HU-13 | `categorizacao/servico.ts`, `ad/repositorio-de-categorias.ts`, `ui/categorias/*` | `categorizacao/servico.test.ts` | `01_rls…` | `categorias-e-centros.spec.ts` (criar, duplicado, arquivar, regras) | verificado |
| RF-23 Centros de custo | HU-09 | `rn/centros-de-custo/servico.ts`, `ui/centros-de-custo/*`, `ui/centros-de-custo/resultado.ts` | `outros-servicos.test.ts`, `tu/componentes/resultado-dos-centros.test.ts` | `01_rls…` | `categorias-e-centros.spec.ts` (4 centros, criar, arquivar) | parcial (atribuição em lote a 3 transações não existe na interface; ver revisoes.md) |
| RF-24 Entradas x saídas | HU-10 | `rn/painel/servico.ts`, RPCs do painel, `ui/graficos/GraficoEntradasSaidas.tsx` | `outros-servicos.test.ts`, `tu/componentes/escala.test.ts` | `03_painel` | `acessibilidade.spec.ts` (/painel) | verificado |
| RF-25 Gastos por categoria | HU-10 | `painel/servico.ts`, `ui/graficos/ParaOndeFoi.tsx` | `outros-servicos.test.ts` | `03_painel` | `extrato-e-painel.spec.ts` (painel reflete a recategorização) | verificado |
| RF-26 Resultado por centro | HU-10 | `painel/servico.ts`, `ui/graficos/ResultadoPorCentro.tsx` | `outros-servicos.test.ts` | `03_painel` | `extrato-e-painel.spec.ts` ("Classificar") | verificado |
| RF-27 Saldo atual | HU-10, HU-15 | `painel/servico.ts`, `ad/repositorio-de-contas.ts` | `outros-servicos.test.ts`, `importacao.test.ts` (saldo não regride) | `03_painel` | `acessibilidade.spec.ts` (/painel renderiza "Saldo atual") | verificado |
| RF-28 Anexos | HU-11 | `rn/anexos/servico.ts`, `ad/repositorio-de-anexos.ts`, `ui/extrato/Anexos.tsx` | `outros-servicos.test.ts`, `interface-web.test.ts` | `01_rls…` (storage) | `anexos.spec.ts` (anexar, URL assinada, remover, bytes inválidos) | parcial (clipe no extrato só para comprovantes; `test.fixme`) |
| RF-29 Registrar webhook | HU-14 | `comandos/registrar-webhook.ts` | — | — | — | condicionado |
| RF-30 Sincronizar agora | HU-12 | `servico-de-sincronizacao.ts`, `ui/extrato/BotaoSincronizar.tsx` | `sincronizacao.test.ts` | `04_…` (limites) | — | condicionado |
| RF-31 Importar OFX | HU-15 | `rn/importacao-de-extrato/*`, `ui/importacao/ImportarExtrato.tsx` | `importacao.test.ts` (SGML latin1, vírgula, XML, corrompido) | `05_importacao_e_comprovantes` | `importacao.spec.ts` | verificado |
| RF-32 Reimportação idempotente | HU-15, HU-19 | `importacao-de-extrato/servico.ts` | `importacao.test.ts` | `05_…` | `importacao.spec.ts` (0 novas, 4 atualizadas, sem duplicar) | verificado |
| RF-33 Histórico | HU-16 | `ad/repositorio-de-importacoes.ts`, `src/app/(sistema)/importar/page.tsx` | `importacao.test.ts` | `05_…` | `importacao.spec.ts` | verificado |
| RF-34 Extrato desatualizado | HU-16 | `situacaoDoExtrato`, `ui/estrutura/StatusDaConexao.tsx`, `ui/importacao/extrato.ts` | `importacao.test.ts`, `tu/componentes/extrato-e-alertas.test.ts` | — | `importacao.spec.ts` ("Última importação hoje") | verificado |
| RF-35 Enviar comprovante | HU-17 | `rn/comprovantes/servico.ts#enviar`, `ui/comprovantes/EnviarComprovante.tsx` | `comprovantes/servico.test.ts` | `05_…` | `comprovantes.spec.ts` (flag desligada: recusa sem gravar) | verificado (unidade); câmera manual |
| RF-36 Leitura por IA | HU-17 | `leitor-de-comprovantes-claude.ts` | `leitor-claude.test.ts` | — | — | verificado (unidade) |
| RF-37 QR da NFC-e | HU-17 | `src/ferramentas-internas/chave-de-acesso.ts` | `chave-de-acesso.test.ts` | — | — | verificado (unidade); `BarcodeDetector` manual |
| RF-38 Dedupe pela chave | HU-18, HU-21 | `comprovantes/servico.ts#exigirChaveLivre` | `comprovantes/servico.test.ts` | `05_…` (unique) | — | verificado |
| RF-39 Conciliação automática | HU-19, HU-20 | `rn/comprovantes/conciliacao.ts` | `conciliacao.test.ts`, `servico.test.ts` | `05_…` | `comprovantes.spec.ts` (seed) | verificado |
| RF-40 Conciliação manual | HU-20 | `comprovantes/servico.ts#conciliarManualmente`, `desfazerConciliacao` | `servico.test.ts` | `05_…` | `comprovantes.spec.ts` (escolher, abrir, desligar) | verificado |
| RF-41 Corrigir dados lidos | HU-21 | `comprovantes/servico.ts#corrigirDados`, `lerDeNovo` | `servico.test.ts` | `06_campos_corrigidos_e_leituras` | — | verificado |
| RF-42 Alerta sem transação | HU-22 | `alertaDoComprovante`, `src/app/(sistema)/layout.tsx#SeloDeAlertas` | `servico.test.ts`, `extrato-e-alertas.test.ts` | `06_…` | `comprovantes.spec.ts` (filtro "Sem transação" existe) | verificado |
| RF-43 Categoria pelos itens | HU-19 | `categorizacao/servico.ts#categorizarComDica` | `categorizacao/servico.test.ts` | — | — | verificado (unidade) |
| RF-44 Tela de comprovantes | HU-22 | `src/app/(sistema)/comprovantes/page.tsx`, `ui/comprovantes/*` | `tu/componentes/comprovante.test.ts` | — | `comprovantes.spec.ts` (lista, situação escrita, filtros) | verificado |
| RF-45 Open Finance por flag | HU-23 | `rn/montagem.ts`, `provedorDesligado`, rotas | `open-finance-desligado.test.ts`, `montagem.test.ts` | — | `acesso.spec.ts` (webhook 404), `extrato-e-painel.spec.ts` (menu, `/conexoes-bancarias` 404) | verificado |

## Requisitos não funcionais

| RNF | Verificação | Situação |
|---|---|---|
| RNF-01 RLS em todas as tabelas | `db/01_rls_isolamento_entre_empresas.sql` + demais pgTAP | verificado |
| RNF-02 Segredos só no servidor | `server-only` em `ambiente.ts`/repositórios; build sem service role, `ANTHROPIC_*`, `PLUGGY_CLIENT_SECRET` em `.next/static` (checado nesta revisão) | verificado |
| RNF-03 Cabeçalhos e CSP | `e2e/acesso.spec.ts` (cabeçalhos) | verificado |
| RNF-04 Rate limit | `tu/…/acesso.test.ts`, `db/04_…`, `e2e/acesso.spec.ts` ("Muitas tentativas") | verificado |
| RNF-05 Zod | revisão estática (todas as ações passam por serviço com Zod) + testes de entrada inválida na unidade | verificado |
| RNF-06 Logs sem dados sensíveis | `registrarFalha` só registra o tipo do erro (revisão estática) | verificado |
| RNF-07 Anexos privados | `e2e/anexos.spec.ts` (URL assinada `object/sign`), unidade (60 s) | verificado |
| RNF-08 Acessibilidade (axe) | `e2e/acessibilidade.spec.ts`: 32 combinações, zero *serious/critical* | verificado |
| RNF-09 Teclado | `e2e/acessibilidade.spec.ts`, `abertura-e-tema.spec.ts` (Enter pula) | verificado |
| RNF-10 Lighthouse | `/`→`/entrar` 0,99–1,0 / 1,0 / 1,0; `/painel` e `/extrato` logados 0,9–1,0 / 1,0 / 1,0 | verificado |
| RNF-11 Responsividade | `e2e/acessibilidade.spec.ts` (390 px sem rolagem lateral) | verificado |
| RNF-12 Localização | `tu/ferramentas-internas/formatar-*.test.ts`; E2E com `pt-BR` e `America/Araguaina` | verificado |
| RNF-13 Pronto para multiempresa | `db/01_rls…`, `02_garantir_empresa` | verificado |
| RNF-14 Claro e escuro | `e2e/abertura-e-tema.spec.ts`, axe nos dois temas | verificado |
| RNF-15 thinking-orbs nos carregamentos | revisão estática (`Carregando` nos `Suspense`) | verificado (estático) |
| RNF-16 Cobertura | `npm run testar:cobertura`: 98,3% instruções, 93,2% ramos, 95,5% funções, 98,9% linhas | verificado |
| RNF-17 Estados de interface | E2E de vazio (extrato, comprovantes) e erro (importação); carregando é estático | verificado |
| RNF-18 Desacoplamento de provedores | `montagem.test.ts`, `open-finance-desligado.test.ts`; revisão: interface só via `interface-web` | verificado |
| RNF-19 Resiliência da sincronização | `sincronizacao.test.ts` | condicionado |
| RNF-20 Minimização para a IA | `estrategias.test.ts` / `classificador-claude.test.ts` (CPF mascarado) | verificado |
| RNF-21 Nenhum segredo versionado | `npm run segredos` (gitleaks): nenhum vazamento | verificado |
| RNF-22 Idempotência | `importacao.test.ts`, `e2e/importacao.spec.ts`; webhook (condicionado) | verificado |
| RNF-23 Teto de custo da IA | `categorizacao/servico.test.ts` | verificado (unidade) |
| RNF-24 Minimização dos comprovantes | `leitor-claude.test.ts` | verificado (unidade); EXIF no navegador manual |
| RNF-25 Limites e validação de arquivos | `outros-servicos.test.ts`, `importacao.test.ts`, `e2e/anexos.spec.ts`, `e2e/importacao.spec.ts` | verificado |
| RNF-26 Teto da leitura de comprovantes | `comprovantes/servico.test.ts`, `db/06_…` | verificado |
| RNF-27 Tempo e resiliência da leitura | `leitor-claude.test.ts`, `servico.test.ts` | verificado (unidade) |
| RNF-28 Robustez do leitor OFX | `importacao.test.ts` (4 fixtures), `e2e/importacao.spec.ts` (corrompido) | verificado |

Nenhum requisito ativo está sem teste. Pendências de critério de aceite (não de requisito): clipe no extrato para anexo manual (HU-11) e seleção de várias transações para atribuir centro (HU-09) — ver `qualidade/revisoes.md`.
