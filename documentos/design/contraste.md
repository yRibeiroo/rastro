# Contraste WCAG do Rastro

Verificado por `documentos/design/verificar-contraste.mjs` (Node puro, sem dependências). O script **lê os valores reais** de `src/identidade-visual/tokens.css` (cada token é `light-dark(claro, escuro)`), calcula a razão WCAG 2.x de cada par usado na interface e **sai com código 1** se algum par ficar abaixo do mínimo.

```bash
node documentos/design/verificar-contraste.mjs
```

Mínimos aplicados:

| Uso | Mínimo |
|---|---|
| Texto normal (corpo, rótulos, valores em R$, links, mensagens) | 4,5:1 |
| Texto grande (≥ 24 px, ou ≥ 18,66 px em negrito) e componentes de UI (anel de foco, borda de input) | 3:1 |

## Decisões que o contraste forçou

- **#00D1A0 não é cor de texto no modo claro.** Sobre a superfície clara dá 1,94:1. Ele continua sendo a cor da marca para preenchimentos (logo, botão principal, gráficos), sempre com texto `--cor-sobre-primaria` (#04241C, 8,34:1) por cima.
- **Verde para texto/links no claro: `--cor-primaria-texto` = #016654.** Não foi inventado: é o pixel do círculo "Verde Principal" do próprio brand board (ver `paleta-extraida.json`). Dá 6,4 a 6,8:1. No escuro vira #4EE6B7 (o Verde Secundário), com 9,6 a 12:1.
- **Despesa não é vermelho de erro.** `--cor-saida` é terracota (#A8402A claro / #FF9B85 escuro), para um extrato cheio de saídas não parecer uma tela de alerta. Erro de verdade usa `--cor-erro`.
- **Duas bordas.** `--cor-borda` é decorativa (divisórias, pode ser fraca). `--cor-borda-controle` contorna inputs e botões secundários e passa 3:1 em todas as superfícies. O verificador pegou a primeira versão escura (#557370, 2,95:1 sobre `superficie-2`) e ela foi corrigida para #5F7E7B.
- **Foco** usa o mesmo verde de texto (#016654 / #4EE6B7), 2 px com afastamento de 2 px.
- Cores alfa (`--cor-rastro*`) são decorativas e nunca carregam informação sozinhas, por isso ficam fora do verificador.

## Resultado da última execução

```
OK    claro  16.56:1 (mín 4.5)  cor-texto #0f172a sobre cor-fundo #f4f7f6  [texto principal]
OK    claro   6.98:1 (mín 4.5)  cor-texto-suave #4a5568 sobre cor-fundo #f4f7f6  [texto secundário]
OK    claro   6.43:1 (mín 4.5)  cor-primaria-texto #016654 sobre cor-fundo #f4f7f6  [links / texto verde]
OK    claro   6.43:1 (mín 4.5)  cor-entrada #016654 sobre cor-fundo #f4f7f6  [valor de receita]
OK    claro   5.68:1 (mín 4.5)  cor-saida #a8402a sobre cor-fundo #f4f7f6  [valor de despesa]
OK    claro   5.67:1 (mín 4.5)  cor-erro #c01c28 sobre cor-fundo #f4f7f6  [mensagem de erro]
OK    claro   5.87:1 (mín 4.5)  cor-alerta #8a5300 sobre cor-fundo #f4f7f6  [mensagem de alerta]
OK    claro   6.43:1 (mín 3)  cor-foco #016654 sobre cor-fundo #f4f7f6  [anel de foco]
OK    claro   3.41:1 (mín 3)  cor-borda-controle #7a8794 sobre cor-fundo #f4f7f6  [borda de input]
OK    claro  17.52:1 (mín 4.5)  cor-texto #0f172a sobre cor-superficie #fcfdfd  [texto principal]
OK    claro   7.38:1 (mín 4.5)  cor-texto-suave #4a5568 sobre cor-superficie #fcfdfd  [texto secundário]
OK    claro   6.80:1 (mín 4.5)  cor-primaria-texto #016654 sobre cor-superficie #fcfdfd  [links / texto verde]
OK    claro   6.80:1 (mín 4.5)  cor-entrada #016654 sobre cor-superficie #fcfdfd  [valor de receita]
OK    claro   6.00:1 (mín 4.5)  cor-saida #a8402a sobre cor-superficie #fcfdfd  [valor de despesa]
OK    claro   5.99:1 (mín 4.5)  cor-erro #c01c28 sobre cor-superficie #fcfdfd  [mensagem de erro]
OK    claro   6.21:1 (mín 4.5)  cor-alerta #8a5300 sobre cor-superficie #fcfdfd  [mensagem de alerta]
OK    claro   6.80:1 (mín 3)  cor-foco #016654 sobre cor-superficie #fcfdfd  [anel de foco]
OK    claro   3.60:1 (mín 3)  cor-borda-controle #7a8794 sobre cor-superficie #fcfdfd  [borda de input]
OK    claro  15.33:1 (mín 4.5)  cor-texto #0f172a sobre cor-superficie-2 #e9efed  [texto principal]
OK    claro   6.46:1 (mín 4.5)  cor-texto-suave #4a5568 sobre cor-superficie-2 #e9efed  [texto secundário]
OK    claro   5.95:1 (mín 4.5)  cor-primaria-texto #016654 sobre cor-superficie-2 #e9efed  [links / texto verde]
OK    claro   5.95:1 (mín 4.5)  cor-entrada #016654 sobre cor-superficie-2 #e9efed  [valor de receita]
OK    claro   5.26:1 (mín 4.5)  cor-saida #a8402a sobre cor-superficie-2 #e9efed  [valor de despesa]
OK    claro   5.25:1 (mín 4.5)  cor-erro #c01c28 sobre cor-superficie-2 #e9efed  [mensagem de erro]
OK    claro   5.44:1 (mín 4.5)  cor-alerta #8a5300 sobre cor-superficie-2 #e9efed  [mensagem de alerta]
OK    claro   5.95:1 (mín 3)  cor-foco #016654 sobre cor-superficie-2 #e9efed  [anel de foco]
OK    claro   3.15:1 (mín 3)  cor-borda-controle #7a8794 sobre cor-superficie-2 #e9efed  [borda de input]
OK    claro   8.34:1 (mín 4.5)  cor-sobre-primaria #04241c sobre cor-primaria #00d1a0  [texto do botão principal]
OK    claro  15.91:1 (mín 4.5)  cor-texto #0f172a sobre cor-primaria-suave #e0f7ef  [texto em chip/seleção]
OK    claro   6.18:1 (mín 4.5)  cor-primaria-texto #016654 sobre cor-primaria-suave #e0f7ef  [texto verde em chip]
OK    claro   5.20:1 (mín 4.5)  cor-erro #c01c28 sobre cor-erro-suave #fde8e8  [texto de erro em faixa]
OK    claro   5.66:1 (mín 4.5)  cor-alerta #8a5300 sobre cor-alerta-suave #fdf1dc  [texto de alerta em faixa]
OK    claro  15.20:1 (mín 4.5)  cor-texto #0f172a sobre cor-erro-suave #fde8e8  [texto comum em faixa de erro]
OK    escuro 15.24:1 (mín 4.5)  cor-texto #e5e7eb sobre cor-fundo #071315  [texto principal]
OK    escuro  8.35:1 (mín 4.5)  cor-texto-suave #9fb0ae sobre cor-fundo #071315  [texto secundário]
OK    escuro 11.97:1 (mín 4.5)  cor-primaria-texto #4ee6b7 sobre cor-fundo #071315  [links / texto verde]
OK    escuro 11.97:1 (mín 4.5)  cor-entrada #4ee6b7 sobre cor-fundo #071315  [valor de receita]
OK    escuro  9.24:1 (mín 4.5)  cor-saida #ff9b85 sobre cor-fundo #071315  [valor de despesa]
OK    escuro  7.52:1 (mín 4.5)  cor-erro #ff7b7b sobre cor-fundo #071315  [mensagem de erro]
OK    escuro 10.61:1 (mín 4.5)  cor-alerta #f5b83d sobre cor-fundo #071315  [mensagem de alerta]
OK    escuro 11.97:1 (mín 3)  cor-foco #4ee6b7 sobre cor-fundo #071315  [anel de foco]
OK    escuro  4.27:1 (mín 3)  cor-borda-controle #5f7e7b sobre cor-fundo #071315  [borda de input]
OK    escuro 13.99:1 (mín 4.5)  cor-texto #e5e7eb sobre cor-superficie #0d1d1f  [texto principal]
OK    escuro  7.67:1 (mín 4.5)  cor-texto-suave #9fb0ae sobre cor-superficie #0d1d1f  [texto secundário]
OK    escuro 10.99:1 (mín 4.5)  cor-primaria-texto #4ee6b7 sobre cor-superficie #0d1d1f  [links / texto verde]
OK    escuro 10.99:1 (mín 4.5)  cor-entrada #4ee6b7 sobre cor-superficie #0d1d1f  [valor de receita]
OK    escuro  8.48:1 (mín 4.5)  cor-saida #ff9b85 sobre cor-superficie #0d1d1f  [valor de despesa]
OK    escuro  6.90:1 (mín 4.5)  cor-erro #ff7b7b sobre cor-superficie #0d1d1f  [mensagem de erro]
OK    escuro  9.74:1 (mín 4.5)  cor-alerta #f5b83d sobre cor-superficie #0d1d1f  [mensagem de alerta]
OK    escuro 10.99:1 (mín 3)  cor-foco #4ee6b7 sobre cor-superficie #0d1d1f  [anel de foco]
OK    escuro  3.92:1 (mín 3)  cor-borda-controle #5f7e7b sobre cor-superficie #0d1d1f  [borda de input]
OK    escuro 12.29:1 (mín 4.5)  cor-texto #e5e7eb sobre cor-superficie-2 #14292a  [texto principal]
OK    escuro  6.73:1 (mín 4.5)  cor-texto-suave #9fb0ae sobre cor-superficie-2 #14292a  [texto secundário]
OK    escuro  9.65:1 (mín 4.5)  cor-primaria-texto #4ee6b7 sobre cor-superficie-2 #14292a  [links / texto verde]
OK    escuro  9.65:1 (mín 4.5)  cor-entrada #4ee6b7 sobre cor-superficie-2 #14292a  [valor de receita]
OK    escuro  7.45:1 (mín 4.5)  cor-saida #ff9b85 sobre cor-superficie-2 #14292a  [valor de despesa]
OK    escuro  6.06:1 (mín 4.5)  cor-erro #ff7b7b sobre cor-superficie-2 #14292a  [mensagem de erro]
OK    escuro  8.55:1 (mín 4.5)  cor-alerta #f5b83d sobre cor-superficie-2 #14292a  [mensagem de alerta]
OK    escuro  9.65:1 (mín 3)  cor-foco #4ee6b7 sobre cor-superficie-2 #14292a  [anel de foco]
OK    escuro  3.45:1 (mín 3)  cor-borda-controle #5f7e7b sobre cor-superficie-2 #14292a  [borda de input]
OK    escuro  8.34:1 (mín 4.5)  cor-sobre-primaria #04241c sobre cor-primaria #00d1a0  [texto do botão principal]
OK    escuro 10.19:1 (mín 4.5)  cor-texto #e5e7eb sobre cor-primaria-suave #0c3a31  [texto em chip/seleção]
OK    escuro  8.00:1 (mín 4.5)  cor-primaria-texto #4ee6b7 sobre cor-primaria-suave #0c3a31  [texto verde em chip]
OK    escuro  6.48:1 (mín 4.5)  cor-erro #ff7b7b sobre cor-erro-suave #3a1416  [texto de erro em faixa]
OK    escuro  8.30:1 (mín 4.5)  cor-alerta #f5b83d sobre cor-alerta-suave #33260b  [texto de alerta em faixa]
OK    escuro 13.13:1 (mín 4.5)  cor-texto #e5e7eb sobre cor-erro-suave #3a1416  [texto comum em faixa de erro]

INFO  #00D1A0 como texto sobre a superfície clara: 1.94:1 (não use; use --cor-primaria-texto)

66/66 pares aprovados.
```
