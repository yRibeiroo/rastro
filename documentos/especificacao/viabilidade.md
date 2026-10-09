# Estudo de viabilidade — Rastro v1

> Data da pesquisa: 09/10/2026. Valores em dólar convertidos a **US$ 1 = R$ 5,50** (cotação **estimada**, não consultada em fonte oficial; ver `premissas.md`, P-20).
> Fontes: `CONTEXTO.md`, `PROMPT-CLAUDE-CODE.md`, protótipo em `prototipo-flask/` e páginas públicas citadas ao fim de cada seção.

## 1. Resumo executivo

| Dimensão | Conclusão |
|---|---|
| Técnica | **Viável.** O protótipo Flask já validou o fluxo Pluggy Connect → item → webhook → sincronização. A stack (Next.js + Supabase + Vercel + Claude) cobre todos os requisitos sem componentes exóticos. |
| Econômica | **Viável com ressalva importante.** Supabase, Vercel e Claude custam juntos menos de **US$ 50/mês**. O custo dominante é a **Pluggy em produção: plano "Dados" a partir de R$ 2.500/mês**, sem plano publicado para 1 conta conectada. Para uso interno de uma única empresa, isso é desproporcional. Essa decisão é do Davi (ver §3.5 e o risco R-02). |
| Operacional | **Viável.** Um único usuário, operação quase toda automática (webhook). O trabalho manual é corrigir categorias, reconectar quando o consentimento expirar e, de vez em quando, anexar uma nota. |
| Regulatória (LGPD) | **Viável com cuidados.** São dados financeiros da própria empresa, mas incluem dados pessoais de terceiros (nomes e documentos de contrapartes de Pix/TED). Exige RLS, minimização, segredos no servidor e registro de operadores (Pluggy, Supabase, Vercel, Anthropic). |

## 2. Viabilidade técnica

### 2.1 O que já está provado (protótipo Flask)
- Autenticação na Pluggy (`client_id` + `client_secret` → API Key de ~2 h, com cache).
- Connect Token criado no servidor, **sem `webhookUrl`** (por ali o evento chegaria sem o header secreto).
- Validação no servidor de que o `itemId` pertence à aplicação (`GET /items/{id}` → 404 se não pertencer).
- Webhook autenticado por `Authorization: Bearer <segredo>` com comparação em tempo constante, deduplicação por `eventId`, resposta imediata e processamento em segundo plano.
- Tratamento de `item/created|updated|error` e `transactions/created|updated|deleted`.
- Mapeamento: valor negativo = saída; contraparte vinda de `paymentData` (recebedor em débito, pagador em crédito) ou `merchant`; ids UUID convertidos para texto.
- Upsert que **não sobrescreve a categoria do Rastro**.

### 2.2 O que é novo na v1 e o risco técnico de cada parte

| Item | Risco técnico | Observação |
|---|---|---|
| Porte para Next.js (Route Handlers + `after()`) | Baixo | `after()` substitui o pool de threads. Na Vercel a função continua viva até o fim do `after()`, dentro do limite de duração da função. |
| Supabase Auth com link mágico + allowlist | Baixo | O serviço de e-mail padrão do Supabase entrega **só para membros do time do projeto** e no máximo **2 e-mails/hora**. Para produção, o recomendado é SMTP próprio (Resend, SES etc.). Ver P-08. |
| Categorização com Claude | Baixo | Classificação curta, com saída estruturada (`output_config.format`). Falha da IA não pode bloquear a sincronização (RNF-19). |
| Reconexão por consentimento expirado | Médio | Por padrão, o consentimento Open Finance na Pluggy **não expira**, mas alguns conectores PJ impõem 1 ano. A renovação é feita por `PATCH` no item, com o Pluggy Connect em modo de atualização. Expirado, os endpoints devolvem **dados vazios**. Não há evento de webhook específico para expiração na documentação, então é preciso olhar `consentExpiresAt` e o status do item. |
| Falha no processamento após responder 200 | Médio | A Pluggy não reenvia o que recebeu 2XX. O protótipo só registra no log. A v1 guarda o estado do evento e oferece "Sincronizar agora" (RF-30). |
| `clientUserId` só em eventos `item/*` | Baixo | Eventos de transação não trazem `clientUserId`: a empresa é resolvida pelo `itemId` salvo na conexão. |

**Conclusão técnica:** viável. Nenhum requisito exige tecnologia que a equipe ainda não domine.

Fontes: [Pluggy — Webhooks](https://docs.pluggy.ai/docs/webhooks) · [Pluggy — Consents and expiration](https://docs.pluggy.ai/docs/consents) · [Pluggy — Rate limits](https://docs.pluggy.ai/docs/rate-limits) · [Supabase — SMTP personalizado](https://supabase.com/docs/guides/auth/auth-smtp)

## 3. Viabilidade econômica

### 3.1 Pluggy (agregador Open Finance)

| Plano | Preço | Observações |
|---|---|---|
| Sandbox | Gratuito | Pluggy Bank de teste, sem dados reais. Suficiente para desenvolvimento e para o critério de pronto da v1 ("produção funcionando com o sandbox"). |
| Trial de produção | Gratuito por 15 dias | Sem cartão. Ao fim, as conexões ficam pausadas até um plano ser ativado. |
| **Dados** | **a partir de R$ 2.500/mês** | Contas reais, webhooks, enriquecimento e suporte. Cobrança de excedente acima do volume incluído. |
| Pagamentos | a partir de R$ 500/mês | Não é necessário para o Rastro. |
| Meu Pluggy | Gratuito | Uso **pessoal**, até 5 conexões, contas **do mesmo titular**, atualização a cada 24 h. A FAQ **proíbe uso comercial** e uso em produtos para terceiros. |

- **Plano para 1 conta conectada: não encontrado.** A Pluggy não publica preço por conexão. O plano mais barato com dados reais é o "Dados", com mínimo de R$ 2.500/mês. Qualquer valor menor teria de ser negociado com o comercial (**estimativa: não há valor público**).
- O "Meu Pluggy" é gratuito, mas é voltado a pessoa física e proíbe fins comerciais. Usar o Rastro para a contabilidade interna da HOMETEC é, no mínimo, uma zona cinzenta. **Não assumimos que ele sirva**: o Davi precisa confirmar com a Pluggy (ver `PARA-O-DAVI`, P-03 e R-02).

Fontes: [Pluggy — Preços](https://www.pluggy.ai/precos) · [Meu Pluggy](https://www.pluggy.ai/meu-pluggy) · [Banq — Pluggy](https://www.banq.ai/api-aggregators/pluggy)

### 3.2 Supabase

| Item | Free | Pro |
|---|---|---|
| Preço | US$ 0 | a partir de US$ 25/mês |
| Banco | 500 MB | 8 GB por projeto (depois US$ 0,125/GB) |
| Storage (anexos) | 1 GB | 100 GB (depois US$ 0,0213/GB) |
| Usuários ativos/mês | 50.000 | 100.000 |
| Egress | 5 GB | 250 GB |
| Pausa por inatividade | **Sim, após 1 semana sem atividade** | Nunca |
| Backups automáticos | **Não** | 7 dias |
| Projetos ativos | 2 | sem limite (com custo de compute por projeto) |

**Volume esperado:** cerca de 300 transações/mês, perto de 3.600/ano. Mesmo com 5 anos de histórico, a ordem de grandeza é de poucos MB. Anexos (PDF/foto de nota) a ~300 KB cada, mesmo com 50 por mês, dão ~180 MB/ano. **O plano Free cabe no volume.**

**Mas:** sem backup automático e com pausa por inatividade, o Free é arriscado para dados financeiros. **Recomendação:** Free em desenvolvimento e Pro em produção quando houver dados reais (decisão D-02).

Fonte: [Supabase — Pricing](https://supabase.com/pricing)

### 3.3 Vercel

| Item | Hobby | Pro |
|---|---|---|
| Preço | US$ 0 | US$ 20/mês por membro (com US$ 20 de crédito de uso incluso) |
| Uso comercial | **Proibido** | Permitido |
| Invocações de função | 1.000.000/mês | 1.000.000 incluídas, depois US$ 0,60 por milhão |
| Transferência | 100 GB | 1 TB |
| CPU ativa | 4 h/mês | por uso (a partir de US$ 0,128/h) |

> **Risco/decisão — Hobby proíbe uso comercial.** As Fair Use Guidelines definem uso comercial como qualquer deploy usado para ganho financeiro de **qualquer** pessoa envolvida na produção do projeto. Um sistema financeiro interno de uma empresa com fins lucrativos se enquadra nessa definição. **Decisão D-01:** usar Hobby só para desenvolvimento e prévias pessoais e contratar o **Pro (US$ 20/mês)** antes de colocar dados reais da HOMETEC em produção. Ver R-08.

O volume do Rastro (um usuário, poucos webhooks por dia) fica muito abaixo de qualquer limite dos dois planos. A restrição é **contratual, não técnica**.

Fontes: [Vercel — Pricing](https://vercel.com/pricing) · [Vercel — Fair Use Guidelines (Commercial usage)](https://vercel.com/docs/limits/fair-use-guidelines)

### 3.4 API do Claude (Anthropic)

Modelo: **Claude Opus 5.5 (`claude-opus-5-5`)**, o modelo padrão atual da família Claude 5 indicado pela Anthropic (ver P-11). Preços oficiais por milhão de tokens (MTok):

| Modelo | Entrada | Saída | Leitura de cache | Batch (50%) entrada/saída |
|---|---|---|---|---|
| Claude Opus 5.5 | US$ 4,00 | US$ 20,00 | US$ 0,20 | US$ 2,00 / US$ 10,00 |
| Claude Sonnet 5.5 (alternativa) | US$ 2,00 | US$ 10,00 | US$ 0,10 | US$ 1,00 / US$ 5,00 |
| Claude Haiku 5.5 (alternativa barata) | US$ 0,10 | US$ 0,50 | US$ 0,01 | US$ 0,05 / US$ 0,25 |

**Estimativa (pior caso: as ~300 transações/mês vão todas para a IA, sem nenhuma regra):**

| Premissa por classificação | Valor |
|---|---|
| Entrada: instruções + lista de categorias + transação | ~1.000 tokens |
| Saída: JSON com categoria e confiança + raciocínio adaptativo em esforço `low` | ~300 tokens |
| Custo por transação (Opus 5.5) | 1.000 × 4/1M + 300 × 20/1M = **US$ 0,010** |
| **Custo mensal (300 tx)** | **≈ US$ 3,00 ≈ R$ 16,50** |
| Com cache do prompt fixo (~900 tokens lidos a US$ 0,20/MTok) | ≈ US$ 2,00/mês |
| Carga inicial (backfill de ~12 meses ≈ 3.600 tx, uma vez) | ≈ US$ 36 (≈ US$ 18 via Batch API) |
| Mesmo cenário com Sonnet 5.5 | ≈ US$ 1,50/mês |

Na prática, as regras devem absorver boa parte do volume ao longo dos meses (as correções viram regras), então o custo real tende a cair abaixo de **US$ 1/mês**. **A IA não é um fator econômico relevante.** O risco é custo fora de controle por bug (laço de reclassificação), mitigado por teto de chamadas (R-05).

Fonte: [Anthropic — Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (docs.anthropic.com redireciona para platform.claude.com)

### 3.5 Custo total mensal

| Cenário | Pluggy | Supabase | Vercel | Claude | Total aproximado |
|---|---|---|---|---|---|
| **A. Desenvolvimento/sandbox** (critério de pronto da v1) | R$ 0 | US$ 0 | US$ 0 (Hobby, sem dados reais) | ~US$ 1 | **≈ R$ 5/mês** |
| **B. Produção conforme os termos** (dados reais do Sicredi) | R$ 2.500 | US$ 25 | US$ 20 | ~US$ 3 | **≈ R$ 2.765/mês** |
| C. Produção mínima arriscada (não recomendado) | R$ 2.500 | US$ 0 | US$ 0 | ~US$ 3 | ≈ R$ 2.517/mês, violando os termos da Vercel e sem backup |

Fora isso: domínio (`.com.br` ≈ R$ 40/ano, conforme a tabela do Registro.br, **estimativa**) e SMTP transacional (Resend tem plano gratuito, **estimativa**, não verificado nesta pesquisa).

**Conclusões econômicas**
1. A Pluggy responde por cerca de 90% do custo de produção. Para **uma** empresa usando internamente, R$ 2.500/mês só se justifica se o Rastro virar SaaS. Com ~10 clientes pagantes, o custo por cliente cai para ~R$ 250.
2. Caminhos para o Davi decidir (D-03): (a) negociar com a Pluggy um plano de entrada para 1 CNPJ; (b) confirmar por escrito se o Meu Pluggy pode ser usado na conta PJ da própria empresa; (c) usar o **Plano B (importação OFX)**, gratuito, como ponte, que fica fora da v1 mas é viável graças ao adaptador `ProvedorBancario`; (d) tratar os R$ 2.500 como investimento no produto SaaS.
3. Supabase Pro e Vercel Pro somam ≈ US$ 45/mês (≈ R$ 250) e são **recomendados** assim que houver dados reais.
4. A v1 pode ser **entregue e validada a custo quase zero** com o sandbox. A decisão de gastar só precisa ser tomada na hora de conectar a conta real.

## 4. Viabilidade operacional

- **Usuário único** (Davi). Sem treinamento formal. A interface é em português, com termos do dia a dia (Conexão, Transação, Categoria, Regra, Centro de custo).
- **Rotina esperada:** abrir o painel algumas vezes por semana, revisar transações "a confirmar" (classificadas pela IA), corrigir as erradas (as correções viram regras), atribuir centros de custo e anexar notas quando o contador pedir.
- **Eventos excepcionais:** consentimento expirado ou erro de login no banco. O Rastro mostra um aviso e um botão "Reconectar". Se a Pluggy cair, o botão "Sincronizar agora" recupera o atraso depois.
- **Manutenção:** dependências atualizadas pelo CI. Segredos trocados quando houver suspeita de vazamento (já aconteceu com o Client Secret da Pluggy num print).
- **Contingência:** se a integração parar, o Davi exporta o OFX do Sicredi Internet (Plano B do `CONTEXTO.md`).

**Conclusão operacional:** viável. O esforço manual estimado é de 15 a 30 min por semana, caindo à medida que as regras aprendem.

## 5. LGPD e caráter sensível dos dados

### 5.1 Natureza dos dados
- **Dados da empresa** (extrato da conta PJ): sigilo bancário (LC 105/2001) e segredo de negócio. Não são dados pessoais em si, mas são altamente sensíveis do ponto de vista comercial.
- **Dados pessoais de terceiros** dentro das transações: nome, às vezes CPF/CNPJ e chave Pix de quem pagou ou recebeu (funcionários, fornecedores pessoa física, clientes). **A LGPD se aplica a esses dados.**
- **Dados pessoais do usuário:** e-mail do Davi (login).
- Notas fiscais e comprovantes anexados podem trazer CPF, endereço etc.

Dados financeiros não estão no rol de "dados pessoais sensíveis" do art. 5º, II da LGPD, mas o risco de dano em caso de vazamento (fraude, engenharia social) justifica tratá-los **com o mesmo rigor**.

### 5.2 Papéis e bases legais
| Papel | Quem |
|---|---|
| Controlador | HOMETEC SERVIÇOS |
| Operadores (suboperadores) | Pluggy (agregador regulado), Supabase (banco e storage), Vercel (hospedagem), Anthropic (classificação por IA) |

- **Base legal** para tratar dados de contrapartes: execução de contrato e cumprimento de obrigação legal (escrituração contábil e fiscal), art. 7º, II e V, além de legítimo interesse (art. 7º, IX) para a categorização.
- **Transferência internacional** (art. 33): Supabase, Vercel e Anthropic processam dados fora do Brasil. Deve ficar registrado. Recomendação: região do Supabase em **São Paulo (sa-east-1)** (P-15) e envio **mínimo** à IA (P-12).

### 5.3 Medidas exigidas (refletidas nos RNF)
1. **Minimização para a IA:** enviar só descrição, valor, tipo e contraparte. Nunca CPF/CNPJ, `account_id` ou e-mail (RNF-20).
2. **RLS em todas as tabelas** e bucket de anexos **privado** com URLs assinadas de curta duração (RNF-01, RNF-07).
3. **Segredos só no servidor**: Pluggy, Anthropic e `service_role` (RNF-02). O vazamento do Client Secret num print mostra que esse risco é real (R-04).
4. **Logs sem dados sensíveis**: sem descrição, valor, contraparte, tokens ou e-mail (RNF-06).
5. **Retenção:** manter enquanto houver obrigação contábil (5 anos, prazo de prescrição tributária). Ao desconectar um banco, revogar o item na Pluggy.
6. **Direitos do titular e incidentes:** canal de contato (e-mail da HOMETEC) e procedimento de resposta a incidente no guia de operação.
7. O Open Finance exige consentimento explícito do titular da conta, coletado pelo próprio fluxo regulado (Pluggy Connect + app do Sicredi).

**Conclusão regulatória:** viável, desde que os RNF de segurança e privacidade sejam cumpridos. Antes de virar SaaS, será preciso política de privacidade, termos de uso, contratos de operador (DPA) e encarregado (DPO).

## 6. Decisões registradas neste estudo

| Id | Decisão | Responsável |
|---|---|---|
| D-01 | Vercel Hobby só em desenvolvimento. Produção com dados reais exige Vercel Pro (US$ 20/mês). | Davi (assinatura) |
| D-02 | Supabase Free em desenvolvimento. Pro (US$ 25/mês) em produção, por causa de backup e da pausa por inatividade. | Davi (assinatura) |
| D-03 | A v1 é entregue com o **sandbox** da Pluggy. Conectar a conta real exige decidir entre plano Dados (R$ 2.500/mês), negociação, Meu Pluggy (se a Pluggy confirmar por escrito) ou OFX. | Davi |
| D-04 | IA: `claude-opus-5-5` com esforço `low`, configurável por variável de ambiente (`ANTHROPIC_MODELO`) para trocar por Sonnet/Haiku sem deploy de código. | Equipe |
