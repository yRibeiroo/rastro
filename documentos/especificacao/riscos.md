# Análise de riscos — Rastro v1

> Revisada em 10/10/2026 pela ADR 0016 (extrato OFX + comprovantes lidos por IA; Pluggy desligada por `RECURSO_OPEN_FINANCE`). Riscos ligados só à Pluggy foram rebaixados para probabilidade 1 enquanto a flag estiver desligada. Se a flag for ligada, voltam aos valores da coluna "Antes".

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
| **4** | | R-18 | R-06, R-15 | | |
| **3** | | R-11 | R-05b, R-12, R-16, R-17 | R-08, R-09 | |
| **2** | | R-13 | R-05, R-21 | R-20 | R-04 |
| **1** | | | R-01, R-07, R-10 | R-03 | R-14 |

(R-05b = erro de categorização pela IA, separado do custo da IA, R-05. R-02 está encerrado e fora da matriz. Não há R-19: o id foi pulado para evitar confusão com versões de rascunho.)

## Registro de riscos

| Id | Risco | P | I | Sev. | Antes | Mitigação | Gatilho / responsável |
|---|---|---|---|---|---|---|---|
| R-01 | **Consentimento Open Finance expira ou é revogado.** *Condicionado a `RECURSO_OPEN_FINANCE`.* | 1 | 3 | 3 | 3×3 | Com a flag desligada não há consentimento. Se ligada: `consentExpiresAt`, aviso "Precisa reconectar" (RF-07), reconexão sem duplicar (RF-08). | Só se a flag for ligada. |
| R-02 | **Custo da Pluggy em produção (mínimo de R$ 2.500/mês).** **Encerrado** pela ADR 0016: a v1 não usa a Pluggy (D-03 resolvida). | — | — | — | 4×4 | Pluggy desligada por flag (RF-45). Volta a ser avaliado só se o Rastro virar SaaS. | Decisão de ligar a flag. Davi. |
| R-03 | **Pluggy indisponível ou webhook perdido.** *Condicionado a `RECURSO_OPEN_FINANCE`.* | 1 | 4 | 4 | 3×4 | Com a flag desligada, o webhook responde 404 e o cron não chama a Pluggy. Se ligada: RF-11, RF-30, RNF-19. | Só se a flag for ligada. |
| R-04 | **Vazamento de segredo** (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; o Client Secret da Pluggy já vazou num print). | 2 | 5 | 10 | 2×5 | Segredos só no servidor (RNF-02). gitleaks no pre-commit e no CI (RNF-21). Logs mascarados (RNF-06). **Revogar o Client Secret da Pluggy vazado** mesmo com a flag desligada. Limite de gasto no Console da Anthropic. Nunca tirar print de painéis com valores à mostra. | Qualquer suspeita de exposição. Trocar o segredo na hora. Davi. |
| R-05 | **Custo da IA fora de controle** (laço de reclassificação, reenvio em massa de comprovantes, troca para modelo mais caro). | 2 | 3 | 6 | 2×3 | Estimativa normal ≈ US$ 7/mês (viabilidade §3.4). Tetos separados: `IA_LIMITE_MENSAL` (RNF-23) e `IA_LIMITE_COMPROVANTES_MES` (RNF-26). Imagem reduzida no navegador (P-34). Rate limit de envio (RNF-04). Limite de gasto no Console da Anthropic. | Consumo > 80% de um teto. Equipe. |
| R-05b | **IA categoriza errado**, distorcendo o painel. | 3 | 3 | 9 | 3×3 | Saída restrita às categorias existentes, confiança mínima 0,6 (RF-20). Selo "sugerida pela IA". Correção vira regra (RF-21). Itens do comprovante como contexto extra (RF-43). | Muitas correções numa mesma categoria. Davi e equipe. |
| R-06 | **Limites do plano gratuito** (Supabase Free pausa e não tem backup; e-mail padrão limitado; Hobby com cota). | 4 | 3 | **12** | 4×3 | Supabase Pro e Vercel Pro em produção (D-01, D-02). SMTP próprio (P-08). | Primeiro dado real. Davi assina. |
| R-07 | **Mudança na API ou no SDK da Pluggy.** *Condicionado a `RECURSO_OPEN_FINANCE`.* | 1 | 3 | 3 | 2×3 | Adaptador `ProvedorBancario`, testes de contrato com fixtures, versão fixa do SDK. | Só se a flag for ligada. |
| R-08 | **Uso comercial na Vercel Hobby** viola os termos. | 3 | 4 | **12** | 3×4 | D-01: produção com dados reais só no Vercel Pro. | Antes do go-live. Davi. |
| R-09 | **Vazamento de dados financeiros** por falha de RLS ou de autorização (agora inclui imagens de comprovantes, com CPF/CNPJ e endereço). | 3 | 4 | **12** | 3×4 | RLS em todas as tabelas, incluindo `comprovantes` e `importacoes_de_extrato`, com teste de 2 Empresas no CI (RNF-01). Bucket privado, URL assinada de 60 s (RNF-07). A conciliação manual valida a Empresa da transação (RF-40). | Falha no teste de RLS. Equipe. |
| R-10 | **Webhook forjado.** *Condicionado a `RECURSO_OPEN_FINANCE`.* | 1 | 3 | 3 | 2×3 | Com a flag desligada, o endpoint responde 404 (RF-45). Se ligada: RF-09, RNF-04, RNF-05. | Só se a flag for ligada. |
| R-11 | **Animação ou orbes prejudicam desempenho e acessibilidade.** | 3 | 2 | 6 | 3×2 | `prefers-reduced-motion`, Lighthouse CI e axe (RNF-08, RNF-10). | CI vermelho. Designer e frontend. |
| R-12 | **Erro de fuso ou de sinal** no painel. | 3 | 3 | 9 | 3×3 | Agregação em America/Araguaina (RNF-12). Datas do OFX com e sem fuso testadas (RNF-28). Sinal do `TRNAMT` testado (RF-31). | Divergência com o extrato do banco. QA. |
| R-13 | **Link mágico não chega.** | 2 | 2 | 4 | 2×2 | SMTP próprio com SPF/DKIM. Acesso de emergência pelo painel do Supabase. | Reclamação do Davi. Equipe. |
| R-14 | **Perda de dados** sem backup. | 1 | 5 | 5 | 1×5 | Supabase Pro com backup de 7 dias (D-02). Migrações versionadas. Reimportar os OFX recompõe as transações (upsert idempotente, RF-32); o Davi deve guardar os arquivos OFX baixados. | Incidente. Equipe. |
| R-15 | **Davi esquece de importar o extrato** e o painel fica desatualizado sem ele perceber; decisões com números velhos. | 4 | 3 | **12** | novo | Aviso "Última importação há X dias" no cabeçalho e no painel, em destaque a partir de 7 dias (RF-34, P-33). Data do saldo exibida (RF-27). Comprovantes pendentes acumulando também denunciam o atraso (RF-42). Rotina semanal combinada com o Davi (P-41). | Aviso de 7 dias aceso. Davi importa. |
| R-16 | **IA lê o valor (ou a data) errado** e o comprovante vai para a transação errada ou não concilia. | 3 | 3 | 9 | novo | Conciliação só por **valor exato** e ±3 dias (P-30): um valor lido errado tende a não conciliar, em vez de conciliar errado. Selo de confiança < 0,7 (P-36). Correção manual que reconcilia (RF-41). Desfazer conciliação (RF-40). Chave de acesso do QR prevalece (RF-37). Alerta de pendente (RF-42). | Muitas correções de valor. Equipe ajusta o prompt ou o modelo (P-45). |
| R-17 | **Formato do OFX do Sicredi varia** (SGML x XML, codificação, fuso nas datas, vírgula decimal, `FITID` instável entre exportações). | 3 | 3 | 9 | novo | Leitor tolerante com suíte de fixtures (RNF-28). Erro claro `arquivo_invalido` sem gravar nada (RF-31, RF-32). Pedir ao Davi um OFX real anonimizado antes do go-live. Testar dois arquivos do mesmo período exportados em dias diferentes: se o `FITID` mudar (duplicaria), registrar ADR para chave alternativa (data + valor + descrição). | `arquivo_invalido` ou duplicatas visíveis. Equipe. |
| R-18 | **Foto ruim** (tremida, cortada, papel térmico apagado, reflexo) gera leitura falha ou errada. | 4 | 2 | 8 | novo | `erro_de_leitura` com "Tentar ler de novo" e arquivo preservado (RF-36). Correção manual (RF-41). Orientação na tela de envio ("de frente, com boa luz, documento inteiro"). QR code lido no navegador para NFC-e (RF-37). Preferir o PDF original quando existir. | Taxa de `erro_de_leitura` > 20%. Davi e equipe. |
| R-20 | **Dados pessoais no comprovante enviados à IA** (CPF, endereço, nomes de terceiros): transferência internacional (LGPD art. 33). | 2 | 4 | 8 | novo | Envio inevitável para ler (ADR 0016), registrado (P-40). Remoção de EXIF/GPS e redução da imagem (RNF-24). Nenhum outro dado vai junto. Documento mascarado na interface. A Anthropic informa não usar imagens da API para treino. | Antes de virar SaaS: DPA com a Anthropic. Davi. |
| R-21 | **OFX de outra conta importado por engano** (conta pessoal do Davi, outra empresa) mistura dados. | 2 | 3 | 6 | novo | O resultado mostra banco e conta ••••1234 (RF-31). Conta nova cria registro separado e visível. Histórico de importações (RF-33). Desfazer importação fica fora da v1 (ver `fora-do-escopo.md`). | Conta inesperada no histórico. Davi. |

## Riscos de severidade alta (≥ 12): plano de ação

1. **R-15 (extrato esquecido):** RF-34 obrigatório na v1. Combinar com o Davi um dia fixo na semana para importar.
2. **R-06 e R-08 (planos gratuitos e Hobby comercial):** ≈ US$ 45/mês de infraestrutura no go-live real.
3. **R-09 (vazamento por RLS):** teste de RLS com duas Empresas bloqueando o merge, incluindo `comprovantes`, `importacoes_de_extrato` e o Storage de comprovantes.
4. **R-02 (custo da Pluggy):** encerrado pela ADR 0016.
