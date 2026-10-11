-- Seed de DESENVOLVIMENTO (roda só em `supabase db reset` / `supabase start` local). Nunca em produção.
-- Empresa de demonstração: prestadora de serviços técnicos de Palmas/TO (refrigeração, elétrica, incêndio),
-- ~120 transações nos 6 últimos meses (datas relativas a current_date). Ver banco-de-dados/seeds/README.md.

-- Ids fixos para facilitar testes manuais.
-- empresa:  00000000-0000-4000-a000-000000000001
-- conexão:  00000000-0000-4000-a000-000000000101 (arquivo)
-- importação: ...0301; comprovantes: ...0401 a ...0406
-- contas:   ...0201 (corrente), ...0202 (poupança)

insert into public.empresas (id, nome)
values ('00000000-0000-4000-a000-000000000001', 'Tocantins Climatização e Elétrica (demo)')
on conflict (id) do nothing;

select privado.semear_empresa('00000000-0000-4000-a000-000000000001');

-- Origem = extrato OFX importado (ADR 0016): conexão 'arquivo', id_externo = empresa_id.
insert into public.conexoes (id, empresa_id, provedor, id_externo, banco, status, ultima_sincronizacao_em)
values ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000001', 'arquivo',
        '00000000-0000-4000-a000-000000000001', 'Sicredi', 'atualizada', now())
on conflict (id) do nothing;

insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo, numero, saldo)
values
  ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101',
   'demo-conta-corrente', 'Conta Corrente PJ', 'corrente', '4821', 18432.57),
  ('00000000-0000-4000-a000-000000000202', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000101',
   'demo-conta-poupanca', 'Poupança PJ', 'poupanca', '4821', 12000.00)
on conflict (id) do nothing;

-- 20 modelos × 6 meses = 120 transações. Valores variam de forma determinística (setseed).
select setseed(0.2026);

with modelos (ordem, dia, descricao, contraparte, metodo, valor_base, variacao, conta) as (
  values
    (1,  5, 'PIX RECEBIDO CONDOMINIO RES PALMAS PARK',   'CONDOMINIO RES PALMAS PARK',   'PIX',    4800.00, 0.15, 'corrente'),
    (2, 10, 'PIX RECEBIDO CONDOMINIO ED ARAGUAIA',       'CONDOMINIO ED ARAGUAIA',       'PIX',    3200.00, 0.20, 'corrente'),
    (3, 15, 'TED RECEBIDA SUPERMERCADO QUADRA 104 LTDA', 'SUPERMERCADO QUADRA 104 LTDA', 'TED',    6500.00, 0.25, 'corrente'),
    (4, 20, 'PIX RECEBIDO CLINICA SAO LUCAS LTDA',       'CLINICA SAO LUCAS LTDA',       'PIX',    2750.00, 0.30, 'corrente'),
    (5,  3, 'PIX ENVIADO POSTO SAO JOAO',                'POSTO SAO JOAO',               'PIX',    -280.00, 0.30, 'corrente'),
    (6, 17, 'COMPRA CARTAO POSTO ESTRELA DO NORTE',      'POSTO ESTRELA DO NORTE',       'CARTAO', -350.00, 0.30, 'corrente'),
    (7,  8, 'COMPRA CARTAO ELETRICA TOCANTINS',          'ELETRICA TOCANTINS',           'CARTAO', -1250.00, 0.40, 'corrente'),
    (8, 12, 'PIX ENVIADO REFRIGERACAO POLAR PECAS',      'REFRIGERACAO POLAR PECAS',     'PIX',    -980.00, 0.40, 'corrente'),
    (9, 22, 'COMPRA CARTAO EXTINTORES PALMAS',           'EXTINTORES PALMAS',            'CARTAO', -620.00, 0.35, 'corrente'),
    (10, 1, 'TARIFA PACOTE SERVICOS',                    null,                           null,     -89.90, 0.00, 'corrente'),
    (11, 1, 'IOF SALDO DEVEDOR',                         null,                           null,     -12.35, 0.50, 'corrente'),
    (12, 20, 'DARF',                                     'RECEITA FEDERAL',              'BOLETO', -740.00, 0.20, 'corrente'),
    (13, 20, 'PAGAMENTO SIMPLES NACIONAL',               'RECEITA FEDERAL',              'BOLETO', -1890.00, 0.20, 'corrente'),
    (14, 10, 'PAGAMENTO BOLETO ENERGISA TOCANTINS',      'ENERGISA TOCANTINS',           'BOLETO', -420.00, 0.25, 'corrente'),
    (15, 5, 'PIX ENVIADO ALUGUEL GALPAO TAQUARALTO',     'IMOBILIARIA SERRA DO LAJEADO', 'PIX',    -2500.00, 0.00, 'corrente'),
    (16, 14, 'PIX ENVIADO RESTAURANTE SABOR DO CERRADO', 'RESTAURANTE SABOR DO CERRADO', 'PIX',    -78.00, 0.50, 'corrente'),
    (17, 5, 'PIX ENVIADO FOLHA PAGAMENTO TECNICOS',      null,                           'PIX',    -5400.00, 0.05, 'corrente'),
    (18, 7, 'PAGAMENTO FGTS',                            'CAIXA ECONOMICA FEDERAL',      'BOLETO', -480.00, 0.05, 'corrente'),
    (19, 25, 'TRANSF ENTRE CONTAS APLICACAO POUPANCA',   null,                           'TED',    -2000.00, 0.00, 'corrente'),
    (20, 25, 'TRANSF ENTRE CONTAS RESGATE CORRENTE',     null,                           'TED',    2000.00, 0.00, 'poupanca')
),
meses as (
  select m, (date_trunc('month', current_date) - make_interval(months => m))::date as inicio
  from generate_series(0, 5) as m
),
linhas as (
  select
    me.m, mo.ordem,
    least(me.inicio + (mo.dia - 1), current_date) as data,
    mo.descricao, mo.contraparte, mo.metodo, mo.conta,
    round((mo.valor_base * (1 + mo.variacao * (random() * 2 - 1)))::numeric, 2) as valor
  from meses me
  cross join modelos mo
  order by me.m, mo.ordem
)
insert into public.transacoes (
  empresa_id, conexao_id, conta_id, id_externo, data, descricao, descricao_original,
  valor, pendente, contraparte, metodo_de_pagamento
)
select
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000101',
  case l.conta when 'corrente' then '00000000-0000-4000-a000-000000000201'::uuid
               else '00000000-0000-4000-a000-000000000202'::uuid end,
  format('demo-tx-%s-%s', l.m, l.ordem),
  l.data, l.descricao, l.descricao,
  l.valor,
  l.m = 0 and l.ordem = 4, -- uma transação pendente no mês atual
  l.contraparte, l.metodo
from linhas l
on conflict (empresa_id, id_externo) do nothing;

-- Categorização automática pelas regras padrão (contém o padrão; menor prioridade vence).
update public.transacoes t
set categoria_id = r.categoria_id,
    centro_de_custo_id = r.centro_de_custo_id,
    categoria_origem = 'regra',
    regra_id = r.regra_id,
    categorizacao_automatica_em = now()
from (
  select distinct on (tx.id) tx.id as transacao_id, rc.id as regra_id, rc.categoria_id, rc.centro_de_custo_id
  from public.transacoes tx
  join public.regras_categorizacao rc
    on rc.empresa_id = tx.empresa_id and rc.ativa and rc.campo = 'descricao' and strpos(tx.descricao, rc.padrao) > 0
  where tx.empresa_id = '00000000-0000-4000-a000-000000000001'
  order by tx.id, rc.prioridade, rc.criado_em
) r
where t.id = r.transacao_id
  and not t.categoria_definida_pelo_usuario;

-- Correções feitas "pelo usuário" (exceto no mês atual, para haver itens "Sem categoria" no painel).
with correcoes (trecho, categoria, centro) as (
  values
    ('CONDOMINIO', 'Receita de serviços', 'Elétrica'),
    ('SUPERMERCADO', 'Receita de serviços', 'Ar-condicionado/Refrigeração'),
    ('CLINICA', 'Receita de serviços', 'Prevenção contra incêndio'),
    ('ELETRICA TOCANTINS', 'Material elétrico', 'Elétrica'),
    ('REFRIGERACAO POLAR', 'Peças de refrigeração', 'Ar-condicionado/Refrigeração'),
    ('EXTINTORES', 'Equipamentos de incêndio', 'Prevenção contra incêndio'),
    ('ENERGISA', 'Contas de consumo (água, luz, internet, telefone)', 'Administrativo'),
    ('FOLHA PAGAMENTO', 'Folha de pagamento', 'Administrativo'),
    ('TRANSF ENTRE CONTAS', 'Transferências', null)
)
update public.transacoes t
set categoria_id = c.id,
    centro_de_custo_id = cc.id,
    categoria_origem = 'usuario',
    categoria_definida_pelo_usuario = true,
    regra_id = null,
    confianca_ia = null
from correcoes co
join public.categorias c on c.empresa_id = '00000000-0000-4000-a000-000000000001' and c.nome = co.categoria
left join public.centros_de_custo cc on cc.empresa_id = '00000000-0000-4000-a000-000000000001' and cc.nome = co.centro
where t.empresa_id = '00000000-0000-4000-a000-000000000001'
  and strpos(t.descricao, co.trecho) > 0
  and (t.data < date_trunc('month', current_date) or co.trecho = 'TRANSF ENTRE CONTAS');

-- Importação de exemplo (o extrato OFX que "trouxe" as transações acima).
insert into public.importacoes_de_extrato (id, empresa_id, conexao_id, conta_id, nome_do_arquivo, periodo_de, periodo_ate, novas, atualizadas)
select '00000000-0000-4000-a000-000000000301', '00000000-0000-4000-a000-000000000001',
       '00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000201',
       'extrato-sicredi.ofx', min(t.data), max(t.data), count(*), 0
from public.transacoes t
where t.conta_id = '00000000-0000-4000-a000-000000000201'
on conflict (id) do nothing;

-- Comprovantes em situações variadas (sem arquivo no Storage: só os dados lidos).
-- Conciliados: valor e data (±3 dias) da transação do mês passado.
insert into public.comprovantes (id, empresa_id, transacao_id, situacao, tipo, valor, data, emissor, documento_emissor, chave_de_acesso, itens, confianca)
select c.id::uuid, '00000000-0000-4000-a000-000000000001', t.id, 'conciliado', c.tipo, abs(t.valor), t.data + c.desvio,
       c.emissor, c.documento, c.chave, c.itens::jsonb, c.confianca
from (values
  ('00000000-0000-4000-a000-000000000401', 'demo-tx-1-5', 'pix', 0, 'POSTO SAO JOAO LTDA', '12345678000190', null,
   '[]', 0.97),
  ('00000000-0000-4000-a000-000000000402', 'demo-tx-1-7', 'nfce', 0, 'ELETRICA TOCANTINS LTDA', '23456789000101',
   '17260923456789000101650010000123451000123456',
   '[{"descricao":"CABO FLEXIVEL 2,5MM 100M","quantidade":2,"valor_centavos":null},{"descricao":"DISJUNTOR BIPOLAR 32A","quantidade":4,"valor_centavos":null}]',
   0.92),
  ('00000000-0000-4000-a000-000000000403', 'demo-tx-1-14', 'boleto', 1, 'ENERGISA TOCANTINS DISTRIBUIDORA DE ENERGIA', '25086034000171', null,
   '[]', 0.95)
) as c (id, id_externo, tipo, desvio, emissor, documento, chave, itens, confianca)
join public.transacoes t on t.empresa_id = '00000000-0000-4000-a000-000000000001' and t.id_externo = c.id_externo
on conflict (id) do nothing;

insert into public.comprovantes (id, empresa_id, situacao, tipo, valor, data, emissor, documento_emissor, itens, confianca, erro)
values
  -- Ambíguo: aplicação (-2000) e resgate (+2000) no mesmo dia têm o mesmo valor absoluto.
  ('00000000-0000-4000-a000-000000000404', '00000000-0000-4000-a000-000000000001', 'ambiguo', 'recibo', 2000.00,
   (date_trunc('month', current_date) - interval '1 month')::date + 24, null, null, '[]', 0.80, null),
  -- Pendente: o extrato de hoje ainda não foi importado.
  ('00000000-0000-4000-a000-000000000405', '00000000-0000-4000-a000-000000000001', 'pendente', 'nfce', 156.40,
   current_date, 'REFRIGERACAO POLAR PECAS', '34567890000112',
   '[{"descricao":"GAS R410A 750G","quantidade":1,"valor_centavos":12900},{"descricao":"FITA PVC","quantidade":2,"valor_centavos":1370}]',
   0.88, null),
  ('00000000-0000-4000-a000-000000000406', '00000000-0000-4000-a000-000000000001', 'erro_de_leitura', null, null,
   null, null, null, '[]', null, 'Imagem ilegível: envie uma foto mais nítida.')
on conflict (id) do nothing;

-- Associa um usuário de login local à empresa de demonstração (só existe no seed, nunca em migração).
-- Uso (Studio SQL editor ou psql, como postgres): select privado.dev_vincular_usuario_a_demo('voce@exemplo.com');
create or replace function privado.dev_vincular_usuario_a_demo(p_email text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  select u.id into v_uid from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_uid is null then
    raise exception 'usuario % nao encontrado: entre uma vez pelo link magico antes', p_email;
  end if;
  -- Remove a empresa vazia criada pelo primeiro login (se o usuário for o único membro dela).
  delete from public.empresas e
  where e.id in (select m.empresa_id from public.membros_empresa m where m.user_id = v_uid)
    and e.id <> '00000000-0000-4000-a000-000000000001'
    and not exists (
      select 1 from public.membros_empresa o where o.empresa_id = e.id and o.user_id <> v_uid
    );
  insert into public.membros_empresa (empresa_id, user_id, papel)
  values ('00000000-0000-4000-a000-000000000001', v_uid, 'dono')
  on conflict (empresa_id, user_id) do nothing;
  return v_uid;
end;
$$;

revoke all on function privado.dev_vincular_usuario_a_demo(text) from public, anon, authenticated, service_role;
