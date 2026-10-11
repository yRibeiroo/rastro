# Estudo de viabilidade — Rastro v1

> Revisado em **10/10/2026** pela ADR 0016 (extrato OFX + comprovantes lidos por IA; Pluggy desligada por `RECURSO_OPEN_FINANCE`). Pesquisa original: 09/10/2026.
> Data da pesquisa: 09/10/2026 (custo de imagem no Claude consultado em 10/10/2026). Valores em dólar convertidos a **US$ 1 = R$ 5,50** (cotação **estimada**, não consultada em fonte oficial; ver `premissas.md`, P-20).
> Fontes: `CONTEXTO.md`, `PROMPT-CLAUDE-CODE.md`, protótipo em `prototipo-flask/` e páginas públicas citadas ao fim de cada seção.

## 1. Resumo executivo

| Dimensão | Conclusão |
|---|---|
| Técnica | **Viável.** O caminho principal da v1 é importar o **OFX** do Sicredi (formato aberto, com `FITID` para idempotência) e ler **comprovantes por visão do Claude** com saída estruturada. O fluxo Pluggy (validado no protótipo Flask) continua no código, desligado por flag. |
| Econômica | **Viável.** Sem agregador, a produção dentro dos termos custa **≈ US$ 52/mês (≈ R$ 286)**: Vercel Pro + Supabase Pro + IA (~100 comprovantes lidos por visão + ~300 classificações). A Pluggy, que custaria no mínimo R$ 2.500/mês (~90% do total), saiu da v1 (D-03 resolvida). |
| Operacional | **Viável, com uma tarefa manual nova.** O Davi baixa e envia o OFX uma vez por semana ou por mês e, se quiser, fotografa comprovantes. O risco é esquecer (R-15), mitigado pelo aviso "última importação há X dias" (RF-34). |
| Regulatória (LGPD) | **Viável com cuidados.** Além dos dados de contrapartes do extrato, as **imagens de comprovantes** (CPF/CNPJ, endereço) vão à Anthropic para leitura. Exige RLS, minimização (redução da imagem e remoção de EXIF, RNF-24), segredos no servidor e registro dos operadores (Supabase, Vercel, Anthropic). |

## 2. Viabilidade técnica

### 2.1 O que já está provado (protótipo Flask — fluxo Pluggy, hoje atrás de `RECURSO_OPEN_FINANCE`)
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

### 2.3 Caminho da v1 (ADR 0016): extrato OFX + comprovantes

| Item | Risco técnico | Observação |
|---|---|---|
| Leitura de OFX do Sicredi | Médio | OFX 1.x é SGML (tags sem fechamento), 2.x é XML. Variações de codificação, data e decimal são cobertas por fixtures (RNF-28). Sem um arquivo real ainda, há incerteza sobre o formato exato (R-17, P-29). |
| Idempotência por `FITID` | Baixo/Médio | Upsert por `(empresa_id, id_externo)`, o mesmo do fluxo Pluggy. Risco residual: banco que gera `FITID` diferente para o mesmo lançamento em exportações distintas (R-17). |
| Leitura de comprovante por visão do Claude | Baixo | Imagens JPEG/PNG/WEBP até 10 MB e PDFs são aceitos pela API. Saída estruturada + Zod. Precisão depende da foto (R-18); por isso a conciliação exige valor exato (R-16). |
| QR code da NFC-e no navegador | Baixo | `BarcodeDetector` é nativo só em navegadores Chromium do Android e do macOS; sem suporte, a IA lê a chave (P-43). A chave tem dígito verificador (módulo 11), o que permite validar a leitura. |
| Conciliação automática | Baixo | Regra determinística (valor exato, ±3 dias, desempate por nome), testável por tabela de casos (RF-39). |

**Conclusão técnica:** viável. Nenhum requisito exige tecnologia que a equipe ainda não domine.

Fontes: [Pluggy — Webhooks](https://docs.pluggy.ai/docs/webhooks) · [Pluggy — Consents and expiration](https://docs.pluggy.ai/docs/consents) · [Pluggy — Rate limits](https://docs.pluggy.ai/docs/rate-limits) · [Supabase — SMTP personalizado](https://supabase.com/docs/guides/auth/auth-smtp)

## 3. Viabilidade econômica

### 3.1 Pluggy (agregador Open Finance) — fora da v1

> **Desligada pela ADR 0016** (`RECURSO_OPEN_FINANCE=false`). A tabela fica como registro da decisão e para o caso de o Rastro virar SaaS.

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

**Volume esperado:** cerca de 300 transações/mês, perto de 3.600/ano. Mesmo com 5 anos de histórico, a ordem de grandeza é de poucos MB. Comprovantes reduzidos no navegador (P-34) ficam em ~0,5–1 MB cada; com ~100 por mês, dão **~0,6–1,2 GB/ano**. O Free (1 GB de Storage) estoura em cerca de um ano; o Pro (100 GB) cabe por décadas.

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

**A. Classificação de transações (pior caso: as ~300 transações/mês vão todas para a IA, sem nenhuma regra):**

| Premissa por classificação | Valor |
|---|---|
| Entrada: instruções + lista de categorias + transação | ~1.000 tokens |
| Saída: JSON com categoria e confiança + raciocínio adaptativo em esforço `low` | ~300 tokens |
| Custo por transação (Opus 5.5) | 1.000 × 4/1M + 300 × 20/1M = **US$ 0,010** |
| **Custo mensal (300 tx)** | **≈ US$ 3,00** |
| Com cache do prompt fixo (~900 tokens lidos a US$ 0,20/MTok) | ≈ US$ 2,00/mês |
| Carga inicial (12 meses ≈ 3.600 tx, uma vez, ao importar o histórico em OFX) | ≈ US$ 36 (≈ US$ 18 via Batch API) |

**B. Leitura de comprovantes por visão (~100 comprovantes/mês):**

Como a documentação de visão calcula o custo de uma imagem: o Claude vê a imagem em blocos de 28×28 px, e cada bloco é um token visual: `tokens = ⌈largura/28⌉ × ⌈altura/28⌉`. Os modelos Claude 4.7 em diante (inclui o Opus 5.5) estão no nível de **alta resolução**: lado maior até **2576 px** e no máximo **4.784 tokens por imagem**; acima disso a imagem é reduzida. Exemplos da documentação: 1000×1000 px = 1.296 tokens; 1920×1080 = 2.691; 2000×1500 = 3.888; 3840×2160 → reduzida para 2576×1449 = 4.784. O limite por imagem é 10 MB (API direta).

| Premissa por comprovante | Valor |
|---|---|
| Foto do celular (4000×3000) reduzida no navegador para 2576×1932 (P-34) | 92 × 69 = 6.348 → limitada a **4.784 tokens** |
| Instruções + schema de saída | ~1.200 tokens |
| Saída: JSON com tipo, valor, data, emissor, chave, itens e confiança | ~800 tokens |
| Custo por comprovante (Opus 5.5) | ~6.000 × 4/1M + 800 × 20/1M = **≈ US$ 0,04** |
| PDF de 1 página (texto extraído + imagem da página) | mesma ordem: ≈ US$ 0,04–0,05 |
| **Custo mensal (100 comprovantes)** | **≈ US$ 4,00** |
| Teto `IA_LIMITE_COMPROVANTES_MES` = 300 (P-35) | no máximo ≈ US$ 12/mês |
| Mesmo cenário com Sonnet 5.5 (US$ 2/US$ 10) | ≈ US$ 2,00/mês |

**Total de IA na produção:** ≈ US$ 3,00 (classificação) + US$ 4,00 (comprovantes) = **≈ US$ 7/mês (≈ R$ 39)**. Com regras absorvendo a classificação ao longo dos meses, tende a ≈ US$ 5. **A IA continua não sendo um fator econômico relevante.** O risco é custo fora de controle por bug, mitigado pelos dois tetos (R-05).

Fontes: [Anthropic — Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (docs.anthropic.com redireciona para platform.claude.com) · [Anthropic — Vision (resolução e custo de imagens)](https://platform.claude.com/docs/en/build-with-claude/vision)

### 3.5 Custo total mensal

| Cenário | Agregador | Supabase | Vercel | Claude (IA) | Total aproximado |
|---|---|---|---|---|---|
| **A. Desenvolvimento** (fixtures OFX, poucos comprovantes de teste) | R$ 0 | US$ 0 (Free) | US$ 0 (Hobby, sem dados reais) | ~US$ 1 | **≈ US$ 1 ≈ R$ 5/mês** |
| **B. Produção dentro dos termos (v1, ADR 0016)** | **R$ 0** (OFX manual) | US$ 25 (Pro) | US$ 20 (Pro) | ~US$ 7 (300 tx + 100 comprovantes) | **≈ US$ 52 ≈ R$ 286/mês** |
| B'. Mesmo cenário com Sonnet 5.5 em `ANTHROPIC_MODELO` | R$ 0 | US$ 25 | US$ 20 | ~US$ 3,50 | ≈ US$ 48,50 ≈ R$ 267/mês |
| C. Produção mínima arriscada (não recomendado) | R$ 0 | US$ 0 | US$ 0 | ~US$ 7 | ≈ R$ 39/mês, violando os termos da Vercel, sem backup e com o Storage Free esgotando em ~1 ano |
| *Referência: antigo cenário com Pluggy (descartado)* | *R$ 2.500* | *US$ 25* | *US$ 20* | *~US$ 3* | *≈ R$ 2.765/mês* |

Fora isso: domínio (`.com.br` ≈ R$ 40/ano, conforme a tabela do Registro.br, **estimativa**) e SMTP transacional (Resend tem plano gratuito, **estimativa**, não verificado nesta pesquisa). Carga inicial única de IA ao importar 12 meses de histórico: ≈ US$ 18–36.

**Conclusões econômicas**
1. Trocar a Pluggy por OFX + comprovantes reduz o custo de produção de ≈ R$ 2.765 para **≈ R$ 286/mês** (−90%).
2. O custo restante é quase todo infraestrutura (Vercel Pro + Supabase Pro ≈ US$ 45), **recomendada** assim que houver dados reais (D-01, D-02).
3. A IA (classificação + visão) fica em ≈ US$ 7/mês, com teto rígido de ≈ US$ 32/mês (2.000 classificações + 300 leituras).
4. A Pluggy volta a ser avaliada só se o Rastro virar SaaS; o código está pronto atrás da flag.

## 4. Viabilidade operacional

- **Usuário único** (Davi). Sem treinamento formal. A interface é em português, com termos do dia a dia (Transação, Categoria, Regra, Centro de custo, Comprovante, Importar).
- **Rotina esperada:** uma vez por semana (ou por mês), baixar o OFX no Sicredi Internet e enviar em "Importar" (~3 min). Quando quiser, fotografar comprovantes e notas (~20 s cada). Revisar transações "a confirmar" (classificadas pela IA), corrigir as erradas (viram regras), resolver comprovantes ambíguos e atribuir centros de custo.
- **Eventos excepcionais:** OFX recusado (formato diferente, R-17), foto ilegível (R-18), comprovante sem transação no extrato (RF-42).
- **Esquecimento:** o maior risco operacional (R-15). O aviso "última importação há X dias" fica em destaque a partir de 7 dias (RF-34).
- **Manutenção:** dependências atualizadas pelo CI. Segredos trocados quando houver suspeita de vazamento (o Client Secret da Pluggy já apareceu num print; revogá-lo mesmo com a Pluggy desligada).

**Conclusão operacional:** viável. O esforço manual estimado é de 20 a 40 min por semana (importação + comprovantes + revisão), caindo à medida que as regras aprendem e a conciliação automática liga os comprovantes.

## 5. LGPD e caráter sensível dos dados

### 5.1 Natureza dos dados
- **Dados da empresa** (extrato da conta PJ): sigilo bancário (LC 105/2001) e segredo de negócio. Não são dados pessoais em si, mas são altamente sensíveis do ponto de vista comercial.
- **Dados pessoais de terceiros** dentro das transações: nome, às vezes CPF/CNPJ e chave Pix de quem pagou ou recebeu (funcionários, fornecedores pessoa física, clientes). **A LGPD se aplica a esses dados.**
- **Dados pessoais do usuário:** e-mail do Davi (login).
- Notas fiscais e comprovantes (anexados ou lidos por IA) trazem CPF/CNPJ, nome, às vezes endereço e, em fotos de celular, **localização GPS no EXIF**.

Dados financeiros não estão no rol de "dados pessoais sensíveis" do art. 5º, II da LGPD, mas o risco de dano em caso de vazamento (fraude, engenharia social) justifica tratá-los **com o mesmo rigor**.

### 5.2 Papéis e bases legais
| Papel | Quem |
|---|---|
| Controlador | HOMETEC SERVIÇOS |
| Operadores (suboperadores) | Supabase (banco e storage), Vercel (hospedagem), Anthropic (classificação e **leitura de comprovantes** por IA). Pluggy só se `RECURSO_OPEN_FINANCE` for ligado. |

- **Base legal** para tratar dados de contrapartes: execução de contrato e cumprimento de obrigação legal (escrituração contábil e fiscal), art. 7º, II e V, além de legítimo interesse (art. 7º, IX) para a categorização.
- **Transferência internacional** (art. 33): Supabase, Vercel e Anthropic processam dados fora do Brasil. Deve ficar registrado. Recomendação: região do Supabase em **São Paulo (sa-east-1)** (P-15) e envio **mínimo** à IA (P-12).

### 5.3 Medidas exigidas (refletidas nos RNF)
1. **Minimização para a IA:** na classificação, enviar só descrição, valor, tipo e contraparte, nunca CPF/CNPJ, `account_id` ou e-mail (RNF-20). Na leitura de comprovantes, a imagem é enviada (inevitável, P-40), mas reduzida e **sem EXIF/GPS**, e sem nenhum outro dado junto (RNF-24).
2. **RLS em todas as tabelas** e bucket de anexos **privado** com URLs assinadas de curta duração (RNF-01, RNF-07).
3. **Segredos só no servidor**: Pluggy, Anthropic e `service_role` (RNF-02). O vazamento do Client Secret num print mostra que esse risco é real (R-04).
4. **Logs sem dados sensíveis**: sem descrição, valor, contraparte, tokens ou e-mail (RNF-06).
5. **Retenção:** manter transações, comprovantes e OFX importados enquanto houver obrigação contábil (5 anos, prazo de prescrição tributária).
6. **Direitos do titular e incidentes:** canal de contato (e-mail da HOMETEC) e procedimento de resposta a incidente no guia de operação.
7. Sem Open Finance na v1, não há consentimento regulado a coletar: o próprio titular (HOMETEC) baixa e envia o extrato.

**Conclusão regulatória:** viável, desde que os RNF de segurança e privacidade sejam cumpridos. Antes de virar SaaS, será preciso política de privacidade, termos de uso, contratos de operador (DPA) e encarregado (DPO).

## 6. Decisões registradas neste estudo

| Id | Decisão | Responsável |
|---|---|---|
| D-01 | Vercel Hobby só em desenvolvimento. Produção com dados reais exige Vercel Pro (US$ 20/mês). | Davi (assinatura) |
| D-02 | Supabase Free em desenvolvimento. Pro (US$ 25/mês) em produção, por causa de backup e da pausa por inatividade. | Davi (assinatura) |
| D-03 | **Resolvida (10/10/2026, ADR 0016):** a v1 usa **extrato OFX importado + comprovantes lidos por IA**. A Pluggy fica desligada (`RECURSO_OPEN_FINANCE=false`), com código e testes mantidos. Custo de agregador: R$ 0. | Davi (decidido) |
| D-04 | IA: `claude-opus-5-5` com esforço `low`, configurável por variável de ambiente (`ANTHROPIC_MODELO`) para trocar por Sonnet/Haiku sem deploy de código. | Equipe |
| D-05 | Leitura de comprovantes com o modelo de `ANTHROPIC_MODELO` (opcionalmente `ANTHROPIC_MODELO_COMPROVANTES`), imagem reduzida a 2576 px no navegador e teto de 300 leituras/mês. | Equipe |
