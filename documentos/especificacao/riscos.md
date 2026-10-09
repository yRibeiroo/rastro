# Análise de riscos — Rastro v1

## Escalas

| Nota | Probabilidade | Impacto |
|---|---|---|
| 1 | Rara (< 10% no primeiro ano) | Desprezível: incômodo, sem perda de dados |
| 2 | Pouco provável | Baixo: atraso ou retrabalho pequeno |
| 3 | Possível | Moderado: funcionalidade parada por dias, informação errada no painel |
| 4 | Provável | Alto: perda de dados, custo inesperado relevante, exposição a terceiros |
| 5 | Quase certa | Crítico: vazamento de dados financeiros, fraude, inviabilidade do projeto |

**Severidade = P × I.** 1 a 5 = baixa · 6 a 11 = média · 12 a 25 = **alta**.

## Matriz (probabilidade x impacto)

| P \ I | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | | | | | |
| **4** | | | R-06 | R-02 | |
| **3** | | R-11 | R-01, R-05b, R-12 | R-03, R-08, R-09 | |
| **2** | | R-13 | R-05, R-07, R-10 | | R-04 |
| **1** | | | | | R-14 |

(R-05b = erro de categorização pela IA, separado do custo da IA, R-05.)

## Registro de riscos

| Id | Risco | P | I | Sev. | Mitigação | Gatilho / responsável |
|---|---|---|---|---|---|---|
| R-01 | **Consentimento Open Finance expira ou é revogado** (alguns conectores PJ impõem 1 ano). Os endpoints passam a devolver dados vazios e o extrato para sem aviso. | 3 | 3 | 9 | Gravar `consentExpiresAt` e o status do item. Aviso "Precisa reconectar" no cabeçalho a partir de 7 dias antes (RF-07). Reconexão com 1 clique pelo mesmo item, sem duplicar (RF-08). Mostrar "última sincronização" para deixar um atraso visível. | Status `LOGIN_ERROR`/`OUTDATED` ou expiração próxima. Davi reconecta. |
| R-02 | **Custo da Pluggy em produção (mínimo de R$ 2.500/mês)** desproporcional para uma empresa usando internamente. Não há plano público para 1 conta. | 4 | 4 | **16** | v1 entregue e validada no **sandbox** (custo zero). Decisão D-03 explícita para o Davi: negociar plano de entrada, confirmar por escrito o uso do Meu Pluggy, usar OFX (Plano B, v1.1) ou tratar como investimento no SaaS. O adaptador `ProvedorBancario` deixa a troca de fonte barata. | Antes de conectar a conta real. Davi. |
| R-03 | **Pluggy indisponível**, ou webhook perdido depois de responder 200 (a Pluggy não reenvia 2XX). | 3 | 4 | **12** | Estado do evento (`recebido/processado/falhou`) (RF-11). Novas tentativas com espera crescente nas chamadas (RNF-19). "Sincronizar agora" com janela de 90 dias (RF-30). Upsert idempotente (RNF-22). Mensagem de erro amigável no Connect. Contingência: OFX. | Eventos `falhou` ou "última sincronização" > 48 h. Equipe e Davi. |
| R-04 | **Vazamento do Client Secret da Pluggy ou de outro segredo.** *Já aconteceu: o Client Secret apareceu num print.* Permite ler o extrato da empresa pela API. | 2 | 5 | 10 | **Gerar novo Client Secret antes de qualquer uso real** (`PARA-O-DAVI.md`). Segredos só no servidor (RNF-02). gitleaks no pre-commit e no CI (RNF-21). `.env.example` sem valores. Logs mascarados (RNF-06). Webhook com segredo próprio, trocável e registrado de novo pelo script (RF-29). Orientação: nunca tirar print do painel da Pluggy ou da Vercel com valores à mostra. | Qualquer suspeita de exposição. Trocar o segredo na hora. Davi. |
| R-05 | **Custo da IA fora de controle** (laço de reclassificação, backfill grande, troca para um modelo mais caro). | 2 | 3 | 6 | Estimativa normal de ~US$ 3/mês (viabilidade §3.4). Teto mensal `IA_LIMITE_MENSAL` (RNF-23). Regras primeiro (RF-19). Nunca reclassificar a origem `usuario` (RF-15). Backfill pela Batch API (50% de desconto) se passar de 500 transações. Limite de gasto configurado no Console da Anthropic. | Consumo > 80% do teto. Equipe. |
| R-05b | **IA categoriza errado**, distorcendo o painel e as decisões. | 3 | 3 | 9 | Saída estruturada restrita às categorias existentes. Confiança mínima de 0,6, senão "Sem categoria" (RF-20). Selo "sugerida pela IA" visível. Filtro "Sem categoria" e revisão. Correção que vira regra (RF-21). Regras iniciais para os padrões mais comuns (posto, tarifa, impostos). | Muitas correções numa mesma categoria. Davi revisa e a equipe ajusta o prompt. |
| R-06 | **Limites do plano gratuito**: o Supabase Free pausa o projeto após 1 semana sem atividade e não tem backup. O e-mail padrão do Supabase entrega só para membros do time, com 2 por hora. A Vercel Hobby tem cota de CPU. | 4 | 3 | **12** | Supabase Pro (US$ 25) em produção com dados reais (D-02). SMTP próprio para o link mágico (P-08). Monitorar o uso. O volume do Rastro fica muito abaixo das cotas de execução. | Primeiro dado real. Davi assina. |
| R-07 | **Mudança na API ou no SDK da Pluggy** (o conector Sicredi PJ antigo já foi descontinuado uma vez). | 2 | 3 | 6 | Usar o conector de **Open Finance**. Isolar no adaptador `ProvedorBancario`. Fixtures realistas nos testes de contrato. Fixar a versão do `pluggy-sdk`. | Falha nos testes de contrato ou aviso da Pluggy. Equipe. |
| R-08 | **Uso comercial na Vercel Hobby** viola os termos (Fair Use Guidelines) e pode levar à suspensão do projeto. | 3 | 4 | **12** | D-01: produção com dados reais só no **Vercel Pro (US$ 20/mês)**. Hobby só para prévias de desenvolvimento. Item no `PARA-O-DAVI.md`. | Antes do go-live real. Davi. |
| R-09 | **Vazamento de dados financeiros** por falha de RLS ou de autorização (exposição a terceiros, LGPD). | 3 | 4 | **12** | RLS em todas as tabelas, com teste de RLS de 2 Empresas no CI (RNF-01). `service_role` só no servidor, usada só no webhook. Allowlist de e-mail (RF-02). Bucket privado com URLs assinadas de 60 s (RNF-07). CSP e cabeçalhos (RNF-03). Revisão de segurança do QA a cada merge. | Falha no teste de RLS ou achado em revisão. Equipe. |
| R-10 | **Webhook forjado** (injeção de transações falsas ou DoS) por ser um endpoint público. | 2 | 3 | 6 | Bearer secreto com comparação em tempo constante (RF-09). Rate limit (RNF-04). Zod (RNF-05). Nunca confiar no payload: sempre consultar a Pluggy, e só para itens conhecidos (RF-12, RF-13). | 401 em volume nos logs. Equipe. |
| R-11 | **Animação ou orbes prejudicam o desempenho e a acessibilidade** (Lighthouse < 90). | 3 | 2 | 6 | A animação não bloqueia o carregamento (RF-04). `prefers-reduced-motion`. Lighthouse CI e axe obrigatórios (RNF-08, RNF-10). | CI vermelho. Designer e frontend. |
| R-12 | **Erro de fuso ou de sinal** no painel (transação no mês errado, entrada contada como saída). | 3 | 3 | 9 | Toda agregação no fuso America/Araguaina (RNF-12). Regra de sinal testada (RF-14). Testes com transações perto da meia-noite e na virada do mês. | Divergência com o extrato do banco. QA. |
| R-13 | **Link mágico não chega** (spam ou limite de envio) e o Davi fica sem acesso. | 2 | 2 | 4 | SMTP próprio com domínio verificado (SPF/DKIM). Mensagem orientando a olhar a caixa de spam. Acesso de emergência pelo painel do Supabase. | Reclamação do Davi. Equipe. |
| R-14 | **Perda de dados** (exclusão acidental, corrupção) sem backup. | 1 | 5 | 5 | Supabase Pro com backup de 7 dias (D-02). Migrações versionadas. `transactions/deleted` apaga só por id e Empresa. Os dados podem ser buscados de novo na Pluggy (fonte primária). | Incidente. Equipe. |

## Riscos de severidade alta (≥ 12): plano de ação

1. **R-02 (custo da Pluggy):** decisão do Davi antes da conta real. A v1 não depende dela para ser entregue.
2. **R-03 (Pluggy indisponível / webhook perdido):** RF-11, RF-30 e RNF-19 obrigatórios na v1.
3. **R-06 e R-08 (planos gratuitos e Hobby comercial):** US$ 45/mês de infraestrutura recomendados no go-live real.
4. **R-09 (vazamento por RLS):** teste de RLS com duas Empresas bloqueando o merge.
