# ADR 0010 — Feature flags simples por variável de ambiente

**Status:** Aceita (2026-10-09)

## Contexto
O PROMPT pede funcionalidades futuras atrás de feature flags simples. Também precisamos de um "interruptor" de custo para a IA e de um jeito de desligar os anexos sem novo deploy de código.

## Decisão
- `src/configuracao/recursos.ts` lê variáveis `RECURSO_*` (valores `'1'`/`'0'`, validadas com Zod) **no servidor** e exporta um objeto congelado:

| Flag | Padrão | Efeito |
|---|---|---|
| `RECURSO_CATEGORIZACAO_IA` | `1` | `0` pula a `EstrategiaPorIa` (regras e provedor continuam) |
| `RECURSO_ANEXOS` | `1` | `0` esconde "Anexar" e o serviço lança `recurso_desligado` |
| `RECURSO_MULTIEMPRESA` | `0` | Reservado: seletor de empresa e convites (roteiro comercial) |

- As flags são lidas no servidor e passadas como props quando a interface precisa (sem `NEXT_PUBLIC_`).
- Mudar uma flag = mudar a variável na Vercel + redeploy (sem mudança de código).
- Não criar flag sem uso real. Flag sem uso por 2 versões é removida.

## Consequências
- (+) Zero dependência e zero custo. Fácil de testar (injetar a configuração).
- (−) Exige redeploy para mudar e não permite ligar por empresa. Quando o SaaS precisar, migrar para uma tabela `recursos_da_empresa` ou para o Vercel Flags.

## Alternativas consideradas
- **LaunchDarkly / Vercel Flags / Edge Config**: poderosos, mas são mais um serviço para uma necessidade que hoje cabe em 3 variáveis.
- **Tabela no banco**: por empresa, mas desnecessária com uma empresa só.
