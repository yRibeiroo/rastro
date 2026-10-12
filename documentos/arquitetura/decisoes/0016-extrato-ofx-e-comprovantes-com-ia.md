# ADR 0016 — Extrato OFX + comprovantes lidos por IA no lugar da Pluggy na v1

**Status:** aceita (2026-10-10). Substitui o caminho principal das ADRs 0002 e 0007, que continuam válidas para o modo Open Finance desligado.

## Contexto
O estudo de viabilidade mostrou que a Pluggy com dados reais custa no mínimo R$ 2.500/mês, cerca de 90% do custo de produção, para uma ferramenta interna de uma única empresa. O Davi decidiu deixar a Pluggy de lado e usar IA para ler comprovantes e notas.

Só comprovantes deixariam buracos: tarifas, débitos automáticos, Pix recebidos e compras sem papel não apareceriam, e o saldo nunca bateria com o banco.

## Decisão
Modelo híbrido, com custo zero de agregador:

1. **Extrato importado (fonte da verdade).** O usuário envia o arquivo **OFX** exportado do Sicredi Internet (CSV fica para depois). Cada lançamento vira uma `Transacao` com `id_externo = FITID`. Reimportar o mesmo período é idempotente: o upsert por `(empresa_id, id_externo)` atualiza sem duplicar e nunca toca a categoria. A importação passa pelo mesmo serviço de sincronização e pela mesma corrente de categorização (regras → IA).
   - A conta é identificada por `BANKID`/`ACCTID` do OFX e criada na primeira importação. Só os 4 últimos dígitos são guardados.
   - O saldo vem do `LEDGERBAL` do arquivo.
   - Uma `Conexao` com `provedor = 'arquivo'` representa a origem. Status `atualizada`, e "última sincronização" = data da última importação.
2. **Comprovantes lidos por IA (o detalhe).** O usuário fotografa ou envia PDF/imagem de comprovante Pix, boleto pago, NFC-e, DANFE (NF-e) ou recibo.
   - O arquivo vai para o bucket privado `anexos`.
   - O `LeitorDeComprovantes` (porta) tem a implementação `LeitorDeComprovantesClaude`: visão do Claude com saída estruturada e Zod. Extrai tipo, valor total, data, nome e CNPJ/CPF do emissor ou favorecido, chave de acesso (44 dígitos, quando houver), itens (descrição, quantidade, valor) e confiança.
   - **QR code da NFC-e:** lido no navegador com `BarcodeDetector` quando o navegador suporta. A URL da SEFAZ traz a chave de acesso no parâmetro `p` (primeiros 44 dígitos). A chave é enviada junto e prevalece sobre a lida pela IA. Não raspamos o portal da SEFAZ, porque é frágil e às vezes tem captcha.
   - A chave de acesso é única por empresa, o que impede lançar a mesma nota duas vezes.
   - **Conciliação automática:** procura a transação de saída (ou entrada, para recibos emitidos) com o mesmo valor absoluto e data em ±3 dias. Desempata pela semelhança entre o nome do emissor e a contraparte ou descrição. Com exatamente um candidato, concilia: o comprovante vira anexo da transação, e os itens sugerem a categoria e o centro de custo, sem sobrescrever a categoria definida pelo usuário. Com zero candidatos, fica `pendente` (o extrato daquele dia ainda não foi importado) e é reavaliado a cada importação. Com vários, fica `ambiguo` e o usuário escolhe.
   - Comprovantes `pendente` há mais de 10 dias depois da última importação que cobre a data viram alerta "sem transação no extrato".
3. **Pluggy desligada por flag.** `RECURSO_OPEN_FINANCE=false` por padrão. O adaptador, o webhook e o cron continuam no código e nos testes. Com a flag desligada, `/api/webhooks/pluggy` responde 404, o cron não chama a Pluggy e a interface esconde "Conectar banco".

## Contratos novos (`src/regras-de-negocio/`)
```ts
// importacao-de-extrato/
interface LeitorDeExtrato { ler(conteudo: string): ExtratoLido } // OfxSicredi; lança ErroDeNegocio('arquivo_invalido')
type ExtratoLido = { banco: string | null; conta: ContaDoProvedor; periodo: { de: DataISO; ate: DataISO }; transacoes: TransacaoDoProvedor[] }
interface ServicoDeImportacao {
  importar(ctx, arquivo: File): Promise<{ importacaoId: Id; novas: number; atualizadas: number; periodo: { de: DataISO; ate: DataISO }; comprovantesConciliados: number }>
  listarImportacoes(ctx): Promise<Importacao[]>
}
// comprovantes/
interface LeitorDeComprovantes { ler(arquivo: { bytes: Uint8Array; tipoMime: string }, dica?: { chaveDeAcesso?: string }): Promise<DadosDoComprovante> }
type DadosDoComprovante = { tipo: 'pix'|'boleto'|'nfce'|'nfe'|'recibo'|'outro'; valorCentavos: Centavos; data: DataISO | null; emissor: string | null; documentoEmissor: string | null; chaveDeAcesso: string | null; itens: { descricao: string; quantidade: number | null; valorCentavos: Centavos | null }[]; confianca: number }
interface ServicoDeComprovantes {
  enviar(ctx, arquivo: File, dica?: { chaveDeAcesso?: string }): Promise<Comprovante>   // lê, salva, tenta conciliar
  listar(ctx, filtros?: { situacao?: SituacaoDoComprovante }): Promise<Comprovante[]>
  conciliarManualmente(ctx, comprovanteId: Id, transacaoId: Id): Promise<Comprovante>
  corrigirDados(ctx, comprovanteId: Id, dados: Partial<DadosDoComprovante>): Promise<Comprovante>
  reconciliarPendentes(empresaId: Id): Promise<number>   // chamado após cada importação
  remover(ctx, comprovanteId: Id): Promise<void>
}
type SituacaoDoComprovante = 'lendo' | 'conciliado' | 'pendente' | 'ambiguo' | 'erro_de_leitura'
function extrairChaveDeAcessoDoQr(conteudoDoQr: string): string | null   // ferramentas-internas
```

## Banco (nova migração)
- `conexoes.provedor` aceita `'pluggy' | 'arquivo'`.
- Nova tabela `importacoes_de_extrato`: empresa_id, conexao_id, conta_id, nome_do_arquivo, periodo_de, periodo_ate, novas, atualizadas, criado_em.
- Nova tabela `comprovantes`: empresa_id, anexo_id (arquivo), transacao_id (nulo até conciliar), situacao, tipo, valor numeric(14,2), data, emissor, documento_emissor (mascarado na interface), chave_de_acesso (único por empresa quando não nulo), itens jsonb, confianca, erro, timestamps.
- `anexos.transacao_id` passa a aceitar nulo (comprovante ainda sem transação). O caminho no bucket vira `{empresa_id}/comprovantes/{comprovante_id}/{arquivo}`.
- RLS forçada e policies por empresa, como nas demais tabelas.

### Como foi implementado (migração `20261010120000_importacao_e_comprovantes`)
Desvios e complementos em relação à lista acima, no espírito da ADR 0013:
1. **O arquivo aponta para o comprovante, não o contrário.** Em vez de `comprovantes.anexo_id`, existe `anexos.comprovante_id` (FK composta `(empresa_id, comprovante_id)`, `on delete cascade`, no máximo um arquivo por comprovante). O comprovante é criado primeiro (`lendo`), o arquivo vai para `{empresa_id}/comprovantes/{comprovante_id}/{arquivo}` e o anexo é gravado em seguida, sem referência circular.
2. **Anexo pertence a exatamente uma transação ou um comprovante** (`num_nonnulls(transacao_id, comprovante_id) = 1`), e o check do caminho segue o dono. Ao conciliar, só `comprovantes.transacao_id` muda; o anexo do comprovante continua com `transacao_id` nulo. Os arquivos de uma transação = anexos dela + anexos dos comprovantes conciliados com ela. Motivo: a FK `anexos → transacoes` é `on delete cascade`; se o arquivo do comprovante ficasse preso à transação, apagar a transação apagaria o arquivo e deixaria o comprovante órfão.
3. **`conciliado` ⇔ `transacao_id` preenchido** (check). `comprovantes → transacoes` é `on delete set null (transacao_id)`, e o gatilho `privado.desconciliar_comprovante_sem_transacao` devolve o comprovante para `pendente` quando a transação some (ex.: conta removida), em vez de o check quebrar o delete.
4. **Chave de acesso única**: `unique (empresa_id, chave_de_acesso)` comum em vez de índice parcial. Como `NULL`s são distintos, o efeito é o mesmo e a constraint serve de alvo para `on conflict` / `upsert` sem predicado.
5. **Checks extras**: `chave_de_acesso` com 44 dígitos; `documento_emissor` só dígitos (11 ou 14; o app normaliza e a interface mascara); `valor > 0` (valor absoluto, nulo enquanto `lendo`/`erro_de_leitura`); `tipo` nulo enquanto não lido; `itens` sempre array; `confianca` 0–1; `erro` até 500 caracteres; `importacoes_de_extrato.periodo_de <= periodo_ate`, contadores ≥ 0.
6. **`comprovantes.enviado_por`** (como em `anexos`), para auditoria.
7. **Grants**: `importacoes_de_extrato` só `select` para `authenticated` (a importação grava transações, então roda com service role); `comprovantes` com select/insert/update/delete. As policies do Storage não mudaram: já aceitavam qualquer caminho cuja primeira pasta é a empresa do usuário.
8. **Conexão `arquivo`**: convenção de uma por empresa com `id_externo = empresa_id::text` (o `unique (provedor, id_externo)` existente garante a unicidade e serve de alvo de upsert).
9. **RPC `candidatos_para_conciliacao(p_empresa uuid, p_valor_centavos bigint, p_data date, p_tolerancia_dias integer default 3)`** (`security invoker`) devolve `(id, data, valor_centavos, descricao, contraparte)` das transações com valor ±igual e data na janela (tolerância limitada a 0–31), usando o índice `transacoes (empresa_id, valor, data)`. O desempate por semelhança de nome fica no app (regra de negócio testável sem banco). A RPC não exclui transações já conciliadas; quem exclui é o app, na conciliação **automática** (RF-39). A conciliação manual continua livre, e um Pix e a NFC-e da mesma compra podem apontar para a mesma transação.

### Complementos (migração `20261010130000_campos_corrigidos`, backend)
10. **Campos corrigidos (RF-41)**: `comprovantes.campos_corrigidos text[]`. `corrigirDados` acrescenta os campos editados, e "Tentar ler de novo" (`lerDeNovo`) não os sobrescreve.
11. **Teto mensal de leituras (RNF-26)**: `comprovantes.leituras_ia_em timestamptz[]` recebe o instante de cada leitura pela IA (envio e releitura). `public.leituras_de_comprovante_desde(p_empresa, p_desde)` (`security invoker`) conta as leituras desde o início do mês em America/Araguaina. Limitação aceita: as leituras de um comprovante apagado deixam de contar.
12. **Atomicidade da importação (RF-32)**: não há transação de banco envolvendo o arquivo. As transações são gravadas em lotes de upsert por `(empresa_id, id_externo)`, e o registro em `importacoes_de_extrato` só é gravado **depois** de todas elas. Se a importação cair no meio, parte dos lançamentos fica gravada, mas sem registro no histórico. Como o upsert é idempotente e nunca toca a categoria, reenviar o mesmo arquivo completa a importação sem duplicar nada (coberto por teste).
13. **Identificador dos lançamentos**: `id_externo = ofx:{hash da conta}:{FITID}` (com sufixo `~n` para FITID repetido com outro conteúdo ou ausente), para que dois extratos de contas diferentes não colidam.
14. **Cron**: com `RECURSO_OPEN_FINANCE` desligado, não chama a Pluggy. Com a flag ligada ou desligada, reconcilia os comprovantes `pendente` de todas as empresas (`reconciliarTodas`).

## Consequências
- Custo de agregador zero. Custo da IA estimado em centavos por comprovante.
- O objetivo original "sem enviar nada" vira "um upload de extrato por semana ou mês, mais fotos opcionais".
- A interface troca "Conexões bancárias" (`/conexoes-bancarias`) por **"Importar"** (`/importar`: extrato + comprovantes) e ganha **"Comprovantes"** (`/comprovantes`).
- Os requisitos RF-05 a RF-13 e RF-29 passam a valer só com `RECURSO_OPEN_FINANCE=true`. Os novos requisitos de importação e comprovantes são adicionados à especificação.
- LGPD: a imagem do comprovante é enviada à API da Anthropic, o que é inevitável para ler. Fica registrado na política de dados e no `premissas.md`.
