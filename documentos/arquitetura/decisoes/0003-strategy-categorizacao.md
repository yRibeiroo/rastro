# ADR 0003 — Strategy para categorização: regras antes da IA, correção vira regra

**Status:** Aceita (2026-10-09)

## Contexto
O cliente quer regras simples ("POSTO" → Combustível), a IA para o resto, e que suas correções virem regras. A IA custa dinheiro e tem latência. As regras são determinísticas, grátis e explicáveis. A Pluggy já entrega uma categoria própria, útil em alguns casos inequívocos.

## Decisão
- Padrão **Strategy** com a interface `EstrategiaDeCategorizacao` (contratos §5.1), executada em **corrente** pelo `ServicoDeCategorizacao`. Cada estratégia recebe só as transações que as anteriores não resolveram:
  1. `EstrategiaPorRegras`: regras ativas da empresa, por `prioridade` crescente. A correspondência é "contém" sobre o texto normalizado (maiúsculas, sem acento). **Sem regex** (evita ReDoS e é fácil de explicar ao usuário).
  2. `EstrategiaPorCategoriaDoProvedor`: tabela fixa de categorias Pluggy inequívocas (ex.: tarifas, impostos, transferências) → categoria padrão de mesmo nome. Origem `'pluggy'`.
  3. `EstrategiaPorIa`: `Classificador` (ADR 0004). Só aplica sugestões com `confianca ≥ 0,6`.
- Só entram transações **pendentes**: `categoria_id IS NULL`, `categorizacao_automatica_em IS NULL` e não definidas pelo usuário. Depois da corrente, todas são marcadas com `categorizacao_automatica_em`, para não irem à IA de novo a cada sincronização.
- **Correção do usuário** → `categoria_origem = 'usuario'`, `categoria_definida_pelo_usuario = true` (nada automático sobrescreve), e o serviço devolve uma `SugestaoDeRegra` (padrão = contraparte, se houver, senão a descrição sem dígitos) com quantas outras transações seriam afetadas. Se o usuário aceitar, `criarRegra({ origem: 'correcao', prioridade: 50, aplicarNasExistentes: true })`.
- Regras padrão entram como semente com `prioridade 100`. As do usuário (50) vencem as padrão.

## Consequências
- (+) A maioria das transações recorrentes deixa de ir à IA com o tempo, e o custo cai.
- (+) Cada estratégia é testada isoladamente. Dá para adicionar uma (ex.: por CNPJ) sem tocar nas outras.
- (+) A origem fica registrada (`regra_id`, `confianca_ia`), então a interface explica "por que essa categoria".
- (−) "Contém" pode gerar falsos positivos em padrões curtos. Mitigação: mínimo de 2 caracteres e prévia de quantas transações a regra afeta antes de salvar.
- (−) Uma transação marcada como tentada e sem sugestão só volta à IA se o usuário pedir "recategorizar" (aceitável: ela aparece em "Sem categoria").

## Alternativas consideradas
- **Só IA**: mais caro, não determinístico, e a correção do usuário não vira aprendizado auditável.
- **Regras com regex**: mais poder, mas risco de ReDoS e difícil para o usuário final.
- **Chain of Responsibility com classes encadeadas**: equivalente, mas uma lista ordenada de estratégias é mais simples de ler e de testar.
