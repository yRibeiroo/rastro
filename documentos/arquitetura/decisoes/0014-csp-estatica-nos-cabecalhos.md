# ADR 0014 — CSP estática no `next.config.ts` (sem nonce) e cabeçalhos de segurança

**Status:** Aceita (2026-10-09)

## Contexto
O PROMPT §6 pede cabeçalhos de segurança, incluindo CSP. O Next 16 oferece dois caminhos (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`):

1. **Nonce por requisição no `proxy.ts`**: permite `script-src 'nonce-…' 'strict-dynamic'` sem `'unsafe-inline'`, mas exige renderização dinâmica de **todas** as páginas. A documentação diz que o Partial Prerendering é **incompatível** com nonce, porque o shell estático não recebe o nonce da requisição.
2. **CSP estática em `headers()` do `next.config.ts`**: compatível com páginas estáticas e com o shell pré-renderizado, mas precisa de `'unsafe-inline'` em `script-src`, porque o Next injeta scripts inline (payload do RSC e hidratação).

O projeto usa `cacheComponents: true` e `partialPrefetching: true` (shell estático + streaming). O `src/proxy.ts` pertence à autenticação (ADR 0008) e tem um matcher que exclui rotas. Existe também o SRI experimental (`experimental.sri`), mas ele só cobre scripts externos: os inline do Next continuam exigindo nonce ou `'unsafe-inline'`.

Terceiros que a página precisa liberar (verificado em `node_modules`):
- **Pluggy Connect** (`react-pluggy-connect` → `pluggy-connect-sdk`, que usa `zoid`): abre um **iframe** de `https://connect.pluggy.ai` (constante `CONNECT_PRODUCTION_URL`), injeta um `<style>` inline no container e reconhece callbacks de OAuth em `https://api.pluggy.ai`. O OAuth do Open Finance abre o banco em **popup**, que conversa com a janela por `postMessage`. Os logos dos conectores vêm de `*.pluggy.ai`.
- **Supabase**: a origem de `NEXT_PUBLIC_SUPABASE_URL` (REST, Storage e URLs assinadas de anexos) e a mesma origem em `wss://` para o Realtime.
- **Fontes**: `next/font` hospeda as fontes no próprio domínio, então `font-src 'self'` basta.
- **motion**: escreve `style` inline nos elementos, então `style-src` precisa de `'unsafe-inline'` de qualquer forma.

## Decisão
CSP **estática**, montada em `next.config.ts` e aplicada a todas as rotas (`/:path*`):

```
default-src 'self';
script-src 'self' 'unsafe-inline' ['unsafe-eval' só em dev];
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data: https://*.pluggy.ai <supabase>;
font-src 'self';
connect-src 'self' https://api.pluggy.ai <supabase> <supabase em wss>;
frame-src 'self' https://connect.pluggy.ai https://*.pluggy.ai;
worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
upgrade-insecure-requests [só na Vercel, onde VERCEL=1]
```

Outros cabeçalhos:

| Cabeçalho | Valor | Por quê |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Força HTTPS por 2 anos. Sem `preload` até haver domínio próprio |
| `X-Content-Type-Options` | `nosniff` | Bloqueia MIME sniffing |
| `X-Frame-Options` | `DENY` | Anti-clickjacking em navegadores antigos (`frame-ancestors 'none'` nos novos) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Não vaza caminho nem query para terceiros |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Isola a janela sem quebrar o popup de OAuth do banco |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` | Desliga APIs que o app não usa, inclusive para o iframe da Pluggy |
| `X-Powered-By` | removido (`poweredByHeader: false`) | Não anuncia a tecnologia |

A origem do Supabase é lida de `NEXT_PUBLIC_SUPABASE_URL` **no build**. Trocar de projeto Supabase exige novo deploy, o que já acontece porque as `NEXT_PUBLIC_` são embutidas no build. `upgrade-insecure-requests` fica fora do ambiente local e do CI, que acessam o Supabase em `http://127.0.0.1`.

## Consequências
- (+) Mantém `cacheComponents`/PPR, cache de CDN e performance (Lighthouse ≥ 90). Nenhuma página é forçada a ser dinâmica.
- (+) Bloqueia scripts, frames e conexões de origens não listadas, `<object>`, `<base>` forjado, envio de formulário para fora e a inclusão do app em outro site.
- (−) `'unsafe-inline'` em `script-src` reduz a proteção contra XSS. Mitigações: o React escapa por padrão; `dangerouslySetInnerHTML` com dado do usuário é proibido (checklist do QA); toda entrada passa por Zod; a sessão fica em cookie `HttpOnly`.
- (−) `https://*.pluggy.ai` é mais largo que o estritamente necessário. Foi preferido a quebrar o widget a cada mudança de subdomínio da Pluggy.
- Se o widget mudar de domínio, o sintoma é o modal em branco com violação de CSP no console. Ajuste a lista no `next.config.ts` e neste ADR.

## Alternativas consideradas
- **Nonce no `proxy.ts`**: CSP mais forte, mas incompatível com PPR/`cacheComponents`, obriga renderização dinâmica de tudo e acopla segurança ao proxy de autenticação. Reavaliar se o app passar a exibir conteúdo de terceiros (HTML de e-mail, anexos renderizados) ou se o SaaS exigir CSP estrita.
- **Hashes (`'sha256-…'`) dos scripts inline**: o payload do RSC muda por página e por deploy; inviável de manter.
- **CSP no `vercel.json`**: valeria só na Vercel. O `next.config.ts` vale também no `next start` (CI, Lighthouse, Playwright).
