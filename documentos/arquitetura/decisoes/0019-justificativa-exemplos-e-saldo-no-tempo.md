# ADR 0019 — Justificativa da IA, correções como exemplos e saldo ao longo do tempo

**Status:** Aceita (2026-11-12)

## Contexto

A categorização por IA (ADR 0004) devolvia só categoria e confiança. Quem via "sugerida pela IA" não sabia por quê, e uma correção do usuário só ensinava o sistema se virasse regra. O painel mostrava o saldo de hoje, sem a trajetória.

## Decisão

### Justificativa curta

- A saída estruturada do Claude ganha `justificativa`: uma frase de até 100 caracteres. O app corta em 200 e grava em `transacoes.justificativa_ia`.
- Só é gravada com origem `ia`. Quando o usuário corrige a categoria, ela é apagada junto com a confiança.
- Aparece no detalhe da transação como "Motivo da IA".
- A coluna não tem constraint amarrando à origem: a tela só mostra com origem `ia`, e um caminho de escrita que esquecesse de limpar não deve fazer a correção do usuário falhar.

### Correções como exemplos

- Uma correção continua oferecendo virar **regra** (ADR 0003), que vale para o mesmo estabelecimento sem chamar a IA.
- Além disso, as correções recentes vão como **exemplos** em cada chamada ao Claude: até 20, uma por descrição (a mais recente), só de categorias ainda disponíveis, com os dados pessoais mascarados como os itens (ADR 0004).
- As instruções dizem que um item parecido com um exemplo recebe a mesma categoria.
- As correções só são lidas quando a IA vai rodar. Se a leitura falhar, a categorização segue sem exemplos.
- Continua valendo: só vai para a IA o que nenhuma regra resolveu.

### Saldo ao longo do tempo

- Nova função `movimento_mensal`: líquido por mês de **tudo** o que mexe no saldo. Diferente dos painéis, inclui transferências e transações ocultas; só as pendentes ficam de fora.
- O serviço parte do saldo atual e desfaz o movimento de cada mês, do mais recente para o mais antigo. Não há tabela de saldos históricos.
- O painel mostra uma linha com o saldo no fim de cada mês, nos mesmos meses do gráfico de entradas e saídas, com alternativa em tabela.

## Consequências

- (+) A sugestão da IA fica explicável, e o usuário decide melhor se aceita ou corrige.
- (+) A IA aprende com correções que não viraram regra.
- (+) O gráfico de saldo não exige guardar histórico.
- (−) Os exemplos mudam a cada correção, então o conteúdo da mensagem não aproveita cache entre chamadas (as instruções continuam fixas).
- (−) O saldo de meses passados é **estimado**: parte do saldo informado pelo banco. Se faltar um extrato no meio do período, os meses anteriores a ele ficam deslocados pelo valor que faltou.
- (−) Transações com data futura não entram na conta.

## Verificação

Testes de unidade (estratégia da IA, classificador, serviço do painel) e pgTAP `11_justificativa_e_movimento_mensal.sql`. A migração `20261112120000` foi aplicada em produção e no banco de demonstração em 12/11/2026.
