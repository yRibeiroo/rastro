# ADR 0012 — Plano da Vercel: Hobby no desenvolvimento, Pro antes do uso real

**Status:** Aceita (2026-10-09)

## Contexto
O plano **Hobby** da Vercel é gratuito, mas os termos o restringem a **uso pessoal e não comercial**. O Rastro é uma ferramenta interna da HOMETEC SERVIÇOS, ou seja, uso por uma empresa com fins lucrativos, o que na leitura conservadora dos termos é uso comercial. O Hobby também tem limites menores (Cron no máximo 1×/dia, duração de função e cotas menores, sem colaboradores na equipe). O plano **Pro** custa por membro/mês (confirmar o valor atual em vercel.com/pricing).

## Decisão
- **Desenvolvimento, previews e testes com o sandbox da Pluggy (Pluggy Bank, dados fictícios): plano Hobby.**
- **Migrar para o Pro antes de qualquer uma destas condições (a primeira que ocorrer):**
  1. conectar a conta real do Sicredi da HOMETEC (dados reais da empresa em produção);
  2. usar o Rastro no dia a dia da empresa (go-live da v1);
  3. qualquer cliente externo (início do SaaS);
  4. precisar de Cron mais de 1×/dia, `maxDuration` acima do limite do Hobby ou mais de um membro na equipe da Vercel.
- O código não depende de nenhum recurso exclusivo do Pro: o Cron é diário e `maxDuration = 60` cabe no Hobby com Fluid Compute. A migração é só de plano, sem mudança de código.
- Item no `documentos/PARA-O-DAVI.md`: "Antes de conectar o Sicredi real, assinar o Vercel Pro".
- O mesmo raciocínio vale para o Supabase: o plano Free pausa projetos inativos e não tem backups diários garantidos. O plano pago é recomendado no go-live com dados reais (registrar no estudo de viabilidade).

## Consequências
- (+) Custo zero enquanto não houver dados reais nem uso operacional.
- (−) Existe a janela de risco de "esquecer de migrar". Mitigação: item obrigatório no checklist do go-live e no `PARA-O-DAVI.md`.
- (−) O custo mensal começa no go-live (Vercel Pro + Supabase Pro + Pluggy + Anthropic). Os valores ficam no estudo de viabilidade.

## Alternativas consideradas
- **Ficar no Hobby em produção**: viola os termos e expõe a conta a suspensão.
- **Self-host (Coolify/VPS)**: barato, mas é trabalho de operação (TLS, atualizações, backups) contra a ADR 0001.
- **Netlify/Cloudflare**: os planos gratuitos têm restrições parecidas ou suporte menos maduro ao `after()` e ao Next 16.
