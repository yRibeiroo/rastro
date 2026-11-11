# ADR 0018 — Assistente financeiro com ferramentas pré-definidas e somente leitura

**Status:** Aceita (2026-11-11)

## Contexto

O painel responde às perguntas mais comuns, mas não a todas: "quanto gastei com material em outubro?", "o que mais subiu de setembro para cá?". Um chat em linguagem natural cobre esses casos. O risco é conhecido: um modelo que escreve SQL pode ler dados de outra empresa, alterar registros ou devolver um número que nenhuma consulta produziu.

## Decisão

- **Tool use do Claude com cinco ferramentas fixas**, definidas em `src/regras-de-negocio/agente/ferramentas.ts`: `resumo_financeiro`, `gastos_por_categoria`, `comparar_periodos`, `maiores_gastos` e `buscar_transacoes`. O modelo escolhe a ferramenta e os parâmetros. **Ele nunca escreve SQL.**
- **Somente leitura por construção.** As ferramentas recebem só os métodos de leitura dos serviços (`Pick<ServicoDoPainel, "obterResumo">`, `Pick<ServicoDeExtrato, "listar">`). Não existe caminho de escrita para o modelo chamar.
- **Mesma sessão, mesma RLS.** As consultas passam pelos serviços do usuário logado, então o isolamento por empresa (ADR 0006) vale para o assistente como vale para as telas.
- **Entrada do modelo é entrada não confiável.** Cada ferramenta valida os parâmetros com Zod (datas ISO, limites de quantidade) antes de consultar.
- **Os números vêm das ferramentas.** As instruções mandam citar o período consultado e proíbem estimar. Os totais usam as mesmas funções do painel, então a resposta do chat bate com a tela.
- **Texto de transação é dado, não instrução.** Descrições e nomes de contraparte vêm de terceiros; as instruções mandam ignorar pedidos dentro deles.
- **Laço com teto.** O tool runner do SDK conduz o laço, com no máximo 8 iterações. Recusa, corte por tamanho ou laço que não termina viram `assistente_indisponivel`, sem resposta parcial.
- **Teto de custo.** Limite por IP (20 por hora) e por empresa por dia (`IA_LIMITE_ASSISTENTE_DIA`, padrão 100), ambos no Postgres (ADR 0011). Diferente dos outros limites, este é **fechado**: sem o banco de limites, o modelo não é chamado.
- **Sem histórico no servidor.** A conversa fica no navegador e é reenviada a cada pergunta (até 20 mensagens). Nada do chat é gravado no banco.
- **Flag `RECURSO_ASSISTENTE`** (padrão `1`) liga e desliga a tela.

## Consequências

- (+) O pior caso de uma instrução maliciosa é uma consulta de leitura aos dados da própria empresa.
- (+) Funciona na demo pública (ADR do modo demo): é leitura, e o teto diário limita o gasto.
- (+) Ferramenta nova é uma função com esquema e teste, sem mexer no adaptador.
- (−) Perguntas fora das cinco ferramentas ficam sem resposta (por exemplo, por centro de custo). O assistente diz que não encontrou em vez de improvisar.
- (−) `maiores_gastos` ordena em memória até 1.000 saídas do período e avisa quando passa disso.
- (−) A resposta não é transmitida aos poucos: a tela espera o texto inteiro (5 a 10 segundos nos testes).

## Verificação

Testes de unidade em `testes/unidade/regras-de-negocio/agente/`. Em 10/11/2026, cinco perguntas reais contra o banco de demonstração tiveram os totais conferidos direto no banco (combustível de outubro, saídas de setembro e de outubro).
