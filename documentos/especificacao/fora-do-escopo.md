# Fora do escopo da v1

A arquitetura fica **preparada** para os itens marcados com ★ (empresa_id + RLS, adaptadores `ProvedorBancario` e `Classificador`, *feature flags*), mas eles **não são implementados** na v1.

## Produto e negócio
| Item | Motivo / quando entra |
|---|---|
| ★ Multiusuário (vários usuários por Empresa, papéis, convites) | Só o Davi usa. `EMAIL_AUTORIZADO` é único. Entra na versão comercial. |
| ★ Multiempresa na interface (cadastro de empresas, troca de empresa, onboarding self-service) | O banco já tem `empresa_id`. A interface assume uma Empresa. |
| ★ Planos, cobrança, assinatura, nota fiscal do SaaS | Versão comercial. |
| App mobile nativo (iOS/Android) | A v1 é web responsiva. PWA instalável também fica fora. |
| Política de privacidade, termos de uso, DPA e encarregado (DPO) formais | Necessários só quando houver clientes terceiros (ver `viabilidade.md` §5). |
| Verificação da marca no INPI e registro de domínio | Tarefa do Davi (`PARA-O-DAVI.md`), não do sistema. |

## Funcionalidades financeiras
| Item | Motivo / quando entra |
|---|---|
| **Saldo projetado** / fluxo de caixa futuro | Citado no `CONTEXTO.md`, mas não está no escopo da v1 do `PROMPT-CLAUDE-CODE.md`. A v1 mostra só o saldo atual (RF-27). |
| Contas a pagar e a receber, lançamentos manuais, agendamentos | A v1 trabalha só com o que vem do banco. |
| ★ **Open Finance via Pluggy em produção** (RF-05 a RF-13, RF-29, RF-30) | Implementado e testado, mas **desligado** (`RECURSO_OPEN_FINANCE=false`) pela ADR 0016: custo mínimo de R$ 2.500/mês. Religa se o Rastro virar SaaS. |
| Importação de extrato em **CSV** e OFX de outros bancos | A v1 aceita só OFX do Sicredi (P-29). CSV não tem id estável por lançamento. |
| Desfazer/excluir uma importação inteira | A reimportação é idempotente. Excluir em lote fica para depois (ver R-21). |
| Outros bancos e várias contas além do Sicredi PJ | O Pluggy Connect permite, mas a v1 só é testada e validada com *Sicredi Empresas* (e o sandbox). Não há bloqueio técnico, só falta de validação. |
| Cartão de crédito, investimentos e empréstimos | A v1 sincroniza só contas correntes (`BANK`). |
| Iniciação de pagamentos (Pix) | Produto "Pagamentos" da Pluggy, sem relação com o objetivo. |
| Rateio de uma transação entre vários centros de custo | A v1 permite **um** centro por transação. |
| Orçamento ou meta por categoria e alertas de gasto | Evolução. |
| Exportação para o contador (CSV, Excel, PDF) e integração com sistemas contábeis | Evolução. O contador hoje pede notas pontuais, atendidas pelos anexos. |
| Upload do **XML** da NF-e/NFC-e e consulta ou raspagem do portal da **SEFAZ** | A v1 lê foto/PDF por IA e a chave pelo QR code (RF-36, RF-37). O portal da SEFAZ é frágil e às vezes tem captcha (ADR 0016). |
| Vários comprovantes numa mesma foto, ou um comprovante cobrindo várias transações (e vice-versa) | A conciliação da v1 é 1 comprovante ↔ 1 transação (RF-39). |
| Rateio de uma transação por item do comprovante (categoria ou centro de custo por item) | Os itens só sugerem a categoria da transação inteira (RF-43). |
| Biblioteca própria de leitura de QR code para navegadores sem `BarcodeDetector` | P-43. Sem suporte, a IA lê a chave. |
| Recategorização em massa por IA de todo o histórico sob demanda | Fora. A IA roda na chegada da transação e pela regra "aplicar às existentes" (RF-21). |
| Regras com expressões regulares, faixas de valor ou condições compostas | A v1 usa "contém texto" + direção. |

## Técnica e operação
| Item | Motivo |
|---|---|
| Notificações por e-mail, push ou WhatsApp (ex.: extrato sem importar há 7 dias) | A v1 avisa só dentro do app (RF-34, RF-42). |
| Importação automática do extrato (robô no Internet Banking, e-mail com OFX) | Viola os termos do banco e exige guardar credenciais. A v1 depende do upload pelo Davi (P-41). |
| Observabilidade completa (APM, alertas, painéis de métricas) | A v1 usa os logs da Vercel e do Supabase. |
| Ambiente de *staging* dedicado | Prévias por branch da Vercel cobrem a necessidade. |
| Autenticação de dois fatores e login social | O link mágico + allowlist atende a um usuário. |
| Internacionalização (outros idiomas e moedas) | Só pt-BR / BRL. |
| Modo offline | Fora. |
| Conexão direta ao Open Finance ou às APIs Pix e Cobrança do Sicredi | Inviável para empresa pequena (BC, ICP-Brasil, FAPI), conforme o `CONTEXTO.md`. |
