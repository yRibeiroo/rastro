# Changelog

Todas as mudanças relevantes do Rastro ficam registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [versionamento semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-10-11

Primeira versão. Reescreve o protótipo em Flask + SQLite (`prototipo-flask/`) como aplicação Next.js + Supabase + Vercel ([ADR 0001](documentos/arquitetura/decisoes/0001-nextjs-supabase-vercel.md)). Especificação em [documentos/especificacao/](documentos/especificacao/).

### Adicionado

- **Extrato OFX do Sicredi como fonte da verdade** ([ADR 0016](documentos/arquitetura/decisoes/0016-extrato-ofx-e-comprovantes-com-ia.md)). Tela `/importar`: o arquivo exportado do Sicredi Internet vira transações; reimportar o mesmo período não duplica nada nem mexe na categoria. A conta é criada na primeira importação, o saldo vem do arquivo e há histórico de importações e aviso de "extrato desatualizado".
- **Comprovantes lidos pelo Claude** (Pix, boleto, NFC-e, NF-e, recibo) por foto ou PDF, com leitura do QR code da NFC-e no navegador. **Conciliação automática** por valor e data (±3 dias), desempate pelo nome; casos ambíguos o usuário escolhe; pendentes são reavaliados a cada importação e viram alerta após 10 dias. Chave de acesso única por empresa (a mesma nota não entra duas vezes). Correção manual dos campos lidos e "Tentar ler de novo". Teto mensal de leituras por `IA_LIMITE_COMPROVANTES_MES`.
- **Categorização em corrente**: regras da empresa → categoria do provedor → IA (Claude, só com confiança ≥ 0,6) ([ADR 0003](documentos/arquitetura/decisoes/0003-strategy-categorizacao.md), [ADR 0004](documentos/arquitetura/decisoes/0004-classificador-claude.md)). Corrigir uma categoria oferece criar regra nova. Categorias e regras iniciais da HOMETEC.
- **Centros de custo** por tipo de serviço, com resultado por centro (inclusive os sem movimento).
- **Painel** com entradas e saídas por mês, para onde foi o dinheiro (por categoria) e resultado por centro de custo.
- **Extrato** com filtros na URL, detalhe da transação e **anexos** (PDF, JPEG, PNG, WEBP até 4 MB, validados pelos bytes) no bucket privado do Storage.
- **Open Finance via Pluggy pronto, porém desligado** (`RECURSO_OPEN_FINANCE=0`): adaptador `ProvedorBancario`, webhook com Bearer secreto e deduplicação, cron de ressincronização e `npm run registrar-webhook` ([ADR 0002](documentos/arquitetura/decisoes/0002-adaptador-provedor-bancario.md), [ADR 0007](documentos/arquitetura/decisoes/0007-webhook-pluggy.md)). Com a flag desligada o webhook responde 404 e a interface esconde "Conectar banco".
- **Acesso por link mágico** do Supabase com lista de e-mails autorizados (`EMAIL_AUTORIZADO`) e empresa criada no primeiro login ([ADR 0008](documentos/arquitetura/decisoes/0008-autenticacao-link-magico.md)).
- **Multiempresa com RLS** desde a v1: toda tabela tem `empresa_id` e policies por empresa, cobertas por testes pgTAP ([ADR 0006](documentos/arquitetura/decisoes/0006-multiempresa-rls.md)).
- **Feature flags** por variável de ambiente `RECURSO_*` ([ADR 0010](documentos/arquitetura/decisoes/0010-feature-flags-por-ambiente.md)).
- **Limite de requisições** em tabela do Postgres com função atômica ([ADR 0011](documentos/arquitetura/decisoes/0011-rate-limit-no-postgres.md)).
- **Segurança**: CSP estática e cabeçalhos (HSTS, `frame-ancestors 'none'`, `nosniff`) ([ADR 0014](documentos/arquitetura/decisoes/0014-csp-estatica-nos-cabecalhos.md)); segredos só no servidor; varredura de segredos com **gitleaks** (`npm run segredos` e hook local).
- **CI com 7 jobs** (`qualidade`, `unidade`, `integracao`, `build`, `e2e`, `lighthouse`, `segredos`) e infraestrutura como código ([ADR 0015](documentos/arquitetura/decisoes/0015-infraestrutura-como-codigo-e-pipeline.md)).
- Identidade visual, abertura animada (pula com Enter/Esc), tema claro e escuro, layout para celular.
- Testes: 266 de unidade (cobertura de 98% nas regras de negócio), 139 pgTAP, 76 E2E com axe em 8 rotas, Lighthouse ([documentos/qualidade/revisoes.md](documentos/qualidade/revisoes.md)).
- Documentação: especificação, arquitetura, ADRs 0001 a 0016, design, plano de testes, rastreabilidade, guia de operação e roteiro.

### Alterado

- Fonte principal dos dados: de Open Finance via Pluggy para extrato OFX + comprovantes, porque a Pluggy em produção custaria no mínimo R$ 2.500/mês ([ADR 0016](documentos/arquitetura/decisoes/0016-extrato-ofx-e-comprovantes-com-ia.md), [viabilidade](documentos/especificacao/viabilidade.md)).
- Ajustes no modelo de dados durante a implementação ([ADR 0013](documentos/arquitetura/decisoes/0013-ajustes-no-modelo-de-dados.md)).
- A página de comprovantes avisa quando a leitura por IA está desligada (`RECURSO_COMPROVANTES_IA=0`) em vez de oferecer um envio que seria recusado.

### Removido

- Rota pública `/vitrine` (protótipo temporário das telas).

### Corrigido (revisão de QA)

- Centros de custo sem movimento sumiam da tela.
- `id` duplicado entre "Nova categoria" e o seletor de categoria de "Nova regra".
- Rolagem lateral a 390 px em `/comprovantes` e `/categorias`.
- Enter não pulava a abertura.
- Rádios de candidatos compartilhavam o mesmo `name` entre comprovantes.
- Leitor de tela anunciava "mais" em valores sem sinal.
- Seed usava a data em UTC em vez de America/Araguaina.

### Pendências conhecidas

Ver [documentos/evolucao/roteiro.md](documentos/evolucao/roteiro.md).

[1.0.0]: https://github.com/yRibeiroo/rastro/releases/tag/v1.0.0
