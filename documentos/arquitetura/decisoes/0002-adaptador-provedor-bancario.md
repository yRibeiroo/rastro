# ADR 0002 — Pluggy atrás do adaptador `ProvedorBancario`

**Status:** Aceita (2026-10-09)

## Contexto
A Pluggy é o agregador escolhido (o conector direto do Sicredi PJ foi descontinuado e a conexão direta ao Open Finance é inviável). No caminho comercial, porém, pode ser preciso trocar ou somar agregadores (Belvo, outro). O SDK tem vocabulário próprio (`item`, `account`), retorna erros como objetos (não `Error`), tem métodos obsoletos (`fetchTransactions`) e restrições de filtros (`createdAtFrom` × `dateFrom`).

## Decisão
- Padrão **Adapter**: a interface `ProvedorBancario` (ver [contratos §3.1](../contratos.md#31-adaptador-provedorbancario-provedor-bancariots)) usa **tipos neutros em português** (`ConexaoDoProvedor`, `TransacaoDoProvedor`, `EventoDeWebhook`).
- Implementação única: `src/regras-de-negocio/conexao-bancaria/adaptadores/pluggy/`, sobre `PluggyClient` do `pluggy-sdk` 0.92 (que já autentica e renova a API Key sozinho).
- O adaptador também interpreta o payload do webhook (`interpretarWebhook`), porque o formato do evento é do provedor.
- Status, tipo de conta, sinal do valor e contraparte são **traduzidos no adaptador** (tabelas em contratos §12). O banco guarda os nossos valores (`atualizada`, `corrente`…), não os da Pluggy.
- `import 'pluggy-sdk'` só é permitido nessa pasta e em `comandos/` (regra de ESLint).
- O `clientUserId` enviado à Pluggy é o **`empresaId`** (não o e-mail), o que minimiza dados pessoais e permite descobrir a empresa no webhook.

## Consequências
- (+) Trocar de agregador = escrever um novo adaptador + migração do valor de `conexoes.provedor`.
- (+) Os testes usam um `ProvedorBancario` falso, sem rede.
- (−) Uma camada a mais de mapeamento para manter quando a Pluggy mudar o SDK.
- (−) Recursos específicos da Pluggy (ex.: categorias dela) ficam disponíveis só de forma reduzida (`categoriaDoProvedor` como texto).

## Alternativas consideradas
- **Usar o SDK direto nos serviços**: menos código, mas espalharia o vocabulário e os erros da Pluggy pelo domínio, e os testes ficariam acoplados.
- **Chamar a API REST com `fetch`**: perderíamos tipos e a renovação da API Key prontos. O SDK oficial é a recomendação do PROMPT.
