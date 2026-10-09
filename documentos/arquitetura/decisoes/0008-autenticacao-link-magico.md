# ADR 0008 — Autenticação: link mágico do Supabase + allowlist `EMAIL_AUTORIZADO` + empresa criada no primeiro login

**Status:** Aceita (2026-10-09)

## Contexto
A v1 tem um único usuário. O login é obrigatório e qualquer outro e-mail deve ser recusado. O protótipo recebia `clientUserId` do corpo da requisição, o que é inseguro. Não queremos gerenciar senhas.

## Decisão
- **Supabase Auth com link mágico (OTP por e-mail)** via `@supabase/ssr`, com sessão em cookies.
- **Allowlist no servidor** (`EMAIL_AUTORIZADO`, lista separada por vírgulas, comparação após trim e minúsculas), verificada em **quatro** pontos:
  1. **Antes de enviar o link** (Server Action `enviarLinkMagico`): e-mail fora da lista não recebe e-mail, mas a resposta é a mesma ("Se o e-mail estiver autorizado, você receberá o link"), para não revelar a lista. Rate limit por IP e por e-mail (ADR 0011).
  2. **No callback** `GET /entrar/confirmar`: `exchangeCodeForSession(code)`. Se o e-mail da sessão não está na lista → `signOut()` e redireciona para `/entrar?erro=nao-autorizado`. Também valida o parâmetro `proximo` (só caminho relativo começando com `/` e sem `//`, contra open redirect).
  3. **No `src/proxy.ts`**: renova a sessão (`getClaims()`), redireciona para `/entrar` quem não está logado ou não está na lista. O matcher exclui `_next/static`, `_next/image`, arquivos públicos, `/api/webhooks/*`, `/api/tarefas/*` e `/entrar/*`.
  4. **Em toda Server Action, Route Handler interno e layout `(sistema)`**: `obterContextoDoUsuario()`. A documentação do Next 16 avisa que o proxy pode deixar Server Actions de fora por causa do matcher.
- **Empresa automática**: no callback, `rpc('garantir_empresa', { p_nome: 'Minha empresa' })` (idempotente, `security definer`) cria a empresa, a membership `dono` e as sementes (categorias, centros de custo e regras) se o usuário ainda não tiver empresa. O nome é editável depois.
- Nunca usar `getSession()` para decidir autorização no servidor. Usar `getClaims()`, que valida o JWT.
- No painel do Supabase: desligar o cadastro por senha, usar a URL de redirecionamento `URL_DO_SITE/entrar/confirmar` e um SMTP próprio no go-live (o SMTP padrão tem limite baixo). Isso entra no `PARA-O-DAVI.md`.

## Consequências
- (+) Sem senhas para vazar. A allowlist no servidor bloqueia até quem conseguir criar um usuário no Auth.
- (+) Pronto para multiusuário: basta trocar a allowlist por convites (`membros_empresa`).
- (−) Um usuário fora da lista ainda pode existir em `auth.users` se for criado por outro caminho. Ele não acessa nada (sem membership e com a allowlist barrando).
- (−) O link mágico depende da entrega de e-mail.

## Alternativas consideradas
- **Senha + e-mail**: mais atrito e mais risco.
- **OAuth (Google)**: depende de conta Google e do console de OAuth. Pode entrar depois como opção.
- **Allowlist só no proxy**: insuficiente, porque Server Actions e Route Handlers podem escapar do matcher.
