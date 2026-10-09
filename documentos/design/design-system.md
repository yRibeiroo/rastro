# Design system do Rastro

> "Rastro: saiba para onde vai cada real." O conceito visual é a **trilha do dinheiro**: linhas que saem de um lugar e chegam em outro, a trajetória ascendente da logo, valores que deixam rastro ao mudar de categoria. Nada de grade de cartões KPI genérica.

Código: `src/identidade-visual/` (importe de `@/identidade-visual`). Protótipo vivo: rota `/vitrine` (temporária).

## 1. Origem da paleta

`documentos/design/extrair-paleta.py` quantiza `Rastro.png` (median cut), isola os pixels verdes saturados e amostra os quatro círculos do brand board. Resultado em `paleta-extraida.json`:

| Board declara | Extraído da arte | Leitura |
|---|---|---|
| Verde Principal #00D1A0 | logo: #1BDAAC / #10D1A2; **círculo do board: #016654** | A logo usa #00D1A0; o círculo é um verde escuro. Usamos os dois: #00D1A0 para marca, #016654 para texto. |
| Verde Secundário #4EE6B7 | #43E0BD / #48DFBB | Confere. |
| Grafite #0F172A | #0D121B (círculo); fundos da arte #011314 a #093532 | O grafite da arte é **esverdeado**. O modo escuro usa #071315 (tirado da arte), o texto claro usa #0F172A. |
| Cinza Claro #E5E7EB | #E0E3E8 | Confere. |

Rodar: `python -E -P documentos/design/extrair-paleta.py` (o `-E -P` isola como o `-I`, mas enxerga o Pillow instalado com `--user`).

## 2. Tokens de cor

Definidos uma vez com `light-dark()` em `tokens.css`. O tema segue o sistema; `definirTema("claro" | "escuro" | "sistema")` fixa manualmente (grava `data-tema` para os tokens e `data-theme` para o thinking-orbs, e persiste em `localStorage`).

| Token | Claro | Escuro | Tailwind | Uso |
|---|---|---|---|---|
| `--cor-primaria` | #00D1A0 | #00D1A0 | `bg-primaria` | Logo, botão principal, gráficos. **Não é texto no claro.** |
| `--cor-secundaria` | #4EE6B7 | #4EE6B7 | `bg-secundaria` | Fim do gradiente, luz do rastro |
| `--cor-primaria-texto` | #016654 | #4EE6B7 | `text-primaria-texto` | Links, texto verde, ícones verdes |
| `--cor-primaria-suave` | #E0F7EF | #0C3A31 | `bg-primaria-suave` | Chips, item selecionado, seleção de texto |
| `--cor-sobre-primaria` | #04241C | #04241C | `text-sobre-primaria` | Texto sobre `primaria` |
| `--cor-fundo` | #F4F7F6 | #071315 | `bg-fundo` | Fundo do app |
| `--cor-superficie` | #FCFDFD | #0D1D1F | `bg-superficie` | Cartões, folhas, inputs |
| `--cor-superficie-2` | #E9EFED | #14292A | `bg-superficie-2` | Áreas rebaixadas, cabeçalho de tabela |
| `--cor-texto` | #0F172A | #E5E7EB | `text-texto` | Texto principal |
| `--cor-texto-suave` | #4A5568 | #9FB0AE | `text-texto-suave` | Texto secundário, legendas |
| `--cor-borda` | #E5E7EB | #1D3433 | `border-borda` | Divisórias (decorativa) |
| `--cor-borda-controle` | #7A8794 | #5F7E7B | `border-borda-controle` | Inputs, botões secundários (≥ 3:1) |
| `--cor-entrada` | #016654 | #4EE6B7 | `text-entrada` | Receita |
| `--cor-saida` | #A8402A | #FF9B85 | `text-saida` | Despesa (terracota, não é erro) |
| `--cor-erro` / `-suave` | #C01C28 / #FDE8E8 | #FF7B7B / #3A1416 | `text-erro`, `bg-erro-suave` | Erros |
| `--cor-alerta` / `-suave` | #8A5300 / #FDF1DC | #F5B83D / #33260B | `text-alerta`, `bg-alerta-suave` | Avisos |
| `--cor-sucesso` | #016654 | #4EE6B7 | `text-sucesso` | Confirmações |
| `--cor-foco` | #016654 | #4EE6B7 | `outline-foco` | Anel de foco (global em `:focus-visible`) |
| `--cor-rastro` / `-fraco` | #00D1A0 55% / 14% | #4EE6B7 60% / 12% | `stroke-rastro` | Trilhas decorativas |

Regras: valor em R$ **sempre** com sinal e cor (`text-entrada` / `text-saida`), nunca só pela cor. Contraste comprovado em `contraste.md` (66/66 pares AA).

## 3. Tipografia

- **Montserrat** (títulos e destaques, `font-titulo`, peso 600 a 700, `tracking -0.02em`). Aplicada automaticamente em `h1`, `h2`, `h3`.
- **Inter** (texto e interface, `font-sans`, padrão do `body`).
- Carregadas por `next/font/google` em `fontes.ts` (variáveis `--fonte-titulo`, `--fonte-texto`, `display: swap`, subset latin).
- **`.valor-monetario`**: algarismos tabulares (`tabular-nums`) para colunas de R$ alinharem. Use em todo valor monetário, saldo e data em tabela.

| Papel | Tamanho / altura | Classe sugerida |
|---|---|---|
| Valor de destaque (saldo do mês) | 40/44, Montserrat 700 | `font-titulo text-4xl font-bold valor-monetario` |
| Título de página | 30/36 | `text-3xl font-bold` |
| Título de seção | 20/28 | `text-xl font-semibold` |
| Corpo | 16/24 | `text-base` |
| Rótulo, tabela | 14/20 | `text-sm` |
| Legenda | 12/16 | `text-xs text-texto-suave` |

Formatação: `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` (R$ 1.234,56) e datas em `America/Araguaina`.

## 4. Espaçamento, raios, sombras

- Escala de espaçamento: a do Tailwind (base 4 px). Ritmo: 4 / 8 / 12 / 16 / 24 / 40 / 64. Mobile com `px-4`, desktop `px-8`, conteúdo até `max-w-6xl`.
- Raios (regra fixa, sem misturar): `rounded-p` 6 px inputs e chips retangulares; `rounded-m` 12 px cartões e menus; `rounded-g` 20 px painéis e folhas; `rounded-full` só botões e pílulas.
- Sombras tingidas de grafite-verde (`shadow-1/2/3`), mais fortes no escuro. Prefira borda + espaço a sombra; sombra só para o que flutua (menu, folha, toast).
- Densidade: listas de transação usam linhas sem cartão (divisória `border-borda`), não um cartão por item.

## 5. Movimento

Fonte: `rastro-movimento.ts` (JS) e `--curva-*` / `--duracao-*` (CSS).

| Nome | Valor | Quando |
|---|---|---|
| `CURVA.saida` / `--curva-saida` | cubic-bezier(0.23, 1, 0.32, 1) | Entrar, sair, responder a toque |
| `CURVA.entradaSaida` | cubic-bezier(0.77, 0, 0.175, 1) | Algo que já está na tela e se move |
| `CURVA.gaveta` | cubic-bezier(0.32, 0.72, 0, 1) | Folhas e gavetas |
| `DURACAO.toque` | 140 ms | `active:scale-[0.97]` em botões |
| `DURACAO.rapido` / `padrao` | 180 / 240 ms | Menus, popovers, trocas de estado |
| `DURACAO.gaveta` | 400 ms | Folhas |
| `DURACAO.rastro` | 700 ms | Microinteração "deixar rastro" |
| `DURACAO.abertura` | 2,4 s | Abertura (uma vez por sessão) |

Regras: só `transform`, `opacity` e `stroke-dashoffset`; nunca `ease-in`; nada anima em atalhos de teclado ou ações repetidas dezenas de vezes por minuto; `prefers-reduced-motion` troca movimento por um fade curto.

### Microinteração-assinatura: `deixarRastro(origem, destino)`

Quando uma transação é (re)categorizada, o valor viaja até a categoria deixando uma trilha curva (a mesma curvatura da trajetória da logo); a ponta chega, a cauda alcança e o rastro se apaga; o destino responde com um toque de escala 1,04. WAAPI puro, 700 ms, sem dependência.

```tsx
const valor = useRef<HTMLSpanElement>(null);
async function mover(chip: HTMLElement, categoria: Categoria) {
  if (valor.current) await deixarRastro(valor.current, chip); // visual
  salvarCategoria(categoria);                                  // dado
  anunciar(`Transação movida para ${categoria.nome}`);         // aria-live
}
```

Use o **elemento do valor** como origem (não a linha inteira) para a trilha nascer do número. Não chame em lote (recategorização em massa: sem rastro, só a mensagem).

### Linha-trilha de fundo

`caminhoDaTrilha(x1, y1, x2, y2)` devolve um path SVG curvo. Use uma ou duas linhas finas em `--cor-rastro-fraco` atrás do cabeçalho de páginas de entrada (login, painel vazio). Nunca atrás de números ou tabelas.

## 6. Logo

`<LogoRastro tamanho={40} title="Rastro" variante="preenchida" | "tracada" espessura={8} />`

- Paths de `LogoVetorizada.zip`, posicionados contra a arte original (sobreposição conferida). Gradiente #008F6C → #00D1A0 → #4EE6B7 a 45°, um único gradiente para todas as peças (`useId`, sem colisão de ids).
- `title=""` torna a logo decorativa (`aria-hidden`), use quando o nome "Rastro" já está escrito ao lado.
- `variante="tracada"`: só contornos com `pathLength=1`, prontos para `stroke-dasharray: 1; stroke-dashoffset: 1 → 0`.
- `PECAS_LOGO` exporta as peças na ordem de desenho (barra 1, 2, 3, trajetória, ponta, R).
- Arquivos: `public/logo-rastro.svg`, `src/app/icon.svg` (favicon: logo sobre quadrado grafite arredondado, como o ícone de app do board).
- Área de respiro: metade da altura da barra mais alta em volta. Tamanho mínimo: 20 px de largura.

## 7. Abertura

`<AberturaAnimada>` envolve os children no `layout.tsx`. Overlay por cima do app já montado (nada espera por ela):

1. 0 a 1,25 s: a logo se desenha por traçado (barras crescendo, trajetória, R).
2. 0,95 s: o gradiente acende e o nome "Rastro" entra.
3. 1,35 a 2,35 s: um véu inclinado no ângulo da trajetória sai pela diagonal, com um rastro de luz verde na borda que se apaga, revelando a tela.

Uma vez por sessão: o script inline `SCRIPT_ANTES_DA_PINTURA` (no `<head>`) lê `sessionStorage` antes da primeira pintura e marca `<html data-abertura-vista>`; o CSS esconde o overlay. Servidor e cliente renderizam o mesmo HTML: sem hydration mismatch e sem flash. Botão "Pular abertura" é o primeiro foco da página. Movimento reduzido: logo estática e fade de 0,3 s. Sem JavaScript a animação termina sozinha (é toda CSS).

## 8. Carregando

```tsx
<Carregando contexto="sincronizando" />                          // bloco/tela, 64 px, texto visível
<Carregando contexto="conectando" tamanho="inline" />            // 20 px, só o orbe (nome acessível)
<Carregando contexto="categorizando" tamanho="inline" rotulo="Categorizando 12 lançamentos" />
```

| `contexto` | Estado do orbe | Nome acessível padrão | Onde |
|---|---|---|---|
| `conectando` | connecting | Conectando ao banco | Widget Pluggy, reconexão |
| `sincronizando` | searching | Sincronizando transações | Extrato, botão "Sincronizar" |
| `categorizando` | solving | Categorizando gastos | IA rodando sobre pendentes |
| `gerando-painel` | weaving | Gerando o painel | Primeiro carregamento do painel |
| `generico` | working | Carregando | Qualquer outro |
| `aguardando` | breathing | Aguardando | Esperando o banco ou o usuário (ex.: autorização no app do Sicredi) |

- `role="status"` no contêiner; o orbe (`role="img"`) recebe o nome em português; o texto visível é `aria-hidden` para não ser lido duas vezes.
- `theme="auto"`: segue `data-theme` (gravado por `definirTema`) ou o sistema.
- Halo de marca (`--cor-rastro-fraco` radial) no contêiner em "tela"; a biblioteca não é alterada.
- Em botão: troque o rótulo pelo `<Carregando tamanho="inline" rotulo="Sincronizando" />`, `aria-busy` e `disabled`, mantendo a largura.
- Prefira esqueletos com o formato final para listas longas e use o orbe como indicador da ação. Nunca mostre orbe por menos de 300 ms (atrase a exibição se a resposta costuma ser rápida).
- `CONTEXTOS` vem de `contextos-carregando.ts` (módulo sem "use client", seguro em Server Components).

## 9. Estados

Todo componente desenha: **carregando**, **vazio** (diz o que fazer e oferece a ação), **erro** (o que aconteceu, o que fazer, botão de tentar de novo; inline para formulários, faixa `bg-erro-suave` para a página) e **sucesso** (confirmação discreta, `aria-live="polite"`; toast só para ações transitórias). Ver `wireframes.md`.
