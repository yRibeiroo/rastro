# Histórias de usuário — Rastro v1

Persona única: **Davi, dono da HOMETEC SERVIÇOS** (serviços de ar-condicionado/refrigeração, elétrica e prevenção contra incêndio). Usa o Rastro no computador e no celular. Na v1 ele importa o extrato OFX do Sicredi (semanal ou mensalmente) e fotografa comprovantes quando quiser (ADR 0016).

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
> **Condicionada a `RECURSO_OPEN_FINANCE` (desligado na v1).** Vale só com a flag ligada (RF-45). Na v1, o equivalente é a HU-15 / HU-16.
**Como** Davi, **quero** conectar a conta PJ do Sicredi pelo Open Finance, **para** que o extrato chegue sozinho, sem eu mandar comprovantes.
**RFs:** RF-05, RF-06, RF-07 · **RNFs:** RNF-02, RNF-15

- **Dado** que estou em "Conexões bancárias" sem conexão **quando** clico em "Conectar banco" **então** o widget da Pluggy abre e um orbe `connecting` aparece enquanto carrega.
- **Dado** que autorizei no app do Sicredi **quando** o widget termina **então** a conexão aparece com o status "Conectado" (ou "Sincronizando") e o nome do banco.
- **Dado** que alguém envia um `itemId` que não é da aplicação **quando** o servidor valida **então** recebe "Conexão não encontrada" e nada é salvo.
- **Dado** que a Pluggy está fora do ar **quando** clico em "Conectar banco" **então** vejo "Não foi possível iniciar a conexão com o banco" e um botão para tentar de novo.

## HU-04 — Reconectar quando o consentimento expira
> **Condicionada a `RECURSO_OPEN_FINANCE` (desligado na v1).** Vale só com a flag ligada (RF-45). Na v1, o equivalente é a HU-15 / HU-16.
**Como** Davi, **quero** ser avisado e reconectar com um clique quando a autorização do banco expirar, **para** não ficar com o extrato parado sem perceber.
**RFs:** RF-07, RF-08

- **Dado** que a conexão está com erro de login ou consentimento expirado **quando** abro qualquer tela **então** vejo um aviso no cabeçalho "Seu banco precisa ser reconectado" com link para a tela de conexões.
- **Dado** que o consentimento expira em até 7 dias **quando** abro a tela de conexões **então** vejo "Expira em dd/mm/aaaa" e o botão "Reconectar".
- **Dado** que cliquei em "Reconectar" e autorizei de novo **quando** o widget termina **então** a mesma conexão volta para "Conectado", sem criar uma conexão duplicada.

## HU-05 — Transações chegando sozinhas
> **Condicionada a `RECURSO_OPEN_FINANCE` (desligado na v1).** Vale só com a flag ligada (RF-45). Na v1, o equivalente é a HU-15 / HU-16.
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
- **Dado** que o último extrato importado trouxe o saldo (ou, com Open Finance ligado, a última sincronização) **quando** abro o painel **então** vejo o saldo atual em R$ e a data dele.
- **Dado** que recategorizei uma transação **quando** volto ao painel **então** os totais já refletem a mudança.

## HU-11 — Anexar nota fiscal quando precisar
**Como** Davi, **quero** anexar a nota ou o comprovante a uma transação só quando o contador pedir, **para** não ter trabalho à toa e ainda ter o documento guardado.
**RFs:** RF-28 · **RNFs:** RNF-07

- **Dado** que abro uma transação **quando** anexo um PDF de 2 MB **então** o anexo aparece na lista e o extrato mostra o ícone de clipe.
- **Dado** que tento anexar um arquivo de 15 MB ou um `.exe` **quando** envio **então** vejo "Arquivo não permitido (PDF, JPG, PNG ou WEBP de até 10 MB)".
- **Dado** que clico para ver o anexo **quando** ele abre **então** é servido por um link temporário, e o link copiado deixa de funcionar depois de 1 minuto.
- **Dado** que removo o anexo **quando** confirmo **então** ele sai da transação e do armazenamento.

## HU-12 — Forçar uma sincronização
> **Condicionada a `RECURSO_OPEN_FINANCE` (desligado na v1).** Vale só com a flag ligada (RF-45). Na v1, o equivalente é a HU-15 / HU-16.
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
> Os dois primeiros critérios (registro do webhook) são **condicionados a `RECURSO_OPEN_FINANCE`**. Os dois últimos valem sempre.
**Como** Davi, **quero** que o webhook seja registrado com um segredo e que nenhuma credencial fique exposta, **para** que ninguém injete transações falsas nem acesse minha conta na Pluggy.
**RFs:** RF-29, RF-09 · **RNFs:** RNF-02, RNF-03, RNF-21, RNF-06

- **Dado** que tenho a URL de produção **quando** rodo `npm run registrar-webhook -- https://…/api/webhooks/pluggy` **então** os webhooks são criados ou atualizados com o header secreto, sem duplicar.
- **Dado** que informei uma URL `http://` **quando** rodo o script **então** ele recusa com uma mensagem clara.
- **Dado** que o app está publicado **quando** inspeciono o código enviado ao navegador **então** não encontro Client Secret, chave da Anthropic nem `service_role`.
- **Dado** que alguém tenta commitar um `.env` **quando** o pre-commit roda **então** o commit é bloqueado.

## HU-15 — Importar o extrato do Sicredi
**Como** Davi, **quero** enviar o arquivo OFX que baixo do Sicredi Internet, **para** ter todas as movimentações da conta PJ no Rastro (inclusive tarifas, débitos automáticos e Pix recebidos) sem pagar agregador.
**RFs:** RF-31, RF-32, RF-15, RF-19, RF-20, RF-27 · **RNFs:** RNF-25, RNF-27, RNF-28, RNF-22

- **Dado** que estou em "Importar" **quando** envio o OFX do mês **então** vejo "X transações novas · período dd/mm a dd/mm · conta ••••1234" e elas aparecem no extrato já categorizadas por regra ou pela IA.
- **Dado** que é a primeira importação **quando** o arquivo é lido **então** a conta é criada mostrando só os 4 últimos dígitos e o painel passa a mostrar o saldo do extrato.
- **Dado** que já importei setembro e corrigi categorias **quando** importo de novo um arquivo de 15/09 a 15/10 **então** nada fica duplicado, só as transações de outubro entram como novas e minhas categorias e centros de custo continuam.
- **Dado** que envio um PDF ou um OFX corrompido **quando** o servidor tenta ler **então** vejo "Arquivo inválido. Envie o extrato em formato OFX exportado pelo Sicredi" e nada é gravado.
- **Dado** que o arquivo tem 6 MB **quando** envio **então** vejo que o limite é 5 MB.

## HU-16 — Saber quando importei pela última vez
**Como** Davi, **quero** ver o histórico de importações e ser lembrado quando o extrato estiver velho, **para** não tomar decisão com o painel desatualizado.
**RFs:** RF-33, RF-34 · **RNFs:** RNF-17

- **Dado** que importei 3 arquivos **quando** abro "Importar" **então** vejo os 3, do mais recente para o mais antigo, com período, conta, novas e atualizadas.
- **Dado** que a última importação foi há 8 dias **quando** abro qualquer tela **então** vejo no cabeçalho "Última importação há 8 dias" em destaque e o atalho "Importar extrato".
- **Dado** que importei hoje **quando** abro o painel **então** vejo "Última importação: hoje", sem destaque.
- **Dado** que nunca importei **quando** abro o painel **então** vejo "Nenhum extrato importado ainda" com o atalho para importar.

## HU-17 — Fotografar um comprovante e ver o que foi lido
**Como** Davi, **quero** tirar foto ou enviar o PDF de um comprovante e ver os dados que a IA leu, **para** guardar o documento sem digitar nada.
**RFs:** RF-35, RF-36, RF-37 · **RNFs:** RNF-07, RNF-24, RNF-25, RNF-26, RNF-27, RNF-15

- **Dado** que estou no celular em "Comprovantes" **quando** toco em "Enviar comprovante" **então** posso usar a câmera ou escolher um arquivo, e vejo o orbe `solving` enquanto é lido.
- **Dado** que enviei a foto de uma NFC-e **quando** a leitura termina **então** vejo tipo, valor, data, emissor (com CNPJ mascarado), chave de acesso e itens.
- **Dado** que meu navegador lê QR code **quando** escolho a foto da NFC-e **então** a chave de acesso vem do QR e vale mais que a lida pela IA, sem o Rastro acessar o site da SEFAZ.
- **Dado** que a IA leu com pouca confiança **quando** vejo o comprovante **então** aparece o selo "Confira os dados lidos".
- **Dado** que a IA falhou ou o limite do mês acabou **quando** a leitura termina **então** o comprovante fica "Erro de leitura" com "Tentar ler de novo", e o arquivo continua guardado.
- **Dado** que a foto tem localização GPS **quando** ela é enviada **então** os metadados são removidos antes de sair do navegador.

## HU-18 — Não lançar a mesma nota duas vezes
**Como** Davi, **quero** ser avisado quando enviar uma nota que já mandei, **para** não duplicar documentos nem confundir a conciliação.
**RFs:** RF-38

- **Dado** que já enviei uma NFC-e **quando** envio de novo a mesma nota (mesma chave de acesso) **então** vejo "Esta nota já foi enviada em dd/mm/aaaa" com link para ela, e nenhum comprovante novo é criado.
- **Dado** que envio dois comprovantes Pix diferentes, sem chave de acesso **quando** os dois são lidos **então** os dois são aceitos.

## HU-19 — Comprovante se liga sozinho à transação
**Como** Davi, **quero** que o comprovante seja anexado sozinho à transação certa do extrato e ajude a categorizá-la, **para** não precisar procurar e anexar na mão.
**RFs:** RF-39, RF-43, RF-32, RF-15 · **RNFs:** RNF-20

- **Dado** que existe uma saída de R$ 187,40 em 03/10 **quando** envio a NFC-e de R$ 187,40 de 02/10 **então** o comprovante fica "Conciliado" e o extrato mostra o clipe nessa transação.
- **Dado** que a transação estava sem categoria **quando** o comprovante com itens "Gás R410A" e "Tubo de cobre" é conciliado **então** ela recebe a categoria sugerida (selo "sugerida pela IA").
- **Dado** que eu mesmo tinha definido a categoria **quando** o comprovante é conciliado **então** a minha categoria continua.
- **Dado** que enviei o comprovante antes de importar o extrato daquele dia **quando** ele é lido **então** fica "Pendente" e, ao importar o OFX que traz a transação, vira "Conciliado" sozinho.
- **Dado** que o valor difere em R$ 0,01 ou a data está a 4 dias **quando** a conciliação roda **então** o comprovante não é ligado automaticamente.

## HU-20 — Escolher a transação certa quando houver dúvida
**Como** Davi, **quero** escolher a transação quando o Rastro achar mais de uma possível, **para** que o comprovante fique no lugar certo.
**RFs:** RF-40, RF-39

- **Dado** que há duas saídas de R$ 50,00 no prazo e nenhuma com o nome do emissor **quando** o comprovante é lido **então** ele fica "Ambíguo" e vejo as duas para escolher.
- **Dado** que escolho uma delas **quando** confirmo **então** o comprovante fica "Conciliado" e o clipe aparece nessa transação.
- **Dado** que um comprovante está "Pendente" **quando** busco e escolho uma transação manualmente **então** ele é conciliado com ela.
- **Dado** que conciliei errado **quando** clico em "Desfazer conciliação" **então** ele volta a "Pendente" e o anexo sai da transação.

## HU-21 — Corrigir o que a IA leu errado
**Como** Davi, **quero** corrigir valor, data ou emissor lidos errado, **para** que o comprovante concilie com a transação certa.
**RFs:** RF-41, RF-39, RF-38

- **Dado** que a IA leu R$ 15,00 numa nota de R$ 150,00 **quando** corrijo para 150,00 **então** o Rastro tenta conciliar de novo e liga à saída de R$ 150,00.
- **Dado** que corrigi o valor **quando** peço "Tentar ler de novo" **então** o valor que corrigi continua.
- **Dado** que informo uma chave de acesso já usada em outra nota **quando** salvo **então** vejo que a nota já foi enviada.

## HU-22 — Acompanhar os comprovantes e os que ficaram sem transação
**Como** Davi, **quero** uma tela com todos os comprovantes e um alerta para os que não aparecem no extrato, **para** descobrir pagamentos que não saíram da conta PJ ou que foram lidos errado.
**RFs:** RF-44, RF-42 · **RNFs:** RNF-07, RNF-17

- **Dado** que tenho comprovantes em várias situações **quando** filtro por "Ambíguo" **então** só vejo os ambíguos, com a situação escrita (não só por cor).
- **Dado** que um comprovante está pendente e o extrato que cobre a data dele foi importado há mais de 10 dias **quando** abro o painel **então** vejo o alerta "Comprovante sem transação no extrato".
- **Dado** que removo um comprovante conciliado **quando** confirmo **então** ele some, o arquivo é apagado e a transação continua no extrato sem o clipe.
- **Dado** que abro um comprovante **quando** clico em "Ver arquivo" **então** ele é servido por link temporário de 60 s.

## HU-23 — Usar o Rastro sem Open Finance
**Como** Davi, **quero** que a v1 funcione sem a Pluggy, mas com o código pronto para religar, **para** não pagar R$ 2.500/mês agora e não perder o trabalho feito.
**RFs:** RF-45, RF-03 · **RNFs:** RNF-02, RNF-18

- **Dado** que `RECURSO_OPEN_FINANCE` não está ligado **quando** abro o app **então** o menu mostra "Importar" e "Comprovantes" e não mostra "Conectar banco".
- **Dado** que a flag está desligada **quando** alguém chama `/api/webhooks/pluggy`, mesmo com o segredo correto **então** recebe 404.
- **Dado** que as variáveis `PLUGGY_*` não estão configuradas **quando** o app sobe com a flag desligada **então** ele funciona normalmente.

---

## Rastreabilidade história → requisito

| HU | RFs | RNFs principais | Situação na v1 |
|---|---|---|---|
| HU-01 | RF-01, RF-02, RF-03 | RNF-04 | ativa |
| HU-02 | RF-04 | RNF-09, RNF-10 | ativa |
| HU-03 | RF-05, RF-06, RF-07 | RNF-02, RNF-15 | **condicionada** (`RECURSO_OPEN_FINANCE`) |
| HU-04 | RF-07, RF-08 | — | **condicionada** |
| HU-05 | RF-09 a RF-15, RF-29 | RNF-06, RNF-19, RNF-22 | **condicionada** |
| HU-06 | RF-16, RF-17, RF-18 | RNF-11, RNF-12, RNF-17 | ativa |
| HU-07 | RF-19, RF-20 | RNF-19, RNF-20, RNF-23 | ativa |
| HU-08 | RF-15, RF-19, RF-21 | — | ativa |
| HU-09 | RF-21, RF-23 | — | ativa |
| HU-10 | RF-24, RF-25, RF-26, RF-27 | RNF-08, RNF-10, RNF-14, RNF-15 | ativa |
| HU-11 | RF-28 | RNF-07 | ativa |
| HU-12 | RF-12, RF-30 | RNF-04, RNF-19 | **condicionada** |
| HU-13 | RF-19, RF-22 | — | ativa |
| HU-14 | RF-09, RF-29 | RNF-02, RNF-03, RNF-06, RNF-21 | parcial (webhook condicionado) |
| HU-15 | RF-31, RF-32, RF-15, RF-19, RF-20, RF-27 | RNF-22, RNF-25, RNF-27, RNF-28 | ativa |
| HU-16 | RF-33, RF-34 | RNF-17 | ativa |
| HU-17 | RF-35, RF-36, RF-37 | RNF-07, RNF-15, RNF-24, RNF-25, RNF-26, RNF-27 | ativa |
| HU-18 | RF-38 | — | ativa |
| HU-19 | RF-39, RF-43, RF-32, RF-15 | RNF-20 | ativa |
| HU-20 | RF-40, RF-39 | — | ativa |
| HU-21 | RF-41, RF-39, RF-38 | — | ativa |
| HU-22 | RF-44, RF-42 | RNF-07, RNF-17 | ativa |
| HU-23 | RF-45, RF-03 | RNF-02, RNF-18 | ativa |

RNFs transversais sem história própria (verificados em todas): RNF-01, RNF-05, RNF-13, RNF-16, RNF-18.

Todo RF tem ao menos uma HU: RF-01 a RF-30 pelas HU-01 a HU-14; RF-31 a RF-45 pelas HU-15 a HU-23.
