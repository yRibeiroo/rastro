# Rastro — instruções para o Claude

Controle financeiro da empresa do Davi. Vai para o portfólio do **Programa de Estágio GenAI do iFood (trilha AI Builder)**, prazo **17/11/2026**. Objetivo: MVP pequeno, completo, publicado e bem documentado.

@AGENTS.md

## Stack real

Next.js 16 (App Router, TypeScript estrito, Tailwind 4) + Supabase (Postgres com RLS, Auth, Storage) + Vercel + API do Claude. Não há Flask nem React separado: o protótipo Flask ficou em `prototipo-flask/` só como referência. **Adapte-se ao que existe; não reescreva.**

- Regras de negócio em `src/regras-de-negocio/`, acesso a dados em `src/acesso-a-dados/`, telas em `src/app/`.
- Nomes de arquivos, funções e commits em português.
- Decisões de arquitetura: `documentos/arquitetura/decisoes/` (ADRs).
- Migrações em `supabase/migrations/`. **Não rodam no deploy**: são aplicadas à parte em produção.

## Rotina de trabalho (vale para toda sessão)

### A. Revisar o GitHub antes de qualquer atualização

Antes de editar qualquer arquivo, instalar dependência ou fazer commit:

1. Rode `git fetch` e `git status`.
2. Confira a branch atual e se há mudanças locais não commitadas.
3. Compare com o remoto (`git log HEAD..origin/<branch>`).
   - Se o remoto estiver à frente, rode `git pull --rebase` antes de começar.
   - Se houver conflito, **pare e mostre ao Davi**; não resolva sozinho.
4. Se o `gh` estiver disponível, liste as issues e PRs abertos que tenham relação com a tarefa.
5. Diga em uma linha o estado do repositório antes de começar.

Depois de cada mudança:

- Revise o diff (`git diff`) antes do commit.
- Confira que nenhum segredo ou dado real entrou (`npm run segredos`).
- Faça commits pequenos com mensagens claras em português.
- Só dê push depois de avisar o Davi.

### B. Salvar o contexto no Obsidian

Vault: `C:\Users\davil\OneDrive\Documentos\Obsidian Vault`. Pasta do projeto: `Projetos/Rastro/` (crie o que não existir).

- **No início de toda sessão**, leia `Projetos/Rastro/Contexto.md` e a nota de diário mais recente.
- **Ao fim de cada fase, ou antes de encerrar a sessão**, atualize:
  - `Contexto.md` — visão geral, stack real, arquitetura, status de cada item do escopo, próximos passos. Sempre atual: substitua o que mudou em vez de acumular texto.
  - `Diario/AAAA-MM-DD.md` — o que foi feito, problemas, como foram resolvidos, commits (hash e mensagem).
  - `Decisoes.md` — cada decisão técnica importante: data, o que, por quê, alternativas descartadas.
  - `Pendencias.md` — checklist (`- [ ]`) do que falta até 17/11.
- Formato: Markdown compatível com Obsidian, frontmatter com `tags: [rastro]` e `atualizado: AAAA-MM-DD`, links `[[Contexto]]`, `[[Decisoes]]` etc.
- **Nunca** salve no Obsidian chaves, tokens, senhas ou dados financeiros reais da empresa.

## Escopo do MVP

1. **Extrato automático** — transações gravadas no Supabase, sincronização idempotente, disparo manual e por agendamento.
2. **Categorização com IA** — saída estruturada (categoria, confiança, justificativa curta); aprende com as correções (regra + exemplo); só manda ao LLM o que não tem regra.
3. **Dashboard publicado na Vercel** — para onde foi o dinheiro, gastos por categoria, entradas e saídas, saldo ao longo do tempo, lista com filtro e edição de categoria.
4. **Agente financeiro** — chat com tool use do Claude, **ferramentas pré-definidas e somente leitura**. **Nunca gera SQL livre.** As respostas citam os números e o período consultado.
5. **Extra (só se sobrar tempo)** — resumo semanal automático.

## Regras obrigatórias

- **Dados reais da empresa nunca aparecem na demo pública, no repositório nem nas notas do Obsidian.**
  - A demo usa o sandbox da Pluggy ou um seed de transações fictícias e realistas de uma empresa de climatização.
  - A conta real só funciona na versão privada, controlada por variável de ambiente.
- Todas as chaves (Pluggy, Supabase, Anthropic) ficam em `.env.local`. Mantenha o `.env.example` atualizado e confira que o `.gitignore` cobre os segredos antes de qualquer commit.
- Supabase com RLS ativado e acesso restrito ao Davi. A versão demo é somente leitura.
- Uma funcionalidade por vez, testando antes de seguir.
- Ao fim de cada fase: (1) atualize o Obsidian; (2) pare e mostre o que foi feito, como testar e o que vem a seguir.
- Se algo travar (limite da Pluggy, erro de deploy, conflito no Git), explique o problema e as opções em vez de contornar em silêncio.
- Não invente números na seção "Impacto" do README: pergunte ao Davi.
