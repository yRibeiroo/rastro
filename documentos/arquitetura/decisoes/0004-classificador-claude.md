# ADR 0004 — `Classificador` com Claude: modelo mais recente, saída estruturada e minimização (LGPD)

**Status:** Aceita (2026-10-09)

## Contexto
O que as regras não resolvem vai para a IA. O PROMPT pede o modelo mais recente da Anthropic. Os dados são financeiros e alguns são pessoais (nome de contraparte pessoa física). A LGPD exige finalidade e minimização. A resposta precisa ser JSON validável, sem parse frágil de texto.

## Decisão
- Interface `Classificador` (contratos §5.2), implementada em `src/regras-de-negocio/categorizacao/adaptadores/claude/classificador-claude.ts` com `@anthropic-ai/sdk` 0.132.
- **Modelo:** `claude-opus-5-5` (o Opus atual e o padrão recomendado pela Anthropic em 2026-10), numa constante `MODELO_DO_CLASSIFICADOR`. Fica numa constante, não no ambiente, para que a troca de modelo passe por revisão.
- **Configuração da chamada:**
  - Assinaturas conferidas no SDK instalado:
    ```ts
    import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
    const resposta = await anthropic.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',                                   // BetaFallbacksParam = Array<…> | 'default'
      output_config: { format: betaZodOutputFormat(EsquemaDaResposta), effort: 'low' },
      system: INSTRUCOES,                                     // fixo, para aproveitar o cache de prompt
      messages: [{ role: 'user', content: JSON.stringify({ categorias, centrosDeCusto, itens }) }],
    });
    // resposta.parsed_output: objeto validado ou null
    ```
    Sem o fallback, o equivalente não-beta é `anthropic.messages.parse` + `zodOutputFormat` de `@anthropic-ai/sdk/helpers/zod`.
  - `effort: 'low'`: classificação curta não ganha com esforço maior (no Opus 5.5 o padrão é `medium`, por isso o valor é explícito). **Não** enviar `thinking: {type:'disabled'}` nem `budget_tokens`, que dão 400 nesse modelo.
  - Tratar `stop_reason === 'refusal'` (e `max_tokens`) e `parsed_output === null` como "sem sugestão" para o lote, sem lançar erro.
  - Fallback do lado do servidor (`fallbacks: 'default'`) ativado por padrão, como recomenda a Anthropic: se o modelo recusar por um classificador de segurança, o próprio servidor tenta outro modelo.
  - Erros: cadeia de classes do SDK (`RateLimitError`, `APIConnectionError`, `APIError`) → `ErroDeNegocio('classificador_indisponivel')`. O SDK já faz 2 novas tentativas por padrão. `timeout: 30_000` ms.
- **Minimização:** a IA recebe **somente** `descricao`, `valor` (em reais, com sinal) e `contraparte` de cada transação, mais a lista de categorias e centros de custo com **códigos curtos** (`c1`, `k1`). Nunca recebe ids do banco, contas, documentos (CPF/CNPJ), e-mail, nome da empresa ou datas. `referencia` é o índice no lote.
- Lotes de no máximo **50** itens. A resposta é validada com Zod (`confianca` entre 0 e 1). Códigos desconhecidos são descartados. Sugestões com confiança abaixo de 0,6 não são aplicadas.
- Liga/desliga por `RECURSO_CATEGORIZACAO_IA` (ADR 0010).
- `ANTHROPIC_API_KEY` só no servidor. O log registra apenas a contagem de itens e o tempo, nunca o conteúdo.

## Consequências
- (+) A resposta é sempre um objeto tipado. O prompt pode evoluir sem quebrar o parser.
- (+) Pouco dado pessoal sai do ambiente. A API comercial da Anthropic não usa os dados para treino. Isso deve constar da política de privacidade e do registro de tratamento.
- (−) A contraparte ainda pode ser o nome de uma pessoa física. É necessária para a qualidade da classificação e fica registrada como dado mínimo necessário.
- (−) O custo cresce com o volume. É mitigado pelas regras (ADR 0003), pelo marcador `categorizacao_automatica_em` e pelo `effort: 'low'`. No volume de uma PJ pequena (centenas de transações/mês) o custo é de centavos.
- (−) Modelo novo = migração. Revisar o `claude-api` / guia de migração a cada troca.

## Alternativas consideradas
- **Tool use forçado para obter JSON**: `tool_choice` forçado dá 400 no Opus 5.5. A saída estruturada é o caminho oficial.
- **Modelo menor (Sonnet/Haiku) por custo**: possível depois de medir. A recomendação vigente é usar o Opus atual, e a troca é de uma linha.
- **Enviar o id da transação**: desnecessário e vaza identificador interno.
