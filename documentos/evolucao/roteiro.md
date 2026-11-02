# Roteiro de evolução

Próximas versões do Rastro depois da v1.0.0. A ordem dentro de cada versão é a prioridade sugerida. As pendências vêm da revisão de QA em [qualidade/revisoes.md](../qualidade/revisoes.md).

## v1.0.x — acabamento (pendências do QA)

| Item                             | O que falta                                                                                                                                                                                                                                          | Origem                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| HU-11: clipe de anexo no extrato | O ícone de clipe só aparece para comprovante conciliado, não para anexo manual. Falta uma leitura em lote de "transações com anexo" no backend (`src/app/(sistema)/extrato/page.tsx`). Tirar o `test.fixme` de `testes/ponta-a-ponta/anexos.spec.ts` | QA item 8                                                       |
| HU-09: centro de custo em lote   | Selecionar várias transações no extrato e atribuir um centro de custo de uma vez. Hoje é uma a uma ou por regra. Precisa de ação em lote + interface                                                                                                 | QA item 9                                                       |
| Botão de login antes de hidratar | Em conexão lenta, o primeiro clique em "Entrar" parece não fazer nada porque a Server Action ainda não foi ligada                                                                                                                                    | QA item 12                                                      |
| 6 avisos de lint                 | `no-unused-vars` em parâmetros `_x` dos testes. Sugestão: `argsIgnorePattern: "^_"` no `eslint.config.mjs`                                                                                                                                           | QA item 15                                                      |
| Testes de integração             | `npm run testar:integracao` roda com `--passWithNoTests` e `testes/integracao/` está vazia. Cobrir repositórios contra o Supabase local                                                                                                              | [qualidade/plano-de-testes.md](../qualidade/plano-de-testes.md) |
| Verificação manual no celular    | Câmera, leitura do QR da NFC-e e remoção de GPS/EXIF da foto (HU-17) em Android e iPhone reais. Os E2E rodam só no Chromium de desktop                                                                                                               | HU-17, RNF-24                                                   |

## v1.1 — fontes de dados

- **Religar o Open Finance (Pluggy)** se o custo fizer sentido. O código, os testes e o passo a passo já existem ([operacao.md](../operacao.md), seção 7). Antes: gerar novo Client Secret e confirmar o plano com a Pluggy.
- Importar extrato em **CSV** além de OFX ([ADR 0016](../arquitetura/decisoes/0016-extrato-ofx-e-comprovantes-com-ia.md)).

## v2 — Rastro como produto

- **Multiempresa**: o banco já separa tudo por `empresa_id` com RLS ([ADR 0006](../arquitetura/decisoes/0006-multiempresa-rls.md)). Falta a interface para criar e trocar de empresa, convidar membros e papéis, atrás de `RECURSO_MULTIEMPRESA`.
- **Planos pagos**: cobrança, limites por plano (comprovantes por mês, usuários, empresas) e página pública. Depende de multiempresa e de Vercel Pro + Supabase Pro ([especificacao/viabilidade.md](../especificacao/viabilidade.md)).
- Verificar marca no INPI e domínio antes de divulgar.

O que ficou de fora de propósito está em [especificacao/fora-do-escopo.md](../especificacao/fora-do-escopo.md).
