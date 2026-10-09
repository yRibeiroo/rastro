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
| ★ Importação de OFX (Plano B) | Contingência citada no `CONTEXTO.md`. Fica fora, mas é o candidato natural para a v1.1 se o custo da Pluggy for proibitivo (ver R-02). O adaptador `ProvedorBancario` permite isso. |
| Outros bancos e várias contas além do Sicredi PJ | O Pluggy Connect permite, mas a v1 só é testada e validada com *Sicredi Empresas* (e o sandbox). Não há bloqueio técnico, só falta de validação. |
| Cartão de crédito, investimentos e empréstimos | A v1 sincroniza só contas correntes (`BANK`). |
| Iniciação de pagamentos (Pix) | Produto "Pagamentos" da Pluggy, sem relação com o objetivo. |
| Rateio de uma transação entre vários centros de custo | A v1 permite **um** centro por transação. |
| Orçamento ou meta por categoria e alertas de gasto | Evolução. |
| Exportação para o contador (CSV, Excel, PDF) e integração com sistemas contábeis | Evolução. O contador hoje pede notas pontuais, atendidas pelos anexos. |
| Conciliação automática de nota fiscal (leitura de XML/PDF, OCR) | Evolução. Os anexos da v1 são só arquivos. |
| Recategorização em massa por IA de todo o histórico sob demanda | Fora. A IA roda na chegada da transação e pela regra "aplicar às existentes" (RF-21). |
| Regras com expressões regulares, faixas de valor ou condições compostas | A v1 usa "contém texto" + direção. |

## Técnica e operação
| Item | Motivo |
|---|---|
| Notificações por e-mail, push ou WhatsApp (ex.: consentimento expirando) | A v1 avisa só dentro do app (RF-07). |
| Observabilidade completa (APM, alertas, painéis de métricas) | A v1 usa os logs da Vercel e do Supabase. |
| Ambiente de *staging* dedicado | Prévias por branch da Vercel cobrem a necessidade. |
| Autenticação de dois fatores e login social | O link mágico + allowlist atende a um usuário. |
| Internacionalização (outros idiomas e moedas) | Só pt-BR / BRL. |
| Modo offline | Fora. |
| Conexão direta ao Open Finance ou às APIs Pix e Cobrança do Sicredi | Inviável para empresa pequena (BC, ICP-Brasil, FAPI), conforme o `CONTEXTO.md`. |
