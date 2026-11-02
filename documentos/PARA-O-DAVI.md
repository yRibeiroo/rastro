# Para o Davi: o que falta fazer

O Rastro v1.0.0 está pronto no GitHub (repositório privado **yRibeiroo/rastro**). Falta colocá-lo no ar e testar com dados reais. Siga na ordem. Cada passo diz onde clicar. Detalhes técnicos estão em [operacao.md](operacao.md).

## 1. Publicar na Vercel

- [ ] Abra [vercel.com/new](https://vercel.com/new), entre com o GitHub e **importe o repositório `yRibeiroo/rastro`**. Não mude nada nas configurações de build.
  - Alternativa: no Claude Code, digite `! npx vercel login`, faça o login no navegador e peça ao Claude para fazer o resto. (O conector da Vercel deu erro 403 neste time, por isso não foi feito automaticamente.)
- [ ] Antes de clicar em **Deploy**, abra **Environment Variables** e cadastre as variáveis da [seção 1 do operacao.md](operacao.md#1-variáveis-na-vercel):
  - Cole os segredos (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `EMAIL_AUTORIZADO`) direto do painel de cada serviço. Não mande segredos por chat nem e-mail.
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://sdglxhgxofttirwfuzlh.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = a chave que começa com `sb_publishable_`, no Supabase em **Settings → API Keys**.
  - `RECURSO_OPEN_FINANCE` = `0`; as demais flags como na tabela.
- [ ] Clique em **Deploy**. Ao terminar, copie a URL de produção (algo como `https://rastro-xxxx.vercel.app`).
- [ ] Volte em **Settings → Environment Variables**, cadastre `URL_DO_SITE` = essa URL (sem barra no fim) e faça **Redeploy** em **Deployments → ⋯**.

## 2. Ajustar o Supabase

- [ ] No painel do Supabase, abra o projeto, vá em **SQL Editor**, cole todo o conteúdo do arquivo [`supabase/migrations/20261009120600_eventos_webhook_e_limites.sql`](../supabase/migrations/20261009120600_eventos_webhook_e_limites.sql) e clique em **Run**. É a única migração que não foi aplicada automaticamente; sem ela o login falha no limite de requisições.
- [ ] **Authentication → URL Configuration**:
  - **Site URL** = a URL da Vercel.
  - **Redirect URLs** = a URL da Vercel e a URL da Vercel + `/entrar/confirmar`.
- [ ] **Authentication → Emails → SMTP Settings**: configure um SMTP próprio (ex.: Resend, que tem plano gratuito). O envio padrão do Supabase manda pouquíssimos e-mails por hora e só para membros do time.
- [ ] Entre no Rastro com seu e-mail e confira se o link mágico chega.

## 3. Testar com um extrato de verdade

- [ ] No Sicredi Internet (conta PJ), exporte o extrato do último mês em formato **OFX**.
- [ ] No Rastro, vá em **Importar**, envie o arquivo e confira se o saldo e os lançamentos batem com o banco.
- [ ] Corrija algumas categorias e aceite as sugestões de regra.

## 4. Testar no celular

- [ ] Abra a URL no celular, entre e, em **Comprovantes**, tire foto de um comprovante Pix e de uma nota.
- [ ] Teste a leitura do **QR code de uma NFC-e** (cupom fiscal).
- [ ] Confira se os dados lidos e a conciliação com o extrato fazem sentido.

## 5. Decidir os planos pagos antes de dados reais

- [ ] **Vercel Pro** (US$ 20/mês): o plano gratuito proíbe uso comercial.
- [ ] **Supabase Pro** (US$ 25/mês): o gratuito não tem backup automático e pausa o projeto parado.
- Custo total estimado: cerca de US$ 52/mês (≈ R$ 286). Detalhes em [especificacao/viabilidade.md](especificacao/viabilidade.md).
- Enquanto ficar no gratuito, faça o backup manual da [seção 3 do operacao.md](operacao.md#3-backup).

## 6. Pluggy (só se for religar o Open Finance)

- [ ] No painel da Pluggy, **gere um novo Client Secret**. O anterior apareceu num log desta sessão e deve ser considerado vazado.
- [ ] Siga a [seção 7 do operacao.md](operacao.md#7-religar-o-open-finance-pluggy). Lembre que a Pluggy em produção custa no mínimo R$ 2.500/mês.

## 7. Marca e domínio

- [ ] Pesquise "Rastro" no [INPI](https://busca.inpi.gov.br) (classes 9 e 42).
- [ ] Verifique e registre um domínio (ex.: rastro.com.br, rastro.app). Depois, adicione-o na Vercel em **Settings → Domains** e atualize `URL_DO_SITE` e as URLs do Auth no Supabase.

## 8. Limpeza

- [ ] Apague a pasta antiga do projeto em `OneDrive\Área de Trabalho\VscodeProjects\rastro`. O projeto agora vive em `C:\projetos\rastro`.

## 9. Opcional

- [ ] Proteção da branch `main` (exigir CI verde antes do merge) precisa do **GitHub Pro** em repositório privado. Veja [qualidade/ci.md](qualidade/ci.md).
