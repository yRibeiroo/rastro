# Requisitos — Rastro v1

Convenções:
- **Prioridade:** M = obrigatório na v1 (*must*); S = desejável (*should*).
- **Critério verificável:** condição objetiva que o QA confere por teste automatizado (U = unidade, I = integração, E = ponta a ponta, A = auditoria/ferramenta) ou por inspeção (N).
- Termos do glossário: **Empresa, Conexão, Transação, Categoria, Regra, Centro de custo**.
- Premissas citadas como `P-xx` estão em `premissas.md`.
- **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1):** o requisito continua válido e testado no código, mas só vale em execução com a flag ligada. Com a flag desligada (padrão da v1), vale o RF-45. Origem: ADR 0016 (`documentos/arquitetura/decisoes/0016-extrato-ofx-e-comprovantes-com-ia.md`).
- A fonte da verdade da v1 é o **extrato OFX importado** (RF-31 a RF-34). Os **comprovantes lidos por IA** (RF-35 a RF-44) trazem o detalhe.

---

## 1. Requisitos funcionais

### 1.1 Acesso

**RF-01 — Login por link mágico** (M)
O sistema autentica o usuário com Supabase Auth por link mágico enviado ao e-mail informado. Não existe login por senha.
*Critério:* (E) informar o e-mail autorizado na tela `/entrar` exibe "Enviamos um link para seu e-mail". Abrir o link cria a sessão e redireciona para `/painel`. A tela não tem campo de senha.

**RF-02 — Restrição ao EMAIL_AUTORIZADO** (M)
Só o e-mail definido na variável de ambiente `EMAIL_AUTORIZADO` pode receber link e ter sessão. A comparação ignora maiúsculas e espaços nas pontas. A verificação acontece **no servidor**, antes de pedir o envio do link e de novo no callback de autenticação.
*Critério:* (I) e-mail diferente → nenhuma chamada de envio ao Supabase e resposta genérica idêntica à de sucesso (para não revelar quais e-mails existem). (I) sessão criada para outro e-mail por qualquer meio → callback encerra a sessão e responde 403. (U) `"  Davi@X.com "` é aceito quando `EMAIL_AUTORIZADO="davi@x.com"`. Sem `EMAIL_AUTORIZADO` configurado, todo login é recusado.

**RF-03 — Proteção de rotas e saída** (M)
Todas as páginas, exceto `/entrar` e o callback de autenticação, e todas as rotas de API, exceto o webhook da Pluggy (que tem autenticação própria e, com `RECURSO_OPEN_FINANCE=false`, responde 404 — RF-45), exigem sessão válida. Há um botão "Sair" que encerra a sessão.
*Critério:* (E) acessar `/extrato` sem sessão redireciona para `/entrar`. (I) chamar `/api/...` sem sessão → 401. (E) "Sair" leva a `/entrar`, e voltar no navegador não mostra dados.

**RF-04 — Animação de abertura** (M)
Na primeira visita da sessão do navegador, a logo se desenha (traçado SVG) e deixa um rastro de luz que se dissolve na tela seguinte. A animação dura no máximo 2,5 s, tem botão "Pular", roda enquanto os dados carregam e não se repete na mesma sessão. Com `prefers-reduced-motion: reduce`, é substituída por um fade simples de até 300 ms.
*Critério:* (E) primeira visita → elemento da abertura visível e removido em ≤ 2,5 s. Segunda navegação na mesma sessão → a abertura não aparece. "Pular" (clique, Enter ou Espaço) remove na hora. (E) com redução de movimento emulada → sem traçado, só fade. (A) o LCP da página não piora mais de 10% com a animação ligada em comparação com desligada.

### 1.2 Conexão bancária (Open Finance, condicionada a `RECURSO_OPEN_FINANCE`)

**RF-05 — Conectar banco pelo Pluggy Connect** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
Em `/conexoes-bancarias`, o botão "Conectar banco" pede ao servidor um Connect Token e abre o widget Pluggy Connect para o conector *Sicredi Empresas* (Open Finance). O `clientUserId` vem **da sessão** (id da Empresa), nunca do corpo da requisição. O Connect Token é criado **sem `webhookUrl`** e com `avoidDuplicates: true`. `includeSandbox` só fica ativo quando `PLUGGY_INCLUIR_SANDBOX=true`.
*Critério:* (I) `POST /api/conexoes/token` com sessão → 200 com `accessToken`. A chamada ao SDK não contém `webhookUrl`, e o `clientUserId` é o da sessão mesmo que o corpo traga outro. (I) erro da Pluggy → 502 com mensagem genérica, sem detalhes nem credenciais. (E) no sandbox, o fluxo completo cria uma Conexão.

**RF-06 — Validar e registrar a Conexão** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
Ao concluir o widget, o cliente envia o `itemId`. O servidor valida o formato UUID, consulta `GET /items/{id}` na Pluggy (fonte da verdade) e só então salva a Conexão (`empresa_id`, `item_id`, banco, status, `consentimento_expira_em`). Se o item não pertencer à aplicação, responde 404.
*Critério:* (I) `itemId` com formato inválido → 400. Pluggy responde 404 → 404 e nada é salvo. Sucesso → 201 com `{itemId, banco, status}` e linha criada (upsert, sem duplicar em reconexão).

**RF-07 — Status da Conexão visível** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
A tela de conexões e o cabeçalho do app mostram o status de cada Conexão em linguagem simples: "Conectado", "Sincronizando", "Precisa reconectar" (erro de login, consentimento expirado ou expirando em até 7 dias) e "Erro" (outros), além da data da última sincronização bem-sucedida.
*Critério:* (U) a função de mapeamento converte cada status da Pluggy (`UPDATED`, `UPDATING`, `LOGIN_ERROR`, `OUTDATED`, `WAITING_USER_INPUT`, `WAITING_USER_ACTION`, `ERROR`) e a data de expiração do consentimento no rótulo esperado. (E) uma Conexão com status `LOGIN_ERROR` mostra "Precisa reconectar" e um aviso no cabeçalho.

**RF-08 — Reconectar quando o consentimento expira** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
Quando a Conexão estiver em "Precisa reconectar", um botão "Reconectar" abre o Pluggy Connect em modo de atualização do mesmo item (`updateItem`), sem criar outra Conexão. Ao concluir, o status volta a ser consultado na Pluggy.
*Critério:* (I) o token de reconexão é pedido para o `itemId` existente, e a contagem de Conexões não muda. (E) no sandbox, depois de reconectar, o status passa a "Conectado".

### 1.3 Sincronização via Pluggy (porte das regras do protótipo; RF-09 a RF-13 condicionados a `RECURSO_OPEN_FINANCE`)

**RF-09 — Webhook autenticado** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
`POST /api/webhooks/pluggy` aceita só requisições com `Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>`, comparado em tempo constante. Sem o segredo configurado, recusa tudo. Payload sem `event` ou `eventId` (strings) → 400.
*Critério:* (U/I) header ausente ou errado → 401. Segredo não configurado → 401 com log de erro. Payload inválido → 400. Válido → 200. (U) a comparação usa `timingSafeEqual` (ou equivalente).

**RF-10 — Deduplicação por eventId** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
Cada `eventId` é gravado (`eventos_webhook`) antes do processamento. Um evento repetido responde 200 com `{received: true, duplicado: true}` e não é reprocessado.
*Critério:* (I) enviar o mesmo evento 2 vezes → 1 processamento e a 2ª resposta com `duplicado: true`. Envios concorrentes do mesmo `eventId` → 1 processamento (restrição única no banco).

**RF-11 — Resposta rápida e processamento posterior** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
O webhook responde em menos de 10 s (meta: < 1 s) e processa depois com `after()`. O estado do evento é registrado (`recebido` → `processado` | `falhou`, com código de erro sem dados sensíveis).
*Critério:* (I) com a Pluggy simulada lenta (5 s), a resposta do webhook sai em < 1 s. (I) falha simulada no processamento → evento fica `falhou` e a resposta já enviada foi 200.

**RF-12 — Eventos de item** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
- `item/created`: consulta `GET /items/{id}`, atualiza o status e, se o status for `UPDATED`, sincroniza todas as contas do item.
- `item/updated`: consulta o item, atualiza o status e sincroniza.
- `item/error`: marca a Conexão como erro, guardando o código e a mensagem do payload.
- `item/waiting_user_input` e `item/deleted`: atualizam o status (P-05). Outros eventos são ignorados com log.
*Critério:* (I) para cada evento, com fixture realista, o status salvo é o que o `GET /items/{id}` simulado devolveu (não o do payload), e a sincronização só ocorre nos casos previstos.

**RF-13 — Eventos de transação** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
- `transactions/created`: sincroniza o item a partir de `transactionsCreatedAtFrom` (ou tudo, se não vier).
- `transactions/updated`: busca de novo só os `transactionIds` na conta `accountId`.
- `transactions/deleted`: remove as Transações com os `transactionIds` (escopo da Empresa da Conexão).
Busca paginada de 500 em 500 até a última página. A Empresa é resolvida pelo `itemId` salvo, porque eventos de transação não trazem `clientUserId`.
*Critério:* (I) fixtures com 2 páginas → todas as transações gravadas. `updated` → só os ids informados são consultados. `deleted` → as transações somem, e transações de outra Empresa com o mesmo id externo não são afetadas. Evento de `itemId` desconhecido → ignorado com log.

**RF-14 — Mapeamento Pluggy → Transação** (M) · *a parte Pluggy só se aplica com `RECURSO_OPEN_FINANCE`; o mapeamento do OFX está no RF-31*
Cada transação é gravada com: id externo (texto, ids UUID convertidos), `item_id`, `conta_id`, data, descrição, valor (**negativo = saída**: um `DEBIT` positivo vira negativo), tipo, categoria da Pluggy e **contraparte** (recebedor em `DEBIT`, pagador em `CREDIT`, com `merchant.name` como alternativa e nulo se não houver). Saldo e nome das contas também são gravados (para o RF-27).
*Critério:* (U) tabela de casos: `DEBIT` 50 → -50; `DEBIT` -50 → -50; `CREDIT` 80 → 80; contraparte de débito = `receiver.name`, de crédito = `payer.name`, sem `paymentData` = `merchant.name`, sem nenhum = nulo; id `UUID` vira string.

**RF-15 — Nunca sobrescrever a categoria do usuário** (M)
A ressincronização (Pluggy) e a reimportação de extrato (RF-32) atualizam só os campos vindos do banco (data, descrição, valor, tipo, categoria da Pluggy, contraparte). Categoria, centro de custo, origem da categoria e anexos definidos no Rastro são preservados. Uma transação com origem `usuario` nunca é recategorizada por regra nem por IA.
*Critério:* (I) definir a categoria manualmente, reenviar `transactions/updated` com descrição alterada → a descrição muda, e a categoria e o centro de custo continuam. (U) o motor de categorização pula as transações com origem `usuario`.

### 1.4 Extrato

**RF-16 — Listar o extrato** (M)
`/extrato` lista as Transações da Empresa da mais recente para a mais antiga, paginadas (50 por página ou rolagem incremental). Cada linha mostra data, descrição, contraparte, valor (entrada e saída diferenciadas por cor **e** por sinal/ícone), Categoria (com indicação "sugerida pela IA" quando a origem for `ia`), Centro de custo e ícone de anexo.
*Critério:* (E) com 120 transações de seed, a primeira página mostra 50 em ordem decrescente de data e carregar mais mostra as seguintes. (A) a diferença entre entrada e saída não depende só de cor (axe e inspeção).

**RF-17 — Busca** (M)
Um campo de busca filtra por descrição **ou** contraparte, sem diferenciar maiúsculas nem acentos, com espera de 300 ms após a digitação.
*Critério:* (I) buscar "posto" encontra "POSTO SÃO JOSÉ". Buscar "joao" encontra a contraparte "João Silva". Busca vazia mostra tudo.

**RF-18 — Filtros** (M)
Filtros combináveis: período (início e fim, padrão o mês atual, com atalhos "Este mês", "Mês passado", "Últimos 90 dias"), Categoria (várias), Centro de custo (vários, incluindo "Sem centro de custo"), Direção (Entradas, Saídas, Todas) e "Sem categoria". Os filtros ficam refletidos na URL (*query string*), para que um link ou recarregamento preserve a visão. Os limites de período seguem o fuso America/Araguaina.
*Critério:* (I) cada filtro sozinho e combinado devolve o subconjunto esperado das fixtures. (U) uma transação às 23h30 de 31/01 em Araguaína entra em janeiro (mesmo sendo 01/02 em UTC). (E) recarregar a página mantém os filtros.

### 1.5 Categorização

**RF-19 — Categorização por regras** (M)
Transações novas, ou sem categoria e sem origem `usuario`, passam primeiro pelas Regras da Empresa, em ordem de prioridade. Uma Regra tem: condição (texto contido na descrição **ou** na contraparte, sem diferenciar maiúsculas nem acentos), direção opcional (entrada/saída), Categoria e Centro de custo opcional. A primeira que casar define a categoria com origem `regra`.
*Critério:* (U) a regra "POSTO" → Combustível classifica "POSTO SHELL 123". Com duas regras que casam, vale a de maior prioridade. A regra com direção "saída" não casa com uma entrada.

**RF-20 — Categorização por IA (Claude)** (M)
O que nenhuma Regra classificar vai para o `Classificador` (implementação Claude, modelo em `ANTHROPIC_MODELO`, padrão `claude-opus-5-5`), enviando **só** descrição, contraparte, valor e direção, mais a lista de Categorias da Empresa. A resposta é estruturada: uma categoria existente e a confiança. Categoria fora da lista ou confiança < 0,6 → fica "Sem categoria". A origem é gravada como `ia`. Falha, timeout (10 s) ou teto mensal atingido (RNF-23) **não** impedem gravar a transação: ela fica "Sem categoria" e pode ser reprocessada.
*Critério:* (U) com o Classificador simulado: categoria válida → origem `ia`; categoria inventada → sem categoria; exceção → transação gravada sem categoria. (U) o payload enviado não contém `conta_id`, `item_id`, e-mail nem sequências de 11 ou 14 dígitos (CPF/CNPJ), que são mascaradas.

**RF-21 — Correção vira Regra** (M)
O usuário pode mudar a Categoria (e o Centro de custo) de uma Transação. A origem passa a ser `usuario`. Depois de salvar, o sistema oferece "Criar regra para transações parecidas?", com a condição pré-preenchida (contraparte, se houver, senão o trecho principal da descrição sem números) e opção de aplicar também às transações existentes sem origem `usuario`.
*Critério:* (E) mudar "Outros" para "Combustível" em "POSTO X" mostra a oferta. Aceitar cria a Regra, e a próxima transação "POSTO X" chega como Combustível com origem `regra`. (I) aplicar às existentes não altera transações com origem `usuario`.

**RF-22 — Gerenciar Categorias e Regras** (M)
Em `/categorias`: listar, criar, renomear e arquivar Categorias (uma categoria em uso não é apagada, só arquivada) e listar, editar, reordenar (prioridade) e excluir Regras. Na primeira configuração, a Empresa recebe uma lista inicial de Categorias (P-09).
*Critério:* (I) criar uma categoria com nome duplicado → 409. Arquivar uma categoria em uso → ela some das opções novas, mas continua nas transações antigas. (E) reordenar regras muda o resultado da classificação seguinte.

### 1.6 Centros de custo

**RF-23 — Centros de custo e atribuição** (M)
A Empresa começa com 4 Centros de custo: **Ar-condicionado/Refrigeração, Elétrica, Prevenção contra incêndio, Administrativo**. Cada Transação (entrada ou saída) pode ter no máximo um Centro de custo, atribuído manualmente (individual ou em lote, selecionando várias no extrato) ou por Regra. Em `/centros-de-custo` é possível renomear, criar e arquivar centros.
*Critério:* (I) o seed cria exatamente os 4 centros. (E) selecionar 3 transações e atribuir "Elétrica" atualiza as 3. (U) uma Regra com centro de custo o define na classificação.

### 1.7 Painel

**RF-24 — Entradas x saídas por mês** (M)
Gráfico de barras agrupadas com entradas e saídas por mês dos últimos 12 meses (fuso America/Araguaina), com o resultado (entradas − saídas) de cada mês. Exclui transações da categoria "Transferência entre contas" (P-10).
*Critério:* (I) para as fixtures, os totais por mês batem com a soma manual, transações perto da meia-noite caem no mês local correto e transferências entre contas não entram. (A) o gráfico tem tabela alternativa acessível.

**RF-25 — Gastos por categoria** (M)
Saídas do período selecionado agrupadas por Categoria, em barras horizontais ordenadas por valor, com as 8 maiores e o resto em "Outras", mostrando valor e percentual.
*Critério:* (I) a soma das barras é igual ao total de saídas do período. (U) o agrupamento em "Outras" acontece a partir da 9ª categoria.

**RF-26 — Resultado por centro de custo** (M)
Para o período, por Centro de custo: entradas, saídas e resultado (lucro ou prejuízo), destacando qual serviço dá mais lucro. Transações sem centro aparecem em "Sem centro de custo", com atalho para classificá-las no extrato.
*Critério:* (I) os valores batem com as fixtures. (E) o atalho abre `/extrato?centro=nenhum` com o período aplicado.

**RF-27 — Saldo atual** (M)
Mostra o saldo atual das contas e a data e hora dessa leitura. Com `RECURSO_OPEN_FINANCE=false` (v1), o saldo é o `LEDGERBAL` do extrato OFX importado com a data de saldo mais recente (P-37). Com a flag ligada, é o `balance` da Pluggy na última sincronização (P-25).
*Critério:* (I) depois de importar a fixture OFX com `LEDGERBAL` 1234.56 em 10/10/2026, o painel mostra "R$ 1.234,56" e "saldo do extrato de 10/10/2026". Importar depois um OFX mais antigo não troca o saldo. (I) com a flag ligada, a fixture de conta com `balance` 1234,56 mostra o mesmo valor e "atualizado em dd/mm/aaaa hh:mm".

**RF-28 — Anexos opcionais** (S)
Na Transação, o usuário pode anexar um ou mais arquivos (PDF, JPG, PNG, WEBP, até 10 MB cada), ver, baixar e remover. Os arquivos ficam no bucket **privado** `anexos` do Supabase Storage, no caminho `{empresa_id}/{transacao_id}/{uuid}` (comprovantes usam `{empresa_id}/comprovantes/{comprovante_id}/{arquivo}`, RF-35), e são acessados só por URL assinada válida por 60 s.
*Critério:* (I) envio de `.exe` ou arquivo > 10 MB → 400. (I) a URL pública sem assinatura → 400/403. A URL assinada expira em 60 s. (I) um usuário de outra Empresa não lista nem baixa o anexo (RLS do Storage).

### 1.8 Operação

**RF-29 — Registrar o webhook na Pluggy** (M) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
O script `npm run registrar-webhook -- https://dominio/api/webhooks/pluggy` cria ou atualiza (idempotente) os webhooks dos 6 eventos (mais os da P-05) com o header `Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>`. Recusa URLs que não sejam HTTPS.
*Critério:* (U) com URL `http://` → sai com erro. (I) com a API simulada, rodar 2 vezes → na 2ª só atualizações e nenhum webhook duplicado.

**RF-30 — Sincronizar agora** (S) · **Condicionado a `RECURSO_OPEN_FINANCE` (desligado na v1)**
Um botão "Sincronizar agora" na tela de conexões dispara a sincronização completa do item (os últimos 90 dias), para recuperar falhas de webhook. Limite de 1 execução a cada 5 minutos por Conexão. O orbe `searching` aparece durante a execução.
*Critério:* (I) duas chamadas em menos de 5 min → a 2ª responde 429. (I) depois de um evento `falhou`, "Sincronizar agora" grava as transações que faltavam.

### 1.9 Importação de extrato (fonte da verdade da v1 — ADR 0016)

**RF-31 — Importar extrato OFX do Sicredi** (M)
Em `/importar`, o usuário envia um arquivo `.ofx` exportado do Sicredi Internet (P-29). O `LeitorDeExtrato` (implementação `OfxSicredi`) lê OFX 1.x (SGML) e 2.x (XML) e devolve banco, conta, período (`DTSTART`/`DTEND`), saldo (`LEDGERBAL`) e lançamentos (`STMTTRN`). Cada lançamento vira uma Transação com `id_externo = FITID`, data (`DTPOSTED`, no fuso America/Araguaina), valor com o sinal do `TRNAMT` (negativo = saída), descrição (`MEMO`, ou `NAME` se `MEMO` vier vazio) e contraparte (`NAME`, quando diferente da descrição, senão nula). A conta é identificada por `BANKID` + `ACCTID` e criada na primeira importação, guardando só os 4 últimos dígitos (P-38). A origem é uma Conexão com `provedor = 'arquivo'`, status `atualizada` e "última sincronização" = data da importação. Arquivo que não é OFX válido → `ErroDeNegocio('arquivo_invalido')`.
*Critério:* (U) fixtures SGML e XML do Sicredi → mesma lista de transações, com sinal, data local e `FITID` corretos. `TRNAMT` -50.00 → -50; 80.00 → 80. (U) arquivo de texto qualquer, OFX truncado ou sem `STMTTRN`/`FITID` → `arquivo_invalido` e nada gravado. (I) a primeira importação cria 1 Conta (só 4 últimos dígitos) e 1 Conexão `arquivo`. (E) enviar a fixture mostra "X transações novas · período dd/mm a dd/mm · conta ••••1234".

**RF-32 — Reimportação idempotente e categorização das novas** (M)
A gravação é um upsert por `(empresa_id, id_externo)`. Reimportar o mesmo período (ou períodos sobrepostos) atualiza os campos vindos do banco e **nunca** altera categoria, centro de custo, origem da categoria nem anexos (RF-15). Só as transações **novas** passam pela corrente de categorização (Regras → IA, RF-19/RF-20). A gravação do arquivo é atômica: ou grava tudo, ou nada. Ao fim, chama `reconciliarPendentes` (RF-39).
*Critério:* (I) importar a mesma fixture 3 vezes → mesma contagem de transações; a 2ª e a 3ª devolvem `novas = 0`. (I) categoria com origem `usuario` + reimportação com `MEMO` alterado → a descrição muda, a categoria e o centro de custo continuam. (I) na reimportação, o Classificador simulado só é chamado para os `FITID` inéditos. (I) erro simulado no meio da gravação → nenhuma transação daquele arquivo fica gravada.

**RF-33 — Histórico de importações** (M)
Cada importação bem-sucedida grava uma linha em `importacoes_de_extrato` (nome do arquivo, conta, período de/até, novas, atualizadas, data). `/importar` lista as importações da mais recente para a mais antiga.
*Critério:* (I) após 2 importações, a lista tem 2 linhas, em ordem decrescente, com os contadores devolvidos por `ServicoDeImportacao.importar`. (I) importação recusada (`arquivo_invalido`) não cria linha. (I) RLS: outra Empresa não vê o histórico.

**RF-34 — Aviso de extrato desatualizado** (M)
O cabeçalho do app e o painel mostram "Última importação há X dias" (data da última importação). A partir de **7 dias** sem importar (P-33), o aviso fica em destaque com o atalho "Importar extrato". Sem nenhuma importação, mostra "Nenhum extrato importado ainda".
*Critério:* (U) a função que monta o aviso devolve: 0 dias → "hoje"; 6 dias → aviso neutro; 7 dias → aviso de atenção; sem importação → "Nenhum extrato importado ainda". (E) o atalho leva a `/importar`. (A) o aviso não depende só de cor (texto + ícone).

### 1.10 Comprovantes lidos por IA (ADR 0016)

**RF-35 — Enviar comprovante (foto ou PDF)** (M)
Em `/importar` e em `/comprovantes`, o usuário envia um ou mais comprovantes (Pix, boleto pago, NFC-e, DANFE de NF-e ou recibo) pela câmera do celular ou por arquivo: JPG, PNG, WEBP ou PDF, até 10 MB cada (RNF-25). O arquivo vai para o bucket privado `anexos`, em `{empresa_id}/comprovantes/{comprovante_id}/{arquivo}`, e o Comprovante é criado com situação `lendo`. A leitura acontece logo em seguida (RF-36). Enquanto lê, a interface mostra o orbe `solving`.
*Critério:* (I) envio válido → 201 com `{id, situacao: 'lendo'}` e o objeto existe no caminho esperado. (I) `.exe` renomeado para `.jpg` (a assinatura de bytes não confere) ou arquivo > 10 MB → 400 e nada no Storage. (I) RLS do Storage: outra Empresa não lista nem baixa o arquivo. (E) no celular, o campo oferece a câmera (`accept="image/*,application/pdf"`).

**RF-36 — Leitura do comprovante por IA** (M)
O `LeitorDeComprovantesClaude` envia a imagem (ou o PDF) ao Claude com visão e saída estruturada validada por Zod, e extrai: tipo (`pix`, `boleto`, `nfce`, `nfe`, `recibo`, `outro`), valor total em centavos, data, nome e CPF/CNPJ do emissor ou favorecido, chave de acesso (44 dígitos, quando houver), itens (descrição, quantidade, valor) e confiança (0 a 1). A tela do comprovante mostra os dados lidos, a miniatura e o selo "Confira os dados lidos" quando a confiança for < 0,7 (P-36). Resposta inválida, timeout ou teto atingido (RNF-26) → situação `erro_de_leitura` com o botão "Tentar ler de novo"; o arquivo é mantido. O CPF/CNPJ é exibido mascarado.
*Critério:* (U) com o Leitor simulado devolvendo JSON válido → campos gravados e valor em centavos inteiros. JSON fora do schema (valor negativo, chave com 43 dígitos, tipo desconhecido) → `erro_de_leitura`. Exceção ou timeout → `erro_de_leitura` e o arquivo continua no Storage. (U) confiança 0,65 → selo "Confira os dados lidos". (U) a chave de acesso é validada pelo dígito verificador (módulo 11); inválida → gravada nula. (E) o documento aparece como `***.456.789-**` ou `12.***.***/0001-**`.

**RF-37 — Leitura do QR code da NFC-e no navegador** (S)
Ao escolher uma imagem, o navegador tenta ler o QR code com `BarcodeDetector` quando houver suporte (P-43). Se o conteúdo for a URL da SEFAZ, `extrairChaveDeAcessoDoQr` pega os primeiros 44 dígitos do parâmetro `p` e envia como `dica.chaveDeAcesso`. A chave do QR **prevalece** sobre a lida pela IA. O Rastro **não** consulta nem raspa o portal da SEFAZ. Sem suporte ou sem QR, o fluxo segue só com a IA, sem erro.
*Critério:* (U) `extrairChaveDeAcessoDoQr` com URLs de NFC-e (`?p=<chave>|2|1|...`) → a chave de 44 dígitos; com texto qualquer, `p` ausente ou chave com DV inválido → `null`. (I) dica presente e IA devolvendo outra chave → grava a da dica. (E) em navegador sem `BarcodeDetector` (simulado), o envio funciona e nenhuma requisição vai para domínio da SEFAZ.

**RF-38 — Deduplicação por chave de acesso** (M)
A chave de acesso é única por Empresa (índice único parcial, quando não nula). Enviar um comprovante cuja chave já existe não cria outro: responde 409 com "Esta nota já foi enviada em dd/mm/aaaa" e o link para o comprovante existente. O arquivo duplicado é apagado do Storage.
*Critério:* (I) enviar duas vezes a mesma NFC-e (mesma chave) → 1 Comprovante, 2ª resposta 409 com o id do existente e nenhum arquivo órfão no Storage. (I) dois envios concorrentes da mesma chave → 1 Comprovante (restrição no banco). (I) a mesma chave em outra Empresa é aceita. (I) comprovantes sem chave (ex.: Pix) não se bloqueiam entre si.

**RF-39 — Conciliação automática** (M)
Depois da leitura, o sistema procura Transações candidatas: mesma Empresa, **mesmo valor absoluto exato** (centavos), direção saída (entrada para `recibo` emitido pela própria Empresa, P-39), data em **±3 dias** da data do comprovante (P-30) e ainda sem comprovante conciliado. Com mais de um candidato, desempata pela semelhança entre o nome do emissor e a contraparte/descrição (P-44). Resultado:
- **exatamente 1** candidato → `conciliado`: o comprovante vira anexo da transação (`anexos.transacao_id`) e os itens sugerem a categoria (RF-43);
- **0** → `pendente` (o extrato daquele dia pode ainda não ter sido importado);
- **2 ou mais** após o desempate → `ambiguo`.
Comprovante sem data ou sem valor fica `pendente` e não é conciliado automaticamente. `reconciliarPendentes` roda após cada importação (RF-32) e reavalia todos os `pendente` da Empresa.
*Critério:* (U) tabela de casos com o repositório simulado: 1 candidato com o mesmo valor em D+2 → conciliado; mesmo valor em D+4 → pendente; R$ 0,01 de diferença → pendente; 2 candidatos e só um com o nome do emissor na contraparte → conciliado com ele; 2 candidatos sem desempate → ambiguo; transação que já tem comprovante → não é candidata. (I) comprovante `pendente` + importação de OFX que traz a transação → passa a `conciliado`, e `importar` devolve `comprovantesConciliados = 1`. (U) a conciliação nunca altera categoria com origem `usuario`.

**RF-40 — Conciliação manual** (M)
Para comprovantes `ambiguo` (e também `pendente`), a tela mostra os candidatos (data, descrição, contraparte, valor) e permite escolher um, ou buscar outra transação da Empresa. Escolher concilia (mesmo efeito do RF-39). Também é possível desfazer uma conciliação, voltando o comprovante a `pendente`.
*Critério:* (I) `conciliarManualmente` com transação de outra Empresa → 404 e nada muda. (I) com transação válida → `conciliado` e o anexo aparece na transação. (E) comprovante ambíguo com 2 candidatos → escolher o 2º → o extrato mostra o clipe nessa transação. (I) desfazer → `pendente`, o anexo sai da transação e o arquivo continua.

**RF-41 — Corrigir dados lidos** (M)
O usuário pode editar tipo, valor, data, emissor, documento e chave de acesso de um comprovante (`corrigirDados`). Os dados corrigidos passam pelas mesmas validações do RF-36 (a chave também pelo RF-38). Se o comprovante não estiver conciliado manualmente, a conciliação automática roda de novo. Os campos corrigidos ficam marcados como "corrigido por você" e não são sobrescritos por uma nova leitura.
*Critério:* (I) corrigir o valor de 15,00 para 150,00 quando existe uma saída de R$ 150,00 no prazo → `conciliado`. (I) corrigir para uma chave já usada → 409. (U) valor ≤ 0 ou data inválida → 400. (I) "Tentar ler de novo" depois da correção não muda os campos corrigidos.

**RF-42 — Alerta de comprovante sem transação** (M)
Um comprovante `pendente` cuja data já está coberta por uma importação (data ≤ `periodo_ate` de alguma importação da mesma Empresa) há mais de **10 dias**, contados da data dessa importação (P-32), gera o alerta "Comprovante sem transação no extrato", mostrado no painel e em `/comprovantes`, com filtro próprio. O alerta some quando o comprovante é conciliado ou removido.
*Critério:* (U) comprovante de 01/10, importação cobrindo até 05/10 feita em 05/10: em 15/10 → sem alerta; em 16/10 → alerta. Sem importação que cubra a data → sem alerta (só "pendente"). (E) o filtro "Sem transação" lista só os alertados.

**RF-43 — Sugestão de categoria pelos itens** (S)
Quando um comprovante é conciliado e a transação **não** tem categoria de origem `usuario`, as descrições dos itens (mascaradas, RNF-20) e o emissor enriquecem a categorização: primeiro as Regras são avaliadas também contra o texto dos itens; se nenhuma casar, o Classificador recebe descrição, contraparte, valor, direção **e** até 20 descrições de itens. O resultado segue o RF-20 (origem `ia` ou `regra`, confiança mínima 0,6). Centro de custo só por Regra ou pelo usuário (P-12).
*Critério:* (U) transação "PAG*LOJA 123" sem categoria + itens "Gás R410A 1 kg" e "Tubo de cobre" → o Classificador simulado recebe os itens e a categoria sugerida é gravada com origem `ia`. (U) transação com origem `usuario` → o Classificador não é chamado. (U) a regra "R410A" → Materiais e peças casa pelo texto dos itens.

**RF-44 — Tela de comprovantes** (M)
`/comprovantes` lista os comprovantes da Empresa (mais recentes primeiro), com miniatura, tipo, valor, data, emissor, situação (`lendo`, `conciliado`, `pendente`, `ambiguo`, `erro_de_leitura`) e alerta (RF-42), com filtro por situação. Permite abrir (URL assinada de 60 s), corrigir (RF-41), conciliar (RF-40) e remover (apaga o Comprovante e o arquivo; se estava conciliado, o anexo sai da transação).
*Critério:* (I) o filtro `situacao=ambiguo` devolve só os ambíguos. (I) remover → linha e objeto do Storage apagados; a transação continua. (A) a situação é indicada por texto, não só por cor.

### 1.11 Modo sem Open Finance

**RF-45 — Recurso Open Finance desligado por flag** (M)
A variável `RECURSO_OPEN_FINANCE` (padrão `false`) liga os RF-05 a RF-13, RF-29 e RF-30. Desligada: `/api/webhooks/pluggy` responde 404 (sem ler o corpo), o cron não chama a Pluggy, `/conexoes-bancarias` responde 404, a navegação mostra "Importar" e "Comprovantes" no lugar de "Conexões bancárias", e as variáveis `PLUGGY_*` não são exigidas na inicialização. O código e os testes da Pluggy continuam no repositório.
*Critério:* (I) flag ausente ou `false` → `POST /api/webhooks/pluggy` com o Bearer correto → 404; o cron executa sem nenhuma chamada ao `ProvedorBancario` simulado; o app sobe sem `PLUGGY_CLIENT_ID`. (E) o menu não tem "Conectar banco". (I) flag `true` → os testes dos RF-05 a RF-13 passam como antes.

---

## 2. Requisitos não funcionais

### 2.1 Segurança e privacidade

**RNF-01 — RLS em todas as tabelas** (M)
Todas as tabelas do schema `public` têm RLS ativado, com políticas que filtram por `empresa_id` da Empresa do usuário autenticado (tabela de vínculo usuário–empresa).
*Critério:* (I) consulta de verificação: nenhuma tabela em `public` com `relrowsecurity = false`. (I) um usuário B, de outra Empresa, não lê, altera nem apaga nada da Empresa A em nenhuma tabela.

**RNF-02 — Segredos apenas no servidor** (M)
`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET` (exigidos só com `RECURSO_OPEN_FINANCE=true`), `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `EMAIL_AUTORIZADO` nunca usam o prefixo `NEXT_PUBLIC_` e só são lidos em módulos de servidor (`import "server-only"`).
*Critério:* (A) o build de produção é inspecionado (grep no `.next/static`) e nenhum valor ou nome dessas variáveis aparece. (A) o lint barra `process.env.<segredo>` em componentes de cliente.

**RNF-03 — Cabeçalhos de segurança e CSP** (M)
Respostas com `Content-Security-Policy` (com `script-src` por nonce, `frame-ancestors 'none'` e `connect-src`/`frame-src` só para o próprio domínio, Supabase e os domínios exigidos pelo Pluggy Connect), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` restritiva.
*Critério:* (I/E) a resposta de `/painel` contém os 5 cabeçalhos. (E) o Pluggy Connect abre sem violações de CSP no console.

**RNF-04 — Limite de requisições** (M)
Limites por IP e por usuário: pedido de link mágico (5 por 15 min por IP), criação de Connect Token (10 por hora), "Sincronizar agora" (RF-30), upload de anexo (30 por hora), importação de extrato (20 por hora), envio de comprovante (30 por hora) e webhook (300 por minuto). Excedido → 429 com `Retry-After`.
*Critério:* (I) a 6ª solicitação de link em 15 min → 429. (I) o 31º comprovante na mesma hora → 429.

**RNF-05 — Validação de entrada com Zod** (M)
Todo corpo, *query string* e payload de webhook é validado por um schema Zod antes do uso. Erros de validação → 400 com mensagem genérica em português.
*Critério:* (U) cada rota tem teste com entrada malformada → 400. (A/N) nenhuma rota lê `request.json()` sem `schema.parse`/`safeParse` (revisão de código do QA).

**RNF-06 — Logs sem dados sensíveis** (M)
Os logs registram tipo de evento, ids técnicos e status HTTP. Nunca registram descrição, valor, contraparte, e-mail, tokens, headers `Authorization` ou o corpo das respostas da Pluggy e da Anthropic.
*Critério:* (U) o logger tem uma lista de campos proibidos que são mascarados. (I) o teste de integração do webhook captura os logs e não encontra valor, descrição nem o segredo.

**RNF-07 — Anexos privados** (M)
O bucket `anexos` é privado e tem políticas de Storage por `empresa_id`. Acesso só por URL assinada (RF-28).
*Critério:* ver RF-28. (I) o bucket tem `public = false`.

**RNF-20 — Minimização de dados para a IA (LGPD)** (M)
Só os campos do RF-20 são enviados ao provedor de IA. Sequências que parecem CPF/CNPJ e chaves Pix (e-mail ou telefone) são mascaradas.
*Critério:* (U) um texto com "PIX 123.456.789-00" é enviado como "PIX ***".

**RNF-21 — Nenhum segredo versionado** (M)
O `.gitignore` cobre `.env*` (exceto `.env.example`). O gitleaks roda no pre-commit e no CI.
*Critério:* (A) o gitleaks no histórico completo dá 0 achados. O CI falha se houver achado.

### 2.2 Usabilidade e acessibilidade

**RNF-08 — Acessibilidade (axe)** (M)
Nenhuma violação `critical` ou `serious` do axe-core nas páginas `/entrar`, `/painel`, `/extrato`, `/categorias`, `/centros-de-custo`, `/importar` e `/comprovantes` (e `/conexoes-bancarias` quando `RECURSO_OPEN_FINANCE=true`), nos modos claro e escuro. Contraste WCAG 2.2 AA.
*Critério:* (A) teste Playwright + axe em cada página e modo → 0 violações graves.

**RNF-09 — Navegação por teclado** (M)
Toda funcionalidade é acessível só pelo teclado, com foco visível, ordem lógica, "Pular para o conteúdo", modais com foco preso e Esc para fechar. Os gráficos têm alternativa em tabela.
*Critério:* (E) roteiro Playwright: login → filtrar o extrato → recategorizar → criar a regra, usando só o teclado.

**RNF-17 — Estados de interface** (M)
Toda tela e bloco que carrega dados tem os estados carregando, vazio, erro (com ação de tentar de novo) e sucesso.
*Critério:* (E/N) para cada página há um teste ou story que força os 4 estados.

**RNF-15 — thinking-orbs em todo carregamento** (M)
Todo estado de carregamento usa o componente único `<Carregando contexto="…"/>` (thinking-orbs 0.3.1), com o mapeamento conectando→`connecting`, sincronizando→`searching`, categorizando→`solving`, painel→`weaving`, genérico→`working`, ocioso→`breathing`; `size` 64 em bloco e 20 inline; `theme="auto"`; `aria-label` em português.
*Critério:* (U) o mapa contexto→estado está coberto por teste. (A) lint ou grep: nenhum outro spinner ou skeleton no código. (A) todo `<Carregando>` renderiza com `aria-label` não vazio.

**RNF-14 — Modo claro e escuro** (M)
Segue `prefers-color-scheme` por padrão, com alternância manual guardada no navegador. Tokens de cor nas duas variações com contraste AA.
*Critério:* (E) alternar o tema muda os tokens, e a escolha persiste ao recarregar. RNF-08 é aprovado nos dois temas.

**RNF-11 — Responsividade** (M)
Mobile-first, sem rolagem horizontal da página em 360, 768, 1024 e 1440 px. No celular, o extrato vira lista de cartões e os filtros ficam numa folha deslizante.
*Critério:* (E) Playwright em 360 px: `document.documentElement.scrollWidth <= 360` em todas as páginas.

**RNF-12 — Localização** (M)
Textos em português do Brasil. Moeda `pt-BR` (R$ 1.234,56) com algarismos tabulares. Datas `dd/mm/aaaa` no fuso **America/Araguaina** em toda exibição e agregação.
*Critério:* (U) `formatarMoeda(-1234.56)` → "-R$ 1.234,56". `formatarData` de `2026-02-01T02:30:00Z` → "31/01/2026".

### 2.3 Desempenho e confiabilidade

**RNF-10 — Lighthouse** (M)
Nota ≥ 90 em Performance, Acessibilidade e Boas práticas (perfil mobile) nas páginas principais.
*Critério:* (A) o Lighthouse CI com essas asserções passa no pipeline.

**RNF-19 — Resiliência da sincronização** (M)
Falha da IA, do Storage ou de uma página da Pluggy não perde transações já obtidas e deixa o evento com estado `falhou`, que pode ser recuperado (RF-30). Chamadas à Pluggy e à Anthropic têm timeout e até 2 novas tentativas com espera crescente em 429/5xx.
*Critério:* (I) a Pluggy simulada devolve 503 uma vez e depois 200 → sincronização concluída. A IA simulada falha sempre → transações gravadas sem categoria.

**RNF-22 — Idempotência** (M)
Reprocessar qualquer evento ou repetir a sincronização não duplica transações (chave única `empresa_id` + id externo) nem altera dados do usuário.
*Critério:* (I) sincronizar o mesmo item 3 vezes → mesma contagem de transações e mesmas categorias.

**RNF-23 — Teto de custo da IA** (S)
Limite configurável de classificações por mês (`IA_LIMITE_MENSAL`, padrão 2.000). Ao atingir, novas transações ficam "Sem categoria" e o painel mostra um aviso.
*Critério:* (U) com limite 2 e 3 transações → a 3ª não chama o Classificador.

### 2.4 Arquitetura e manutenção

**RNF-13 — Pronto para multiempresa** (M)
Todas as tabelas de negócio têm `empresa_id` não nulo com chave estrangeira, índice e RLS (RNF-01). O usuário é ligado à Empresa por uma tabela de vínculo. Nenhuma consulta de negócio fica sem escopo de Empresa. Funcionalidades futuras ficam atrás de *feature flags* simples.
*Critério:* (I) consulta ao catálogo: toda tabela de negócio tem a coluna `empresa_id NOT NULL` e um índice que começa por ela. Teste de RLS com 2 Empresas (RNF-01).

**RNF-18 — Desacoplamento de provedores** (M)
A Pluggy só é acessada pela interface `ProvedorBancario`, o OFX só pelo `LeitorDeExtrato` e a IA só pelas interfaces `Classificador` e `LeitorDeComprovantes`. A interface do usuário não chama a Pluggy nem o banco diretamente (só por módulos de `regras-de-negocio` e `acesso-a-dados`).
*Critério:* (A) regra de lint ou dependency-cruiser: só `regras-de-negocio/conexao-bancaria/` importa `pluggy-sdk`, só `regras-de-negocio/categorizacao/` e `regras-de-negocio/comprovantes/` importam `@anthropic-ai/sdk`, e `src/componentes` e `src/app/**/page.tsx` não importam o cliente Supabase de serviço.

**RNF-16 — Cobertura de testes** (M)
Cobertura ≥ 80% de linhas **e** de ramos em `src/regras-de-negocio/` (Vitest + v8).
*Critério:* (A) `vitest --coverage` com *thresholds* de 80 para esse diretório. O CI falha se ficar abaixo.

### 2.5 Importação e comprovantes (ADR 0016)

**RNF-24 — Minimização dos comprovantes enviados à IA (LGPD)** (M)
Antes do envio ao provedor de IA, imagens são redimensionadas no navegador para no máximo **2576 px** no lado maior e reencodadas (JPEG ou WEBP), o que **remove os metadados EXIF** (incluindo GPS) (P-34). Vai à IA só o arquivo e as instruções de extração. Nenhum dado da transação, da conta, do usuário ou da Empresa é enviado junto. O conteúdo extraído (valor, emissor, documento, itens) nunca aparece em log (RNF-06). A interface exibe CPF/CNPJ mascarados.
*Critério:* (U) a função de preparo da imagem recebe uma foto 4000×3000 com EXIF de GPS e devolve ≤ 2576 px no lado maior e sem EXIF. (U) o payload montado pelo `LeitorDeComprovantesClaude` contém só o bloco do arquivo e o texto fixo de instruções (sem `empresa_id`, `conta_id`, e-mail). (I) o teste de integração do envio captura os logs e não encontra o valor nem o emissor.

**RNF-25 — Limites e validação de arquivos** (M)
Comprovante: JPG, PNG, WEBP ou PDF, até **10 MB**, PDF com até **5 páginas** (P-31). Extrato: `.ofx` até **5 MB**. O tipo é confirmado pela assinatura de bytes (não só pela extensão ou pelo `Content-Type`). O OFX é tratado como texto não confiável: o leitor não resolve entidades externas nem executa nada do arquivo.
*Critério:* (I) PDF de 6 páginas → 400 "PDF com mais de 5 páginas". (I) OFX de 6 MB → 413/400. (U) arquivo PNG com extensão `.pdf` → recusado. (U) OFX 2.x com `<!DOCTYPE` e entidade externa → `arquivo_invalido`, sem acesso a rede ou disco.

**RNF-26 — Teto de custo da leitura de comprovantes** (S)
Limite configurável de leituras por mês (`IA_LIMITE_COMPROVANTES_MES`, padrão **300**, P-35), separado do `IA_LIMITE_MENSAL` das classificações (RNF-23). Ao atingir, novos comprovantes ficam em `erro_de_leitura` com a mensagem "Limite mensal de leituras atingido" e podem ser lidos de novo no mês seguinte ou corrigidos à mão. "Tentar ler de novo" também conta para o teto. Custo estimado por leitura: ~US$ 0,04 com Opus 5.5 (viabilidade §3.4).
*Critério:* (U) com limite 2 e 3 envios → o 3º não chama o Leitor e fica `erro_de_leitura` com o motivo `limite`. (U) o contador zera na virada do mês no fuso America/Araguaina.

**RNF-27 — Tempo e resiliência da leitura** (M)
A leitura de um comprovante tem timeout de **60 s** e até 2 novas tentativas em 429/5xx (como o RNF-19). Falha da IA nunca perde o arquivo nem bloqueia a importação de extrato. A importação de um OFX com até 1.000 lançamentos termina em ≤ 10 s (sem contar a categorização por IA, que roda depois da gravação).
*Critério:* (I) IA simulada devolve 529 uma vez e depois 200 → comprovante lido. IA sempre falha → `erro_de_leitura` e arquivo no Storage. (I) fixture OFX com 1.000 lançamentos e Classificador simulado lento → as transações ficam gravadas em ≤ 10 s.

**RNF-28 — Robustez do leitor de OFX** (M)
O `OfxSicredi` aceita OFX 1.x (SGML, tags sem fechamento) e 2.x (XML), codificação `USASCII`/`ISO-8859-1`/`UTF-8` conforme o cabeçalho (com acentos preservados), datas `AAAAMMDD[HHMMSS[.XXX]][-3:BRT]` e valores com ponto **ou** vírgula decimal. Cada variação real encontrada vira uma fixture anonimizada no repositório de testes.
*Critério:* (U) suíte de fixtures cobrindo SGML, XML, Latin-1, data com e sem fuso e vírgula decimal → todas lidas com o mesmo resultado esperado. (U) `MEMO` "PAGAMENTO PIX JOSÉ" em Latin-1 → "PAGAMENTO PIX JOSÉ" em UTF-8.

---

## 3. Índice

| Id | Título |
|---|---|
| RF-01 | Login por link mágico |
| RF-02 | Restrição ao EMAIL_AUTORIZADO |
| RF-03 | Proteção de rotas e saída |
| RF-04 | Animação de abertura |
| RF-05 | Conectar banco pelo Pluggy Connect *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-06 | Validar e registrar a Conexão *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-07 | Status da Conexão visível *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-08 | Reconectar quando o consentimento expira *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-09 | Webhook autenticado *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-10 | Deduplicação por eventId *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-11 | Resposta rápida e processamento posterior *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-12 | Eventos de item *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-13 | Eventos de transação *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-14 | Mapeamento Pluggy → Transação |
| RF-15 | Nunca sobrescrever a categoria do usuário |
| RF-16 | Listar o extrato |
| RF-17 | Busca |
| RF-18 | Filtros |
| RF-19 | Categorização por regras |
| RF-20 | Categorização por IA |
| RF-21 | Correção vira Regra |
| RF-22 | Gerenciar Categorias e Regras |
| RF-23 | Centros de custo e atribuição |
| RF-24 | Entradas x saídas por mês |
| RF-25 | Gastos por categoria |
| RF-26 | Resultado por centro de custo |
| RF-27 | Saldo atual |
| RF-28 | Anexos opcionais |
| RF-29 | Registrar o webhook na Pluggy *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-30 | Sincronizar agora *(cond. `RECURSO_OPEN_FINANCE`)* |
| RF-31 | Importar extrato OFX do Sicredi |
| RF-32 | Reimportação idempotente e categorização das novas |
| RF-33 | Histórico de importações |
| RF-34 | Aviso de extrato desatualizado |
| RF-35 | Enviar comprovante (foto ou PDF) |
| RF-36 | Leitura do comprovante por IA |
| RF-37 | Leitura do QR code da NFC-e no navegador |
| RF-38 | Deduplicação por chave de acesso |
| RF-39 | Conciliação automática |
| RF-40 | Conciliação manual |
| RF-41 | Corrigir dados lidos |
| RF-42 | Alerta de comprovante sem transação |
| RF-43 | Sugestão de categoria pelos itens |
| RF-44 | Tela de comprovantes |
| RF-45 | Recurso Open Finance desligado por flag |
| RNF-01 | RLS em todas as tabelas |
| RNF-02 | Segredos apenas no servidor |
| RNF-03 | Cabeçalhos de segurança e CSP |
| RNF-04 | Limite de requisições |
| RNF-05 | Validação de entrada com Zod |
| RNF-06 | Logs sem dados sensíveis |
| RNF-07 | Anexos privados |
| RNF-08 | Acessibilidade (axe) |
| RNF-09 | Navegação por teclado |
| RNF-10 | Lighthouse ≥ 90 |
| RNF-11 | Responsividade |
| RNF-12 | Localização pt-BR / America/Araguaina |
| RNF-13 | Pronto para multiempresa |
| RNF-14 | Modo claro e escuro |
| RNF-15 | thinking-orbs em todo carregamento |
| RNF-16 | Cobertura de testes ≥ 80% |
| RNF-17 | Estados de interface |
| RNF-18 | Desacoplamento de provedores |
| RNF-19 | Resiliência da sincronização |
| RNF-20 | Minimização de dados para a IA |
| RNF-21 | Nenhum segredo versionado |
| RNF-22 | Idempotência |
| RNF-23 | Teto de custo da IA |
| RNF-24 | Minimização dos comprovantes enviados à IA |
| RNF-25 | Limites e validação de arquivos |
| RNF-26 | Teto de custo da leitura de comprovantes |
| RNF-27 | Tempo e resiliência da leitura |
| RNF-28 | Robustez do leitor de OFX |
