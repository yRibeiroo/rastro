# Wireframes do Rastro

Mobile (360 px) primeiro, depois desktop (≥ 1024 px). Linguagem: **trilhas, não cartões**. Listas são linhas com divisória; o único "cartão" é o que flutua ou agrupa de verdade. `◌` = `<Carregando>` (thinking-orbs), `▒` = esqueleto, `╭─╮` = trilha decorativa, `[ ]` = botão, `( )` = chip.

Navegação: mobile com barra inferior (Painel, Extrato, Categorias, Mais); desktop com trilho lateral estreito à esquerda (logo + 6 itens), conteúdo até 1152 px.

---

## 1. Entrar (`/entrar`)

```
MOBILE                                  DESKTOP
┌──────────────────────────┐            ┌───────────────────────────────┬──────────────────────────┐
│ ╭────────────────╮       │            │                               │                          │
│╭╯  trilha fraca  ╰──     │            │  [logo] Rastro                │   ╭──────────────────╮   │
│                          │            │                               │ ╭─╯ trilhas finas que ╰─ │
│ [logo 48]                │            │  Saiba para onde vai          │ │   sobem para a       │ │
│ Saiba para onde          │            │  cada real.                   │ ╰─╮ direita (fundo     ╭─╯ │
│ vai cada real.           │            │                               │   ╰─ grafite #071315)╯   │
│                          │            │  E-mail                       │       [logo 160]         │
│ E-mail                   │            │  [______________________]     │                          │
│ [______________________] │            │  [ Receber link de acesso ]   │                          │
│ [ Receber link de acesso]│            │                               │                          │
│                          │            │  Sem senha: enviamos um link. │                          │
│ Sem senha: enviamos      │            │                               │                          │
│ um link para o e-mail.   │            └───────────────────────────────┴──────────────────────────┘
└──────────────────────────┘             split 5/7; o lado da marca some abaixo de 1024 px
```

| Estado | O que aparece |
|---|---|
| Carregando | Botão vira `◌ inline "Enviando"`, `aria-busy`, largura fixa. Campo continua editável. |
| Vazio | É o estado inicial: campo com rótulo acima, foco automático só no desktop. |
| Erro | Inline sob o campo: "Digite um e-mail válido." / faixa `erro-suave`: "Não conseguimos enviar agora. Tente de novo em instantes." |
| Sucesso | Troca o formulário por: "Confira seu e-mail" + endereço + `[Reenviar em 60 s]` + "Usar outro e-mail". |

---

## 2. Painel (`/painel`)

A peça central é o **Fluxo do mês**: uma faixa horizontal onde a entrada à esquerda se divide em trilhas que terminam nas categorias (um Sankey simplificado). O saldo é o texto grande; não há quatro cartões KPI.

```
MOBILE                                  DESKTOP
┌──────────────────────────┐            ┌──┬────────────────────────────────────────────────────────┐
│ Outubro ▾        [◐ tema]│            │R │ Outubro de 2026 ▾                     Sicredi · há 4 min│
│                          │            │  │                                                        │
│ Saldo do mês             │            │▣ │ Saldo do mês                                           │
│ R$ 7.245,63              │            │▤ │ R$ 7.245,63      entrou R$ 18.450,00  saiu R$ 11.204,37│
│ entrou  R$ 18.450,00     │            │◫ │                                                        │
│ saiu   −R$ 11.204,37     │            │⚙ │ Para onde foi                                          │
│                          │            │  │ R$ 18.450 ═╦═══════════ Material elétrico  R$ 4.120   │
│ Para onde foi            │            │  │            ╠════════    Combustível        R$ 2.860   │
│ Material elétr. ━━━━━━ 37%│           │  │            ╠═════       Folha              R$ 2.300   │
│ Combustível     ━━━━   26%│           │  │            ╠══          Ferramentas          R$ 980   │
│ Folha           ━━━    21%│           │  │            ╚═           Outras               R$ 944   │
│ Ferramentas     ━       9%│           │  │                                                        │
│ (ver todas)              │            │  │ Por serviço (centro de custo)    │ Saldo projetado     │
│                          │            │  │ Ar-condicionado  ━━━━━━  R$ 5,1k │  ╭──╮  ╭────        │
│ Por serviço              │            │  │ Elétrica         ━━━━    R$ 3,9k │ ─╯  ╰──╯  fim do mês│
│ Ar-cond. · Elétrica · …  │            │  │ Incêndio         ━━      R$ 2,2k │   R$ 6.980 (estim.) │
│                          │            │  │                                                        │
│ 3 sem categoria  (revisar)│           │  │ ⚠ 3 transações sem categoria  (revisar)                │
├──────────────────────────┤            └──┴────────────────────────────────────────────────────────┘
│ Painel Extrato Categ. Mais│
└──────────────────────────┘
```

| Estado | O que aparece |
|---|---|
| Carregando | 1º acesso após conectar: `◌ gerando-painel` centralizado na área do fluxo, com o saldo em `▒`. Depois: esqueleto com o formato exato (linhas `▒` nas trilhas). Nunca tela branca. |
| Vazio (sem conexão) | Trilha única pontilhada que termina num ponto: "Conecte a conta do Sicredi para ver para onde vai cada real." `[Conectar banco]`. Alternativa: "Importar OFX". |
| Vazio (mês sem movimento) | Saldo R$ 0,00 + "Nenhuma transação em outubro ainda." + atalho para o mês anterior. |
| Erro | Faixa `erro-suave` no topo: "Não foi possível atualizar. Mostrando dados de 08/10, 14:12." `[Tentar de novo]`. Dados antigos continuam visíveis. |
| Sucesso | Sincronização nova: o carimbo "Sicredi · agora" pisca o verde uma vez (opacidade) e as trilhas que mudaram se redesenham (stroke-dashoffset, 400 ms). |

---

## 3. Extrato (`/extrato`)

```
MOBILE                                  DESKTOP
┌──────────────────────────┐            ┌──┬────────────────────────────────────────────────────────┐
│ Extrato     [⟳ Sincronizar]│          │R │ Extrato                [buscar______]  [⟳ Sincronizar] │
│ [buscar_______] (filtros)│            │  │ (Outubro) (Saídas) (Sem categoria 3) (Sem nota 12)     │
│ (Out) (Saídas) (Sem cat.)│            │  │                                                        │
│                          │            │  │ QUA, 8 DE OUTUBRO                         −R$ 1.204,10 │
│ QUA, 8 OUT     −R$ 1.204 │            │  │  POSTO TOCANTINS LTDA   Pix   (Combustível)    −286,40 │
│ POSTO TOCANTINS  −286,40 │            │  │  ELETRO NORTE MAT ELET  Boleto (Material el.) −917,70 📎│
│ (Combustível)  Pix       │            │  │ TER, 7 DE OUTUBRO                         +R$ 6.300,00 │
│ ELETRO NORTE     −917,70 │            │  │  CLIENTE: CONDOMÍNIO…   TED   (Receita serv.) +6.300,00│
│ (Material el.) Boleto 📎 │            │  │                                                        │
│ TER, 7 OUT    +R$ 6.300  │            │  │ ┌ painel lateral ao abrir uma linha ────────────────┐  │
│ CONDOMÍNIO …   +6.300,00 │            │  │ │ POSTO TOCANTINS  −R$ 286,40  08/10 14:32 Pix     │  │
│ (Receita serv.)  TED     │            │  │ │ Categoria (Combustível)  Centro (Elétrica)      │  │
│                          │            │  │ │ Nota fiscal [Anexar]   Regra: "contém POSTO"    │  │
└──────────────────────────┘            └──┴─┴──────────────────────────────────────────────────┴──┘
```
Valores com `.valor-monetario`, alinhados à direita, sinal sempre visível, cor `entrada`/`saida`. Agrupamento por dia com subtotal. Chip de categoria é o alvo do `deixarRastro`.

| Estado | O que aparece |
|---|---|
| Carregando | Primeira carga: 8 linhas `▒` com o formato real. Sincronizando: botão vira `◌ inline "Sincronizando"` e uma faixa fina no topo `◌ sincronizando "Buscando transações novas no Sicredi"`; a lista atual continua usável. Categorizando: chip `◌ inline` nas linhas pendentes. |
| Vazio | Sem conexão: igual ao painel. Filtro sem resultado: "Nenhuma transação com esses filtros." `[Limpar filtros]`. |
| Erro | Faixa: "A sincronização falhou: o Sicredi pediu nova autorização." `[Reconectar]`. Linha que falhou ao salvar categoria: volta ao chip anterior com texto `erro` "Não salvou. Tentar de novo". |
| Sucesso | "12 transações novas" no topo (aria-live), novas linhas entram com fade + 4 px (stagger 40 ms, só as novas). Recategorizar: rastro + mensagem + oferta de regra (ver fluxos.md §3). |

---

## 4. Categorias (`/categorias`)

```
MOBILE                                  DESKTOP
┌──────────────────────────┐            ┌──┬──────────────────────────────┬─────────────────────────┐
│ Categorias     [+ Nova]  │            │R │ Categorias         [+ Nova]  │ Regras de Combustível   │
│ [buscar______]           │            │  │                              │                         │
│ Saídas                   │            │  │ Saídas            out. │ qtd │ Quando a descrição      │
│ ● Combustível  R$ 2.860 ›│            │  │ ● Combustível   2.860  │ 14  │ contém "POSTO"   (editar)│
│ ● Material el. R$ 4.120 ›│            │  │ ● Material el.  4.120  │  9  │ contém "SHELL"   (editar)│
│ ● Folha        R$ 2.300 ›│            │  │ ● Folha         2.300  │  2  │ [+ Nova regra]          │
│ Entradas                 │            │  │ Entradas                     │                         │
│ ● Receita serv. R$ 18,4k ›│           │  │ ● Receita serv. 18.450 │  6  │ A IA classificou 3 este │
│                          │            │  │                              │ mês (ver)               │
└──────────────────────────┘            └──┴──────────────────────────────┴─────────────────────────┘
```
`●` é a cor da categoria (paleta categórica derivada, sempre com o nome escrito ao lado; cor nunca é a única informação).

| Estado | O que aparece |
|---|---|
| Carregando | Lista `▒` (6 linhas). Painel de regras: `◌ generico` pequeno. |
| Vazio | "Comece com as categorias sugeridas para serviços" `[Usar sugestões]` (Combustível, Material elétrico, Ferramentas, Folha, Impostos, Receita de serviços) ou `[Criar do zero]`. Regras vazias: "Nenhuma regra ainda. Ao corrigir uma categoria no extrato, o Rastro oferece criar uma." |
| Erro | Nome duplicado: inline "Já existe uma categoria Combustível." Excluir categoria em uso: diálogo "14 transações usam Combustível. Mover para…" com seletor. |
| Sucesso | Nova categoria entra no topo da lista com destaque `primaria-suave` que some em 1,5 s. |

---

## 5. Centros de custo (`/centros-de-custo`)

Serviços da HOMETEC: Ar-condicionado, Elétrica, Incêndio. Visual: cada centro é uma **trilha** horizontal com entradas (verde) e saídas (terracota) do mês e a margem no fim.

```
MOBILE                                  DESKTOP
┌──────────────────────────┐            ┌──┬────────────────────────────────────────────────────────┐
│ Centros de custo [+ Novo]│            │R │ Centros de custo                              [+ Novo] │
│                          │            │  │                                                        │
│ Ar-condicionado          │            │  │ Ar-condicionado  +9.800 ━━━━━━━━━━━━━╸−5.120   = +4.680│
│ +9.800  −5.120  = +4.680 │            │  │ Elétrica         +6.300 ━━━━━━━━━╸−3.890       = +2.410│
│ ━━━━━━━━━━━━━╸━━━━━      │            │  │ Incêndio         +2.350 ━━━━╸−2.194            =   +156│
│ Elétrica                 │            │  │ Sem centro              ╸−1.000               (atribuir)│
│ +6.300  −3.890  = +2.410 │            │  │                                                        │
│ Incêndio …               │            │  │ Abrir um centro: transações dele + categorias por peso │
│ Sem centro −1.000 (atrib.)│           │  │                                                        │
└──────────────────────────┘            └──┴────────────────────────────────────────────────────────┘
```

| Estado | O que aparece |
|---|---|
| Carregando | Três trilhas `▒` com o formato final. |
| Vazio | "Separe os gastos por serviço para saber qual dá lucro." `[Criar Ar-condicionado, Elétrica e Incêndio]` `[Criar outro]`. |
| Erro | Faixa de erro com `[Tentar de novo]`; atribuição que falhou volta ao estado anterior com texto de erro na linha. |
| Sucesso | Ao atribuir uma transação, `deixarRastro` da linha até a trilha do centro; a trilha cresce (scaleX, 240 ms). |

---

## 6. Conexões bancárias (`/conexoes-bancarias`)

```
MOBILE                                  DESKTOP
┌──────────────────────────┐            ┌──┬────────────────────────────────────────────────────────┐
│ Conexões bancárias       │            │R │ Conexões bancárias                  [+ Conectar banco] │
│                          │            │  │                                                        │
│ Sicredi Empresas         │            │  │ Sicredi Empresas · conta PJ ••4821                      │
│ Conta PJ ••4821          │            │  │ ● Conectado · sincronizou há 4 min    [⟳] [Desconectar]│
│ ● Conectado · há 4 min   │            │  │ Open Finance via Pluggy · autorização válida até 03/2027│
│ [⟳ Sincronizar]  (…)     │            │  │                                                        │
│                          │            │  │ Histórico: 08/10 14:12 214 transações · 07/10 …        │
│ [+ Conectar banco]       │            │  │                                                        │
│ Importar extrato OFX     │            │  │ Sem integração? Importar extrato OFX                    │
└──────────────────────────┘            └──┴────────────────────────────────────────────────────────┘
```
`●` aqui é estado semântico real (conectado / atualizando / precisa reconectar), sempre com o texto ao lado.

| Estado | O que aparece |
|---|---|
| Carregando | Abrindo o widget: botão `◌ inline "Preparando"`. Esperando o app do Sicredi: `◌ aguardando` "Aguardando a autorização no app do Sicredi". Após autorizar: `◌ conectando` "Conectando ao banco", depois `◌ sincronizando` no cartão. |
| Vazio | Trilha pontilhada até o ícone do banco: "Nenhum banco conectado. A conexão é feita pelo Open Finance: o Rastro só lê o extrato, nunca movimenta dinheiro." `[Conectar banco]` + "Importar OFX". |
| Erro | Cartão com status `alerta` "Precisa reconectar: a autorização expirou." `[Reconectar]`. Erro do widget: faixa com o motivo legível e `[Tentar de novo]`. |
| Sucesso | "Sicredi conectado. Buscando as transações dos últimos 90 dias." (aria-live) e o cartão aparece com status "Conectado agora". |
