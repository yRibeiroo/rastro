-- Painéis: somas em centavos, meses vazios com zero, ignora transferências e pendentes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role)
values ('dddddddd-0000-4000-a000-000000000001', 'd@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values ('dddddddd-0000-4000-a000-0000000000e0', 'Painel');
insert into public.membros_empresa (empresa_id, user_id)
values ('dddddddd-0000-4000-a000-0000000000e0', 'dddddddd-0000-4000-a000-000000000001');
select privado.semear_empresa('dddddddd-0000-4000-a000-0000000000e0');
insert into public.conexoes (id, empresa_id, id_externo, status)
values ('dddddddd-0000-4000-a000-0000000000c0', 'dddddddd-0000-4000-a000-0000000000e0', 'item-d', 'atualizada');
insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo)
values ('dddddddd-0000-4000-a000-0000000000c1', 'dddddddd-0000-4000-a000-0000000000e0', 'dddddddd-0000-4000-a000-0000000000c0', 'c', 'CC', 'corrente');

with cat as (
  select nome, id from public.categorias where empresa_id = 'dddddddd-0000-4000-a000-0000000000e0'
), cc as (
  select id from public.centros_de_custo where empresa_id = 'dddddddd-0000-4000-a000-0000000000e0' and nome = 'Elétrica'
)
insert into public.transacoes (empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor, pendente, categoria_id, centro_de_custo_id, categoria_origem)
select 'dddddddd-0000-4000-a000-0000000000e0', 'dddddddd-0000-4000-a000-0000000000c0', 'dddddddd-0000-4000-a000-0000000000c1',
       v.ide, v.data::date, v.descricao, v.valor, v.pendente,
       (select id from cat where nome = v.categoria),
       case when v.eletrica then (select id from cc) end,
       case when v.categoria is not null then 'regra' end
from (values
  ('1', '2026-01-05', 'PIX RECEBIDO', 1000.00, false, 'Receita de serviços', true),
  ('2', '2026-01-06', 'POSTO', -200.50, false, 'Combustível', true),
  ('3', '2026-01-07', 'SEM CAT', -99.50, false, null, false),
  ('4', '2026-01-08', 'TRANSF SAIDA', -500.00, false, 'Transferências', false),
  ('5', '2026-01-08', 'TRANSF ENTRADA', 500.00, false, 'Transferências', false),
  ('6', '2026-01-09', 'POSTO PENDENTE', -300.00, true, 'Combustível', true),
  ('7', '2026-03-31', 'PIX RECEBIDO', 10.01, false, null, false),
  ('8', '2026-04-01', 'FORA DO PERIODO', 999.00, false, null, false)
) as v (ide, data, descricao, valor, pendente, categoria, eletrica);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-4000-a000-000000000001","role":"authenticated"}', true);

select results_eq(
  $$select mes, entradas_centavos, saidas_centavos from public.painel_fluxo_mensal('dddddddd-0000-4000-a000-0000000000e0', '2026-01-01', '2026-03-31')$$,
  $$values ('2026-01', 100000::bigint, 30000::bigint), ('2026-02', 0::bigint, 0::bigint), ('2026-03', 1001::bigint, 0::bigint)$$,
  'fluxo mensal: sem transferências, sem pendentes, meses vazios com zero'
);

select results_eq(
  $$select nome, total_centavos, quantidade from public.painel_por_categoria('dddddddd-0000-4000-a000-0000000000e0', '2026-01-01', '2026-03-31')$$,
  $$values ('Combustível', 20050::bigint, 1), ('Sem categoria', 9950::bigint, 1)$$,
  'por categoria: só saídas, positivo, sem transferências'
);
select is(
  (select categoria_id from public.painel_por_categoria('dddddddd-0000-4000-a000-0000000000e0', '2026-01-01', '2026-03-31') where nome = 'Sem categoria'),
  null, 'Sem categoria tem categoria_id nulo'
);

select results_eq(
  $$select nome, entradas_centavos, saidas_centavos from public.painel_por_centro_de_custo('dddddddd-0000-4000-a000-0000000000e0', '2026-01-01', '2026-03-31')$$,
  $$values ('Elétrica', 100000::bigint, 20050::bigint), ('Sem centro de custo', 1001::bigint, 9950::bigint)$$,
  'por centro de custo: entradas e saídas, sem transferências'
);

select throws_ok($$select * from public.painel_fluxo_mensal('dddddddd-0000-4000-a000-0000000000e0', '2026-03-01', '2026-01-01')$$, '22023', 'periodo_invalido', 'período invertido');
select throws_ok($$select * from public.painel_fluxo_mensal('dddddddd-0000-4000-a000-0000000000e0', '2020-01-01', '2026-01-01')$$, '22023', 'periodo_invalido', 'período acima de 24 meses');
select lives_ok($$select * from public.painel_fluxo_mensal('dddddddd-0000-4000-a000-0000000000e0', '2024-11-01', '2026-10-31')$$, '24 meses aceitos');

-- Arquivar "Transferências" como entra_no_resultado = true passa a contar.
reset role;
update public.categorias set entra_no_resultado = true where empresa_id = 'dddddddd-0000-4000-a000-0000000000e0' and nome = 'Transferências';
set local role authenticated;
select is(
  (select entradas_centavos from public.painel_fluxo_mensal('dddddddd-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')),
  150000::bigint, 'entra_no_resultado é respeitado'
);

-- Outra sessão sem membership não vê nada.
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-a000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*) from public.painel_por_centro_de_custo('dddddddd-0000-4000-a000-0000000000e0', '2026-01-01', '2026-03-31')),
  0::bigint, 'não-membro vê painel vazio'
);

select * from finish();
rollback;
