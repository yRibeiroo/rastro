# ADR 0017 — Cadastro aberto, perfil da conta (pessoal ou empresa) e roteiro da v2

**Status:** Aceita (2026-11-02)

## Contexto
O Rastro nasceu para a HOMETEC: um usuário, `EMAIL_AUTORIZADO` e sementes de categorias da HOMETEC (refrigeração, incêndio). A v2 abre o sistema para qualquer pessoa, física ou jurídica. Usamos como referência pública as funcionalidades de apps de finanças do mercado. Só olhamos o que é público (landing page, central de ajuda, documentação da API) e reimplementamos tudo com código próprio, sem copiar código nem visual.

## Decisão
- **Flag `RECURSO_CADASTRO_ABERTO`** (padrão `0`). Ligada, qualquer e-mail válido recebe o link e entra, inclusive no `proxy.ts`. Desligada, vale a allowlist (ADR 0008), e esse continua sendo o modo da HOMETEC. `EMAIL_AUTORIZADO` passa a ser opcional: lista vazia com o cadastro fechado significa que ninguém entra (fail-closed).
- **`empresas.perfil`** (`pessoal` | `empresa`, padrão `empresa`). As empresas existentes ficam como `empresa` e mantêm as sementes que já têm.
- **Sementes por perfil** em `privado.semear_por_perfil`:
  - pessoal: 22 categorias, 14 regras, sem centros de custo;
  - empresa: plano de contas genérico com 20 categorias, 3 centros e 12 regras.
  - `privado.semear_empresa(uuid)`, com as sementes da HOMETEC, continua existindo para o `seed.sql` e os testes.
- **`garantir_empresa(p_nome, p_perfil default 'empresa')`**. O perfil só vale na criação. Um perfil desconhecido gera `perfil_invalido` (22023).
- **Como o perfil chega ao callback:** com o cadastro aberto, o formulário de entrada pergunta "Pessoal" ou "Empresa". A Server Action grava um cookie `rastro_perfil` (httpOnly, `path=/entrar`, 1 h), que o callback lê, valida com `lerPerfil` e repassa. Assim não há página de onboarding nem redirecionamento no layout.

## Consequências
- (+) Abrir o sistema é só uma flag. O isolamento já existe (ADR 0006: `empresa_id` + RLS).
- (+) Nada muda para a HOMETEC com a flag desligada.
- (−) Quem abre o link em outro aparelho (sem o cookie) cai no padrão `empresa`. Mitigação futura: tela de configurações para trocar o perfil e ressemear.
- (−) O SMTP padrão do Supabase não aguenta cadastro aberto. Antes de ligar a flag em produção, é preciso configurar um SMTP próprio e captcha no Auth.

## Roteiro da v2 (próximas fases)
1. **Cadastro aberto + perfil**: esta ADR.
2. **Lançamentos e contas manuais**: conexão `provedor = 'manual'` por empresa, no mesmo padrão da conexão `arquivo` (ADR 0016). `transacoes` passa a aceitar insert pelo serviço (service role, filtrado por `empresaId`).
3. **Ocultar dos totais** (`transacoes.oculta`) e **OFX de qualquer banco**: o leitor já é genérico, falta validar com fixtures de outros bancos.
4. **Recorrências (contas a pagar e a receber) + saldo previsto**: fluxo de caixa projetado.
5. **Exportação CSV/XLSX** do extrato e dos relatórios.
6. **Limites por categoria** com alerta no painel.
7. Para o SaaS: convites e papéis (`membros_empresa`), troca de empresa (`RECURSO_MULTIEMPRESA`), planos e cobrança, assistente no WhatsApp. O Open Finance só volta quando houver receita (ADR 0016).

## Alternativas consideradas
- **Página de onboarding pós-login** (escolher o perfil se `perfil is null`): exige leitura e redirecionamento no layout `(sistema)`, que hoje é PPR/Suspense. Ficou mais código para o mesmo resultado.
- **Perfil na URL de retorno do link**: o template de e-mail com `token_hash` monta a própria URL e perderia o parâmetro, e a allowlist de URLs de redirecionamento do Supabase complica.
- **Uma semente só para todos**: categorias de empresa não servem para pessoa física, e vice-versa.
