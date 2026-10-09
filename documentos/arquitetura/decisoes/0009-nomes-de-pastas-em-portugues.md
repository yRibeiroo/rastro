# ADR 0009 — Nomes de pastas, arquivos e símbolos em português

**Status:** Aceita (2026-10-09)

## Contexto
O PROMPT §7 pede nomes humanizados em português e proíbe `utils`, `helpers`, `lib`, `misc`, `common`. O glossário (integridade conceitual) exige o mesmo termo no código, no banco e na interface. O Next.js e as ferramentas exigem alguns nomes fixos.

## Decisão
- Pastas, arquivos, tipos, funções, tabelas e colunas em **português sem acento** (`regras-de-negocio`, `Transacao`, `centros_de_custo`). Rotas da URL em português (`/conexoes-bancarias`).
- Arquivos em `kebab-case`, tipos em `PascalCase`, funções em `camelCase`, banco em `snake_case`.
- Exceções obrigatórias: `src/app`, `public`, `supabase`, `.github`, `node_modules`, `proxy.ts`, `route.ts`, `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, arquivos de configuração na raiz, e nomes de APIs externas (`after`, `PluggyClient`).
- Ajustes à árvore do PROMPT (detalhados em [estrutura-de-pastas.md](../estrutura-de-pastas.md)): grupos `(entrada)` e `(sistema)`, `src/proxy.ts`, `src/configuracao/`, `comandos/`, `adaptadores/` dentro dos módulos e `acoes.ts` ao lado das páginas.
- Termos do provedor (`item`, `account`) só dentro do adaptador.

## Consequências
- (+) O dono do negócio lê a árvore e entende. Os termos batem com a interface.
- (−) Mistura inevitável com nomes do framework e de bibliotecas (`useState`, `after`).
- (−) Desenvolvedores externos precisam do glossário.

## Alternativas consideradas
- **Inglês no código, português na interface**: padrão de mercado, mas quebra a integridade conceitual pedida e gera traduções divergentes.
