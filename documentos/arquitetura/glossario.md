# Glossário do Rastro

Fonte única dos termos do domínio. **O mesmo conceito tem o mesmo nome no código, no banco e na interface.** Termos da Pluggy (`item`, `account`, `transaction`) só aparecem dentro do adaptador `src/regras-de-negocio/conexao-bancaria/adaptadores/pluggy/`.

Convenções:
- Código TypeScript: tipos em `PascalCase` sem acento (`Transacao`, `CentroDeCusto`), funções e campos em `camelCase` (`categoriaId`).
- Banco: tabelas no plural em `snake_case` sem acento (`transacoes`, `centros_de_custo`), colunas em `snake_case`.
- Interface: português com acento, em minúsculas no meio da frase.

| Termo | Definição | Código (TS) | Banco | Interface |
|---|---|---|---|---|
| **Empresa** | Organização dona dos dados. Todo dado de negócio pertence a exatamente uma empresa. Hoje existe uma só (HOMETEC SERVIÇOS). | `Empresa`, `empresaId` | `empresas`, coluna `empresa_id` | "Empresa" |
| **Membro da empresa** | Vínculo entre um usuário do Supabase Auth e uma empresa, com papel. | `MembroDaEmpresa`, `PapelNaEmpresa` (`'dono' \| 'membro'`) | `membros_empresa` (`user_id`, `empresa_id`, `papel`) | "Membro" (só a partir da versão multiusuário) |
| **Usuário** | Pessoa autenticada por link mágico. Na v1, só o e-mail de `EMAIL_AUTORIZADO`. | `ContextoDoUsuario` (`usuarioId`, `email`, `empresaId`) | `auth.users` | "Você" / e-mail no menu |
| **Conexão** | Autorização de leitura de uma instituição financeira via agregador (na Pluggy, um *item*). Tem status e prazo de consentimento. | `Conexao`, `StatusDaConexao`, `conexaoId`; id do agregador: `idExterno` | `conexoes` (`id_externo` = itemId da Pluggy) | "Conexão bancária" |
| **Conta** | Conta bancária (corrente, poupança ou cartão) dentro de uma conexão. Guarda o saldo. | `Conta`, `contaId` | `contas` | "Conta" |
| **Transação** | Movimento de dinheiro em uma conta. `valor` **negativo = saída**, positivo = entrada. | `Transacao`, `valorCentavos` | `transacoes` (`valor numeric(14,2)`) | "Transação" / "Lançamento" no extrato |
| **Entrada / Saída** | Sentido da transação, derivado do sinal do valor. | `Sentido` (`'entrada' \| 'saida'`) | derivado de `valor > 0` / `valor < 0` | "Entrada" / "Saída" |
| **Contraparte** | Quem recebeu (saída) ou quem pagou (entrada), quando o banco informa. | `contraparte` | `transacoes.contraparte` | "Quem recebeu" / "Quem pagou" |
| **Extrato** | Lista de transações com filtros e busca. | módulo `extrato`, `ServicoDeExtrato` | consulta sobre `transacoes` | "Extrato" |
| **Sincronização** | Trazer do agregador as transações novas, alteradas ou removidas. | `ServicoDeSincronizacao` | `conexoes.ultima_sincronizacao_em` | "Sincronizar agora" / "Sincronizado há 5 min" |
| **Categoria** | Classificação do que é a transação (ex.: Combustível). Tem tipo: entrada, saída ou ambos. | `Categoria`, `TipoDeCategoria` | `categorias` | "Categoria" |
| **Origem da categoria** | Quem decidiu a categoria: regra, IA, usuário ou mapeamento do agregador. | `OrigemDaCategoria` (`'regra' \| 'ia' \| 'usuario' \| 'pluggy'`) | `transacoes.categoria_origem` | Selo: "Regra", "IA", "Você", "Banco" |
| **Categoria definida pelo usuário** | Marca que impede qualquer processo automático (ressincronização, regra ou IA) de alterar a categoria ou o centro de custo. | `categoriaDefinidaPeloUsuario` | `transacoes.categoria_definida_pelo_usuario` | (implícito no selo "Você") |
| **Regra** | "Se o campo X contém Y, a categoria é Z (e o centro de custo é W)." Avaliada por prioridade, antes da IA. | `Regra`, `CampoDaRegra`, `OrigemDaRegra` | `regras_categorizacao` | "Regra" |
| **Sugestão de regra** | Proposta gerada quando o usuário corrige uma categoria; vira `Regra` se ele aceitar. | `SugestaoDeRegra` | (não persiste) | "Sempre categorizar assim?" |
| **Classificador** | Componente que sugere a categoria com IA (hoje Claude), com confiança de 0 a 1. | `Classificador`, `SugestaoDeCategoria` | `transacoes.confianca_ia` | "Sugerido pela IA" |
| **Centro de custo** | Linha de serviço que gera a receita ou o gasto: Ar-condicionado/Refrigeração, Elétrica, Prevenção contra incêndio, Administrativo. | `CentroDeCusto`, `centroDeCustoId` | `centros_de_custo` | "Centro de custo" |
| **Anexo** | Nota fiscal ou comprovante ligado a uma transação, guardado no bucket privado. | `Anexo` | `anexos` + Storage `anexos/{empresa_id}/…` | "Anexo" / "Anexar nota" |
| **Evento de webhook** | Notificação recebida do agregador, registrada pelo `eventId` para não ser processada duas vezes. | `EventoDeWebhook` (já traduzido), `eventoId` | `eventos_webhook` (`event_id` PK) | (não aparece) |
| **Painel** | Agregações: entradas × saídas por mês, gastos por categoria, resultado por centro de custo e saldo. | `ServicoDoPainel`, `ResumoDoPainel` | funções `painel_*` | "Painel" |
| **Provedor bancário** | Agregador de Open Finance atrás do adaptador (hoje Pluggy). | `ProvedorBancario` | `conexoes.provedor` (`'pluggy'`) | (não aparece) |
| **Token de conexão** | Token de curta duração que o widget usa para abrir o fluxo de autorização. | `criarTokenDeConexao` → `{ token }` | (não persiste) | (não aparece) |
| **Consentimento** | Autorização Open Finance com prazo de validade; quando expira, é preciso reconectar. | `consentimentoExpiraEm` | `conexoes.consentimento_expira_em` | "Autorização válida até…" / "Reconectar" |

## Status da conexão

| `StatusDaConexao` (TS e banco) | Status Pluggy (`ItemStatus`) | Interface |
|---|---|---|
| `atualizada` | `UPDATED` | "Em dia" |
| `atualizando` | `UPDATING`, `MERGING` | "Sincronizando…" (orbe `searching`) |
| `aguardando_usuario` | `WAITING_USER_INPUT`, `WAITING_USER_ACTION` | "Precisa da sua autorização" |
| `erro_de_login` | `LOGIN_ERROR` | "Reconectar" |
| `desatualizada` | `OUTDATED` | "Desatualizada, tentando de novo" |
| `erro` | evento `item/error` sem status mais específico | "Erro na conexão" |

## Termos proibidos (para evitar sinônimos)

- "Lançamento" só como rótulo de interface; no código e no banco é sempre **transação**.
- Não use "item" fora do adaptador Pluggy (é **conexão**). Não use "account" ou "transaction" fora dele.
- Não use "tag", "rótulo" ou "classe" para categoria. Não use "projeto" ou "serviço" para **centro de custo**.
- Não use "tenant", "organização" ou "cliente" para **empresa**.
