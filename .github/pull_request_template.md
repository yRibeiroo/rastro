## O que muda

<!-- Uma ou duas frases. Ligue à história/requisito (documentos/especificacao). -->

## Como testar

<!-- Passos ou testes automatizados que cobrem a mudança. -->

## Checklist de revisão (QA)

### Segurança

- [ ] Nenhum segredo no diff; `npm run segredos` limpo
- [ ] Segredos só no servidor (`src/configuracao/ambiente.ts`), nada de `NEXT_PUBLIC_` com segredo
- [ ] Toda entrada validada com Zod; Server Actions e Route Handlers revalidam a sessão (`obterContextoDoUsuario`)
- [ ] Tabelas novas com `empresa_id` e RLS; caminho com service role filtra `empresaId`
- [ ] Logs sem token, e-mail completo, corpo de webhook ou descrição de transação
- [ ] Rate limit nas rotas sensíveis (ADR 0011); CSP não foi afrouxada sem ADR

### Nomes e arquitetura

- [ ] Pastas, arquivos e rotas em português, sem `utils`/`helpers`/`lib` (ADR 0009)
- [ ] Termos do glossário usados igual no código, banco e interface
- [ ] Interface não importa `acesso-a-dados`, `pluggy-sdk` nem `@anthropic-ai/sdk`; dependências só para baixo
- [ ] Decisão nova ou padrão novo registrado em ADR

### Testes

- [ ] Testes de unidade para regras novas; cobertura ≥ 80% em `src/regras-de-negocio`
- [ ] Integração (Supabase local) para repositório/rota/RLS alterados
- [ ] Ponta a ponta atualizado se o fluxo do usuário mudou

### Acessibilidade e interface

- [ ] Sem violações graves no axe; navegação por teclado e foco visível
- [ ] Contraste e textos alternativos; respeita `prefers-reduced-motion`
- [ ] Lighthouse ≥ 90 (performance, acessibilidade, boas práticas)

### Processo

- [ ] Commits no padrão Conventional Commits, em português
- [ ] CI verde; revisão registrada em `documentos/qualidade/revisoes.md`
