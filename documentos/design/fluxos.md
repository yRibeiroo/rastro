# Fluxos do Rastro

Glossário: Conexão, Transação, Categoria, Regra, Centro de custo, Empresa (mesmos termos no código, banco e interface). Rotas em português.

Legenda: `[tela]`, `(ação do usuário)`, `{sistema}`, `◇ decisão`.

## 1. Entrada → login → painel

```
(abre rastro.app)
   │
   ▼
{script no <head>: tema salvo + "abertura já vista nesta sessão?"}
   │
   ├─ não ─▶ [Abertura 2,4 s sobre a tela já carregando]──(Pular)──┐
   │                                                              │
   └─ sim ────────────────────────────────────────────────────────┤
                                                                  ▼
                                                 ◇ sessão Supabase válida?
                                       não ──────────┴────────── sim
                                        ▼                         ▼
                                  [/entrar]                 [/painel]
                       (e-mail) → (Receber link de acesso)        │
                                        │                         │
                         {envia magic link / OTP}                 │
                                        ▼                         │
                  [Confira seu e-mail]  ◇ link aberto?            │
                     (Reenviar em 60 s)        │                  │
                                        ▼      ▼                  │
                                 {cria sessão, resolve Empresa}   │
                                        ▼                         │
                         ◇ empresa tem Conexão?                   │
                     não ───────┴─────── sim                      │
                      ▼                   ▼                       │
          [/conexoes-bancarias]     [/painel] ◀───────────────────┘
          (estado vazio com CTA)    <Carregando gerando-painel> só no 1º acesso,
                                    depois esqueleto com o formato do painel
```

Erros: link expirado → [/entrar] com faixa "Este link expirou. Peça um novo." e e-mail preenchido. Sem rede → faixa no topo, nada é perdido.
Motivo da abertura não bloquear: ela é overlay; a sessão e os dados do painel carregam por baixo em paralelo.

## 2. Conectar banco (Pluggy, Sicredi Empresas via Open Finance)

```
[/conexoes-bancarias]  (Conectar banco)
   ▼
{POST /api/connect-token}  botão vira <Carregando conectando inline rotulo="Preparando">
   ▼
[Widget Pluggy Connect]  (escolhe Sicredi Empresas) → (autoriza no app do Sicredi)
   │   enquanto espera o app: <Carregando aguardando> "Aguardando a autorização no app do Sicredi"
   ▼
◇ resultado do widget
   ├─ sucesso ─▶ {POST /api/items: valida item na Pluggy, salva Conexão}
   │               ▼
   │          [Cartão da conexão: "Sicredi · conectado agora"]
   │          <Carregando sincronizando> "Sincronizando transações" (status por webhook)
   │               ▼
   │          {webhook transactions/created} → {categorização: regras, depois IA}
   │               ▼  <Carregando categorizando inline> "Categorizando 214 lançamentos"
   │          (Ver extrato) / painel atualiza sozinho
   │
   ├─ cancelado ─▶ volta à lista, sem erro ("Conexão não concluída")
   └─ erro ─────▶ faixa de erro com motivo legível + (Tentar de novo)
                  item/error depois → cartão com status "Precisa reconectar" + (Reconectar)
```

Plano B sempre visível em estado de erro: "Importar extrato OFX".

## 3. Recategorizar e criar regra

```
[/extrato]  linha "POSTO TOCANTINS LTDA  −R$ 286,40  [Sem categoria]"
   (toca no chip de categoria)  ── teclado: Enter na linha, depois C
   ▼
[Seletor de categoria] (lista com busca, recentes primeiro, Esc fecha)
   (escolhe "Combustível")
   ▼
{deixarRastro(valor, chip)}  o valor viaja até o chip com uma trilha de 700 ms
{salva categoria}  aria-live: "Transação movida para Combustível"
   ▼
◇ há outras transações parecidas sem categoria (mesma contraparte/descrição)?
   ├─ não ─▶ fim
   └─ sim ─▶ [Faixa inline sob a linha]
             "Sempre classificar POSTO TOCANTINS como Combustível? 6 transações parecidas."
             (Criar regra)  (Só esta)
                  ▼
             [Folha "Nova regra"]  Quando: descrição contém [POSTO TOCANTINS]
                                   Então: categoria [Combustível], centro de custo [opcional]
                                   Prévia: lista das 6 que serão afetadas
             (Salvar regra)
                  ▼
             {aplica nas 6}  sem rastro individual (lote); mensagem
             "Regra criada. 6 transações recategorizadas."  (Desfazer, 8 s)
```

A correção vira regra (princípio do produto): a IA só vê o que nenhuma regra cobriu.

## 4. Anexar nota

```
[/extrato] → (abre a transação) → [Detalhe da transação]
   (Anexar nota)  aceita PDF, JPG, PNG, XML de NF-e; câmera no celular
   ▼
{upload para bucket privado}  barra de progresso no próprio item (não orbe)
   ▼
◇ resultado
   ├─ sucesso ─▶ miniatura + nome + (Ver) via URL assinada; ícone de clipe na linha do extrato
   ├─ arquivo grande/formato inválido ─▶ erro inline sob o campo, arquivo não sai da lista
   └─ falha de rede ─▶ item com (Tentar de novo), nada some
```

A nota é opcional e pedida só quando o contador precisa: filtro "Sem nota" no extrato e no painel ("12 despesas de setembro sem nota").
