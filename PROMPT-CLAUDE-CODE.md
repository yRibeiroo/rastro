# Missão: construir o Rastro v1 do início ao fim, de forma autônoma

Você é o **líder técnico** de uma pequena software house. Sua missão é entregar a **versão 1 do Rastro**, o sistema de controle financeiro da minha empresa (HOMETEC SERVIÇOS), funcionando em produção. Trabalhe de forma **autônoma, sem me interromper**. Só pare para algo **irreversível** ou que **exija minha conta ou senha**. Mesmo nesses casos, não espere: deixe um marcador, siga com o resto do trabalho e junte todas as pendências num único checklist no final.

Antes de qualquer coisa, leia nesta pasta:
- `CONTEXTO.md`: todo o histórico, as decisões e os aprendizados técnicos do projeto. **É a sua "entrevista" com o cliente.**
- `Rastro.png`: a identidade visual (logo e cores). **É a fonte da verdade visual.**
- Os arquivos Python (`app.py`, `sync.py`, `db.py`, `pluggy_client.py`, `register_webhook.py`) e `frontend/OpenFinanceConnect.tsx`: um protótipo em Flask já testado. Mova tudo para `prototipo-flask/` e use como **referência de regras de negócio**. Não é para manter essa stack.

---

## 1. Sua equipe (subagentes)

Crie os subagentes em `.claude/agents/`, cada um num arquivo `.md` com papel, responsabilidades, ferramentas permitidas e critério de "pronto". Delegue o trabalho a eles e integre o resultado. Nenhum agente aprova o próprio trabalho.

| Agente | Responsabilidade | Entregáveis |
|---|---|---|
| **analista-de-requisitos** | Estudo de viabilidade, elicitação a partir do `CONTEXTO.md`, requisitos funcionais (RF) e não funcionais (RNF), histórias de usuário com critérios de aceite, riscos | `documentos/especificacao/` |
| **designer-ux-ui** | Pesquisa de referências, fluxos, wireframes, protótipo navegável, design system derivado do `Rastro.png`, animação de entrada e de carregamento, acessibilidade | `documentos/design/` e `src/identidade-visual/` |
| **arquiteto-de-software** | Arquitetura, ADRs (registros de decisão), modelagem de dados, contratos entre módulos, revisão de acoplamento e coesão | `documentos/arquitetura/` |
| **engenheiro-de-dados** | Esquema no Supabase, migrações versionadas, RLS, índices, seeds de desenvolvimento | `banco-de-dados/` |
| **engenheiro-backend** | Integração com Pluggy, webhooks, sincronização, categorização com IA, regras de negócio | `src/regras-de-negocio/` e `src/app/api/` |
| **engenheiro-frontend** | Telas, componentes, estados (carregando/vazio/erro), responsividade, performance | `src/app/` e `src/componentes/` |
| **engenheiro-de-qualidade (QA)** | Plano de testes, testes de unidade, integração e ponta a ponta, acessibilidade, **revisão de código obrigatória** antes de cada merge | `testes/` e `documentos/qualidade/` |
| **engenheiro-devsecops** | Git, CI/CD, varredura de segredos, variáveis de ambiente, deploy na Vercel, infraestrutura como código | `.github/`, `vercel.json`, `supabase/` |
| **redator-tecnico** | README, guia de operação, changelog, matriz de rastreabilidade sempre atualizada | `documentos/` |

**Fluxo de trabalho:** o líder técnico quebra o trabalho em tarefas. Cada tarefa passa por especificação, implementação, **revisão do QA**, testes verdes e merge. Divergências entre agentes viram um ADR com a decisão e o motivo.

---

## 2. Ciclo de vida (siga estas fases em ordem)

### Fase 1 — Especificação
1. **Estudo de viabilidade** (técnica, econômica e operacional): custos de Pluggy, Supabase, Vercel e API do Claude no volume de uma empresa pequena; limites dos planos gratuitos; riscos regulatórios (LGPD, dados financeiros).
2. **Elicitação**: use o `CONTEXTO.md` como transcrição da entrevista com o cliente. Onde houver lacuna, **assuma a opção mais razoável, registre em `documentos/especificacao/premissas.md` e siga**. Não pare para perguntar.
3. **Requisitos**: RF e RNF numerados (`RF-01`, `RNF-01`...), histórias de usuário com critérios de aceite no formato Dado/Quando/Então e o que fica **fora do escopo** da v1.
4. **Análise de riscos**: matriz de probabilidade x impacto, com mitigação para cada risco.

### Fase 2 — Desenvolvimento
1. **Protótipo** navegável das telas principais antes de codar a lógica (pode ser a própria aplicação com dados falsos). O designer valida contra os requisitos.
2. **Arquitetura e ADRs**, depois a implementação em pequenas entregas incrementais, cada uma com commit e teste.

### Fase 3 — Validação
Testes automatizados verdes, critérios de aceite de **cada** história verificados, auditoria de acessibilidade e performance, revisão de segurança e deploy em produção funcionando com o sandbox da Pluggy.

### Fase 4 — Evolução
Deixe pronto `documentos/evolucao/roteiro.md` com o caminho até a **versão comercial** (multiempresa, planos, cobrança), a dívida técnica conhecida e um guia de manutenção.

---

## 3. Escopo da v1

**Usuário:** só eu. Login obrigatório, com o e-mail permitido definido numa variável de ambiente (`EMAIL_AUTORIZADO`). Qualquer outro e-mail é recusado.

**Funcionalidades:**
1. **Entrada no sistema**: animação de abertura com a logo, seguida do login (Supabase Auth com link mágico por e-mail).
2. **Conectar banco**: widget Pluggy Connect para a conta PJ do Sicredi (conector *Sicredi Empresas*, via Open Finance), com o status da conexão visível e opção de reconectar quando o consentimento expirar.
3. **Extrato**: transações sincronizadas automaticamente por webhook, com busca, filtros (período, categoria, centro de custo, entrada/saída) e quem pagou ou recebeu.
4. **Categorização inteligente**: primeiro regras (ex.: descrição com "POSTO" vira Combustível). O que sobrar vai para a **API do Claude** (use o modelo mais recente disponível; confira na documentação da Anthropic). Quando eu corrigir uma categoria, ofereça transformar a correção em regra.
5. **Centros de custo**: Ar-condicionado/Refrigeração, Elétrica, Prevenção contra incêndio e Administrativo. Cada transação pode ser atribuída a um deles.
6. **Painel**: entradas x saídas por mês, gastos por categoria, resultado por centro de custo (qual serviço dá lucro) e saldo atual. Siga boas práticas de visualização de dados.
7. **Anexos opcionais**: nota fiscal ou comprovante só quando eu quiser (Supabase Storage, bucket privado).

**Fora da v1:** multiusuário, planos e cobrança, app mobile nativo. Mas **deixe a arquitetura pronta para isso** (ver seção 6).

---

## 4. Stack (caminho pavimentado)

- **Next.js** (App Router) + **TypeScript estrito** + **Tailwind CSS**, com deploy na **Vercel**.
- **Supabase**: Postgres, Auth, Storage e RLS. Migrações via **Supabase CLI** (`supabase/migrations`).
- **Pluggy**: SDK oficial Node (`pluggy-sdk`) no servidor e `react-pluggy-connect` no cliente.
- **Webhook da Pluggy** num Route Handler (`src/app/api/webhooks/pluggy/route.ts`). Responda 2XX em menos de 10 s e processe depois com `after()` do Next.js.
- **Testes**: Vitest (unidade e integração), Playwright (ponta a ponta), axe-core (acessibilidade) e Lighthouse CI.
- **Animações**: `thinking-orbs` (carregamento) + Motion/Framer Motion ou CSS/SVG (abertura).

Porte para TypeScript **todas as regras e aprendizados** do `prototipo-flask/` e da seção 4 do `CONTEXTO.md`:
- autenticação do webhook pelo header `Authorization: Bearer <segredo>`, porque a Pluggy não assina webhooks;
- deduplicação por `eventId`;
- não usar `webhookUrl` no Connect Token;
- tratar `item/created`, `item/updated`, `item/error` e `transactions/created`, `transactions/updated` e `transactions/deleted`;
- consultar `GET /items/{id}` como fonte da verdade;
- validar no servidor que o `itemId` pertence à aplicação;
- valor negativo = saída;
- nunca sobrescrever a categoria definida pelo usuário numa ressincronização.

---

## 5. Design: impecável e inovador

**Identidade visual:**
- Extraia a paleta **programaticamente** do `Rastro.png` (cores dominantes) e gere tokens de design (`--cor-primaria`, etc.), com variações claras e escuras que passem em **contraste WCAG AA**.
- Vetorize a logo para SVG (ex.: potrace). Se o resultado ficar ruim, redesenhe o SVG fielmente à imagem.
- Tipografia com personalidade e boa leitura de números (algarismos tabulares nos valores em R$).
- **Modo claro e escuro.** Use o carregador de skill `frontend-design` se estiver disponível.
- Fuja do visual de template genérico de dashboard. O conceito é **"rastro"**: trilhas, caminhos, o fluxo do dinheiro. Use isso nas transições e microinterações (ex.: o valor deixando um rastro ao entrar numa categoria).

**Animação de entrada (com a logo):**
- Na primeira visita da sessão, a logo se **desenha** (traçado SVG) e deixa um rastro de luz que se dissolve na tela de login ou no painel.
- Duração de no máximo **2,5 s**, com botão "pular", e só uma vez por sessão.
- Respeite `prefers-reduced-motion` (nesse caso, só um fade simples).
- Não pode atrasar o carregamento real: a animação roda **enquanto** os dados carregam.

**Carregamento (preferência pessoal obrigatória):** use **thinking-orbs** (`npm install thinking-orbs@0.3.1`, licença MIT) em **todos** os estados de carregamento, escolhendo o estado do orbe pelo contexto:

| Situação | Estado do orbe |
|---|---|
| Conectando ao banco (Pluggy) | `connecting` |
| Sincronizando transações | `searching` |
| IA categorizando | `solving` |
| Gerando o painel | `weaving` |
| Carregamento genérico | `working` |
| Aguardando sem atividade | `breathing` |

- Use `size={64}` para telas e blocos e `size={20}` para inline e botões.
- Use `theme="auto"` acompanhando o modo claro/escuro.
- Sempre com `aria-label` em português.
- Os orbes são monocromáticos. Se precisar da cor da marca, aplique no contêiner (halo ou fundo), sem modificar a biblioteca.
- Crie um componente único `<Carregando contexto="sincronizando" />` que mapeia contexto para estado, para todo o app usar o mesmo padrão.

**Qualidade de UX:**
- Todo componente com estados de **carregando, vazio, erro e sucesso** desenhados.
- Mobile-first, totalmente responsivo e navegável por teclado.
- Textos em português do Brasil, valores em `pt-BR` (R$ 1.234,56) e datas no fuso `America/Araguaina`.

---

## 6. Arquitetura e princípios

- **Integridade conceitual**: um glossário único (`documentos/arquitetura/glossario.md`) com os termos Conexão, Transação, Categoria, Regra, Centro de custo e Empresa, usados igual no código, no banco e na interface.
- **Separação de interesses / dividir para conquistar**: a interface não fala com a Pluggy nem com o banco diretamente. Ela passa por módulos de regra de negócio, e cada módulo tem uma interface pública clara.
- **Alta coesão, baixo acoplamento**: a Pluggy fica atrás de um adaptador (`ProvedorBancario`), para trocar de agregador sem mexer no resto. O mesmo vale para o provedor de IA (`Classificador`). Use padrões de projeto onde fizer sentido (Adapter, Strategy para as regras de categorização, Repository para o acesso a dados) e registre cada um num ADR.
- **Pronto para comercializar**: todas as tabelas de negócio com `empresa_id` e **RLS** filtrando pela empresa do usuário, mesmo com uma única empresa hoje. Funcionalidades futuras atrás de feature flags simples.
- **Segurança**:
  - chaves `service_role`, Pluggy e Anthropic **apenas no servidor**;
  - RLS em **todas** as tabelas;
  - bucket de anexos privado com URLs assinadas;
  - validação de entrada com Zod;
  - cabeçalhos de segurança (CSP etc.);
  - rate limit nas rotas sensíveis;
  - logs sem dados sensíveis.

---

## 7. Nomes de pastas humanizados

**Nada de** `utils`, `helpers`, `lib`, `misc`, `common`, `stuff`, `services2`. Use nomes em português que eu usaria. As exceções são os nomes que o framework **exige** (`src/app`, `public`, `supabase`, `.github`), e as rotas da URL também ficam em português.

Estrutura sugerida (ajuste se precisar e justifique num ADR):
```
rastro/
├── src/
│   ├── app/                      # rotas (exigido pelo Next.js)
│   │   ├── (entrada)/entrar/     # login
│   │   ├── painel/
│   │   ├── extrato/
│   │   ├── categorias/
│   │   ├── centros-de-custo/
│   │   ├── conexoes-bancarias/
│   │   └── api/webhooks/pluggy/
│   ├── componentes/              # peças de interface reutilizáveis
│   ├── identidade-visual/        # tokens, logo SVG, animação de abertura, <Carregando/>
│   ├── regras-de-negocio/
│   │   ├── conexao-bancaria/     # adaptador Pluggy
│   │   ├── extrato/              # sincronização
│   │   ├── categorizacao/        # regras + IA
│   │   └── centros-de-custo/
│   ├── acesso-a-dados/           # repositórios Supabase
│   └── ferramentas-internas/     # formatação de moeda/data, validações
├── banco-de-dados/seeds/
├── supabase/migrations/
├── testes/{unidade,integracao,ponta-a-ponta}/
├── documentos/{especificacao,design,arquitetura,qualidade,evolucao}/
└── prototipo-flask/              # referência, não roda em produção
```

---

## 8. Versionamento e DevSecOps

1. `git init` com a branch `main` protegida por convenção. Trabalhe em branches `funcionalidade/…`, `correcao/…` e `documentacao/…`, com merge só depois da revisão do QA e de testes verdes.
2. **Commits pequenos** no padrão Conventional Commits, com mensagens em português (`feat: adiciona painel por centro de custo`).
3. **`.env` NUNCA vai para o git:**
   - o `.gitignore` cobre `.env`, `.env.*` (exceto `.env.example`), `node_modules`, `.next`, `.vercel` e `supabase/.temp`;
   - instale **gitleaks** (ou similar) como **hook de pre-commit** e também no CI;
   - antes do **primeiro** commit, rode `git status` e confirme que nenhum segredo está sendo versionado;
   - o `.env.example` lista todas as variáveis **sem valores**.
4. **CI (GitHub Actions)**: lint, checagem de tipos, testes de unidade e integração (Supabase local), build, Playwright, Lighthouse CI e varredura de segredos. Se qualquer passo falhar, o merge fica bloqueado.
5. **Infraestrutura como código**: `supabase/config.toml` + migrações, `vercel.json` e workflows versionados. Um comando sobe o ambiente local inteiro (`npm run dev:completo`, que levanta o Supabase local + Next).
6. **GitHub**: crie o repositório **privado** `rastro` com `gh` se eu estiver autenticado. Se não estiver, deixe tudo pronto e coloque o comando no checklist final.
7. **Deploy**:
   - Vercel com preview por branch e produção a partir da `main`;
   - variáveis de ambiente cadastradas na Vercel, **nunca** no código;
   - migrações aplicadas no Supabase de produção;
   - webhook da Pluggy registrado na URL de produção com o header secreto (porte o `register_webhook.py` para um script `npm run registrar-webhook`).

---

## 9. Qualidade e garantia

- **Testes de unidade**: categorização, regras, formatação, mapeamento Pluggy para transação e validação do webhook. Cobertura mínima de **80% nas regras de negócio**.
- **Testes de integração**: rotas de API com Supabase local e Pluggy simulada (fixtures realistas, incluindo ids UUID e eventos duplicados), além de RLS testada (um usuário de outra empresa **não** vê nada).
- **Testes de sistema / ponta a ponta (Playwright)**: login, conectar banco no sandbox, ver o extrato, recategorizar e ver o painel atualizar.
- **Não funcionais**:
  - acessibilidade sem violações graves no axe;
  - Lighthouse ≥ 90 em performance, acessibilidade e boas práticas;
  - animação de entrada sem bloquear o primeiro carregamento.
- **Revisão de código**: o QA revisa cada branch com um checklist (segurança, nomes, acoplamento, testes, acessibilidade) e registra a revisão em `documentos/qualidade/revisoes.md`.

---

## 10. Documentação e rastreabilidade

- `README.md`: o que é o Rastro, como rodar localmente, como fazer o deploy e a lista de variáveis de ambiente.
- `documentos/rastreabilidade.md`: **matriz** ligando cada requisito (RF/RNF) às histórias, aos arquivos de código e aos testes que o verificam, com o status. Atualize a cada merge. Nenhum requisito pode ficar sem teste.
- ADRs numerados em `documentos/arquitetura/decisoes/`.
- `CHANGELOG.md` com versionamento semântico. Esta entrega é a **v1.0.0**.
- Atualize o `CONTEXTO.md` ao final com o novo estado do projeto.

---

## 11. Definição de pronto (só termine quando tudo for verdade)

- [ ] Todas as histórias da v1 com critérios de aceite verificados
- [ ] CI 100% verde e cobertura ≥ 80% nas regras de negócio
- [ ] Nenhum segredo no histórico do git (gitleaks limpo)
- [ ] App em produção na Vercel, funcionando com o sandbox da Pluggy
- [ ] Animação de entrada com a logo + thinking-orbs em todos os carregamentos
- [ ] Modo claro e escuro, responsivo, acessível
- [ ] Matriz de rastreabilidade completa, ADRs, README e roteiro de evolução
- [ ] **Checklist final para mim** em `documentos/PARA-O-DAVI.md`, com tudo o que só eu posso fazer: logins (GitHub, Vercel, Supabase), colar credenciais na Vercel, **gerar um novo Client Secret na Pluggy** (o atual vazou num print), trocar o sandbox pela conta real do Sicredi e verificar a marca no INPI

Ao terminar, me mostre: a URL de produção, um resumo do que foi construído, as premissas que você assumiu e o checklist do `PARA-O-DAVI.md`.
