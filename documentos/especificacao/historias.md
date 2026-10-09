# Histórias de usuário — Rastro v1

Persona única: **Davi, dono da HOMETEC SERVIÇOS** (serviços de ar-condicionado/refrigeração, elétrica e prevenção contra incêndio). Usa o Rastro no computador e no celular.

---

## HU-01 — Entrar com link mágico
**Como** Davi (dono da HOMETEC), **quero** entrar no Rastro só com meu e-mail, **para** acessar meus dados financeiros sem decorar senha e sem que outra pessoa entre.
**RFs:** RF-01, RF-02, RF-03 · **RNFs:** RNF-04

- **Dado** que estou em `/entrar` **quando** informo o e-mail igual ao `EMAIL_AUTORIZADO` **então** vejo "Enviamos um link para seu e-mail" e recebo o link.
- **Dado** que recebi o link **quando** clico nele **então** entro direto no painel.
- **Dado** que alguém informa outro e-mail **quando** envia o formulário **então** vê a mesma mensagem genérica, mas nenhum e-mail é enviado e nenhuma sessão é criada.
- **Dado** que não estou logado **quando** abro `/extrato` **então** sou levado para `/entrar`.
- **Dado** que estou logado **quando** clico em "Sair" **então** volto para `/entrar` e não vejo mais dados.
- **Dado** que pedi o link 5 vezes em 15 minutos **quando** peço a 6ª **então** vejo "Muitas tentativas. Tente de novo em alguns minutos."

## HU-02 — Abertura com a logo
**Como** Davi, **quero** ver a logo do Rastro se desenhando ao abrir o sistema, **para** sentir que é um produto com identidade, sem perder tempo.
**RFs:** RF-04 · **RNFs:** RNF-10, RNF-09

- **Dado** que é minha primeira visita na sessão **quando** o app abre **então** a logo se desenha e deixa um rastro de luz que se dissolve em até 2,5 s.
- **Dado** que a abertura está rodando **quando** aperto "Pular" (ou Enter) **então** ela some na hora.
- **Dado** que já vi a abertura nesta sessão **quando** navego ou recarrego **então** ela não aparece de novo.
- **Dado** que meu sistema pede movimento reduzido **quando** o app abre **então** vejo só um fade curto.

## HU-03 — Conectar a conta PJ do Sicredi
**Como** Davi, **quero** conectar a conta PJ do Sicredi pelo Open Finance, **para** que o extrato chegue sozinho, sem eu mandar comprovantes.
**RFs:** RF-05, RF-06, RF-07 · **RNFs:** RNF-02, RNF-15

- **Dado** que estou em "Conexões bancárias" sem conexão **quando** clico em "Conectar banco" **então** o widget da Pluggy abre e um orbe `connecting` aparece enquanto carrega.
- **Dado** que autorizei no app do Sicredi **quando** o widget termina **então** a conexão aparece com o status "Conectado" (ou "Sincronizando") e o nome do banco.
- **Dado** que alguém envia um `itemId` que não é da aplicação **quando** o servidor valida **então** recebe "Conexão não encontrada" e nada é salvo.
- **Dado** que a Pluggy está fora do ar **quando** clico em "Conectar banco" **então** vejo "Não foi possível iniciar a conexão com o banco" e um botão para tentar de novo.

## HU-04 — Reconectar quando o consentimento expira
**Como** Davi, **quero** ser avisado e reconectar com um clique quando a autorização do banco expirar, **para** não ficar com o extrato parado sem perceber.
**RFs:** RF-07, RF-08

- **Dado** que a conexão está com erro de login ou consentimento expirado **quando** abro qualquer tela **então** vejo um aviso no cabeçalho "Seu banco precisa ser reconectado" com link para a tela de conexões.
- **Dado** que o consentimento expira em até 7 dias **quando** abro a tela de conexões **então** vejo "Expira em dd/mm/aaaa" e o botão "Reconectar".
- **Dado** que cliquei em "Reconectar" e autorizei de novo **quando** o widget termina **então** a mesma conexão volta para "Conectado", sem criar uma conexão duplicada.

## HU-05 — Transações chegando sozinhas
**Como** Davi, **quero** que cada movimentação da conta apareça no Rastro automaticamente, **para** ter o extrato sempre em dia sem fazer nada.
**RFs:** RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-29 · **RNFs:** RNF-19, RNF-22, RNF-06

- **Dado** que a Pluggy envia `transactions/created` com o header secreto **quando** o webhook recebe **então** responde em menos de 10 s e as novas transações aparecem no extrato logo depois.
- **Dado** que a Pluggy reenvia o mesmo `eventId` **quando** o webhook recebe **então** responde 200 e as transações não são duplicadas.
- **Dado** que alguém chama o webhook sem o header correto **quando** o servidor recebe **então** responde 401 e nada é processado.
- **Dado** que um pagamento foi um débito **quando** ele é gravado **então** o valor fica negativo e a contraparte é quem recebeu.
- **Dado** que corrigi a categoria de uma transação **quando** a Pluggy envia `transactions/updated` para ela **então** a descrição ou o valor são atualizados, mas minha categoria e meu centro de custo continuam.
- **Dado** que a Pluggy envia `transactions/deleted` **quando** o evento é processado **então** as transações somem do extrato e do painel.

## HU-06 — Consultar e filtrar o extrato
**Como** Davi, **quero** buscar e filtrar minhas transações, **para** achar rapidamente um pagamento ou ver quanto gastei num serviço.
**RFs:** RF-16, RF-17, RF-18 · **RNFs:** RNF-11, RNF-12, RNF-17

- **Dado** que estou no extrato **quando** a página abre **então** vejo as transações do mês atual, da mais recente para a mais antiga, com data, descrição, quem pagou ou recebeu, valor em R$, categoria e centro de custo.
- **Dado** que digito "posto" na busca **quando** paro de digitar **então** só aparecem as transações com "posto" na descrição ou na contraparte, ignorando acentos e maiúsculas.
- **Dado** que escolho "Saídas", "Combustível" e "Mês passado" **quando** aplico **então** só aparecem as saídas de combustível do mês passado, e o endereço da página guarda esses filtros.
- **Dado** que não há transações no filtro **quando** a lista carrega **então** vejo uma mensagem de vazio com o botão "Limpar filtros".
- **Dado** que estou no celular **quando** abro o extrato **então** vejo cartões legíveis, sem rolagem lateral.

## HU-07 — Categorização automática
**Como** Davi, **quero** que cada transação já chegue com uma categoria, **para** não ter que classificar tudo na mão.
**RFs:** RF-19, RF-20 · **RNFs:** RNF-20, RNF-23, RNF-19

- **Dado** que existe a regra "POSTO" → Combustível **quando** chega "POSTO SHELL 123" **então** ela fica como Combustível, sem chamar a IA.
- **Dado** que nenhuma regra casa **quando** a transação chega **então** a IA sugere uma categoria da minha lista e o extrato mostra o selo "sugerida pela IA".
- **Dado** que a IA está indisponível **quando** a transação chega **então** ela aparece no extrato como "Sem categoria" e nada se perde.
- **Dado** que a descrição contém um CPF **quando** a transação vai para a IA **então** o CPF é mascarado antes do envio.

## HU-08 — Corrigir a categoria e ensinar o Rastro
**Como** Davi, **quero** corrigir uma categoria errada e transformar a correção em regra, **para** que o erro não se repita.
**RFs:** RF-21, RF-15, RF-19

- **Dado** que uma transação "POSTO X" está como "Outros" **quando** mudo para "Combustível" **então** ela é salva como minha escolha e vejo a oferta "Criar regra para transações parecidas?".
- **Dado** que aceitei a oferta com a condição "POSTO X" **quando** chega uma nova transação "POSTO X" **então** ela já vem como Combustível.
- **Dado** que marquei "aplicar também às existentes" **quando** confirmo **então** as transações antigas que casam são recategorizadas, exceto as que eu já tinha corrigido manualmente.
- **Dado** que recuso a oferta **quando** fecho o aviso **então** só aquela transação muda.

## HU-09 — Atribuir centro de custo
**Como** Davi, **quero** marcar cada entrada e saída com o tipo de serviço (Ar-condicionado/Refrigeração, Elétrica, Prevenção contra incêndio ou Administrativo), **para** saber qual serviço dá lucro.
**RFs:** RF-23, RF-21

- **Dado** que é minha primeira vez **quando** abro "Centros de custo" **então** já vejo os 4 centros cadastrados.
- **Dado** que seleciono 3 transações no extrato **quando** escolho "Elétrica" **então** as 3 passam a ser de Elétrica.
- **Dado** que crio uma regra "CONDOMÍNIO ALFA" → centro "Ar-condicionado/Refrigeração" **quando** chega uma entrada desse cliente **então** ela já vem com esse centro.

## HU-10 — Ver o painel
**Como** Davi, **quero** um painel com entradas x saídas, gastos por categoria, resultado por serviço e saldo, **para** decidir com base em números e não em achismo.
**RFs:** RF-24, RF-25, RF-26, RF-27 · **RNFs:** RNF-08, RNF-10, RNF-14, RNF-15

- **Dado** que tenho transações de vários meses **quando** abro o painel **então** vejo as barras de entradas e saídas dos últimos 12 meses com o resultado de cada mês, e um orbe `weaving` enquanto o painel é gerado.
- **Dado** que escolho o período "Este mês" **quando** o painel atualiza **então** os gastos por categoria somam o total de saídas do mês.
- **Dado** que atribuí centros de custo **quando** vejo "Resultado por centro de custo" **então** vejo entradas, saídas e lucro de cada serviço, com o mais lucrativo destacado.
- **Dado** que há transações sem centro de custo **quando** clico em "Classificar" **então** vou para o extrato já filtrado nelas.
- **Dado** que a última sincronização trouxe o saldo **quando** abro o painel **então** vejo o saldo atual em R$ e quando ele foi lido.
- **Dado** que recategorizei uma transação **quando** volto ao painel **então** os totais já refletem a mudança.

## HU-11 — Anexar nota fiscal quando precisar
**Como** Davi, **quero** anexar a nota ou o comprovante a uma transação só quando o contador pedir, **para** não ter trabalho à toa e ainda ter o documento guardado.
**RFs:** RF-28 · **RNFs:** RNF-07

- **Dado** que abro uma transação **quando** anexo um PDF de 2 MB **então** o anexo aparece na lista e o extrato mostra o ícone de clipe.
- **Dado** que tento anexar um arquivo de 15 MB ou um `.exe` **quando** envio **então** vejo "Arquivo não permitido (PDF, JPG, PNG ou WEBP de até 10 MB)".
- **Dado** que clico para ver o anexo **quando** ele abre **então** é servido por um link temporário, e o link copiado deixa de funcionar depois de 1 minuto.
- **Dado** que removo o anexo **quando** confirmo **então** ele sai da transação e do armazenamento.

## HU-12 — Forçar uma sincronização
**Como** Davi, **quero** um botão "Sincronizar agora", **para** recuperar transações que não chegaram se algum aviso da Pluggy falhar.
**RFs:** RF-30, RF-12 · **RNFs:** RNF-04, RNF-19

- **Dado** que a conexão está ativa **quando** clico em "Sincronizar agora" **então** vejo o orbe `searching` e, ao fim, "X transações atualizadas".
- **Dado** que sincronizei há 2 minutos **quando** clico de novo **então** vejo "Aguarde alguns minutos para sincronizar de novo".

## HU-13 — Organizar categorias e regras
**Como** Davi, **quero** criar, renomear e arquivar categorias e reordenar regras, **para** que a classificação reflita como eu enxergo meu negócio.
**RFs:** RF-22, RF-19

- **Dado** que estou em "Categorias" **quando** crio "Uniformes" **então** ela passa a aparecer nas opções do extrato e na lista enviada à IA.
- **Dado** que tento criar uma categoria com nome já existente **quando** salvo **então** vejo "Já existe uma categoria com esse nome".
- **Dado** que arquivo uma categoria em uso **quando** confirmo **então** ela some das opções novas, mas as transações antigas continuam com ela.
- **Dado** que duas regras casam com a mesma transação **quando** subo uma delas na lista **então** a próxima classificação usa a de cima.

## HU-14 — Colocar em produção com segurança
**Como** Davi, **quero** que o webhook seja registrado com um segredo e que nenhuma credencial fique exposta, **para** que ninguém injete transações falsas nem acesse minha conta na Pluggy.
**RFs:** RF-29, RF-09 · **RNFs:** RNF-02, RNF-03, RNF-21, RNF-06

- **Dado** que tenho a URL de produção **quando** rodo `npm run registrar-webhook -- https://…/api/webhooks/pluggy` **então** os webhooks são criados ou atualizados com o header secreto, sem duplicar.
- **Dado** que informei uma URL `http://` **quando** rodo o script **então** ele recusa com uma mensagem clara.
- **Dado** que o app está publicado **quando** inspeciono o código enviado ao navegador **então** não encontro Client Secret, chave da Anthropic nem `service_role`.
- **Dado** que alguém tenta commitar um `.env` **quando** o pre-commit roda **então** o commit é bloqueado.

---

## Rastreabilidade história → requisito

| HU | RFs | RNFs principais |
|---|---|---|
| HU-01 | RF-01, RF-02, RF-03 | RNF-04 |
| HU-02 | RF-04 | RNF-09, RNF-10 |
| HU-03 | RF-05, RF-06, RF-07 | RNF-02, RNF-15 |
| HU-04 | RF-07, RF-08 | — |
| HU-05 | RF-09 a RF-15, RF-29 | RNF-06, RNF-19, RNF-22 |
| HU-06 | RF-16, RF-17, RF-18 | RNF-11, RNF-12, RNF-17 |
| HU-07 | RF-19, RF-20 | RNF-19, RNF-20, RNF-23 |
| HU-08 | RF-15, RF-19, RF-21 | — |
| HU-09 | RF-21, RF-23 | — |
| HU-10 | RF-24, RF-25, RF-26, RF-27 | RNF-08, RNF-10, RNF-14, RNF-15 |
| HU-11 | RF-28 | RNF-07 |
| HU-12 | RF-12, RF-30 | RNF-04, RNF-19 |
| HU-13 | RF-19, RF-22 | — |
| HU-14 | RF-09, RF-29 | RNF-02, RNF-03, RNF-06, RNF-21 |

RNFs transversais sem história própria (verificados em todas): RNF-01, RNF-05, RNF-13, RNF-16, RNF-18.
