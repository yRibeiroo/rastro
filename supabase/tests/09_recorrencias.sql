-- Recorrências e saldo previsto (Fase 4, ADR 0017).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role)
values
  ('99999999-0000-4000-a000-000000000001', 'r@teste.local', 'authenticated', 'authenticated'),
  ('99999999-0000-4000-a000-000000000002', 'r2@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values
  ('99999999-0000-4000-a000-0000000000e1', 'R'),
  ('99999999-0000-4000-a000-0000000000e2', 'Outra');
insert into public.membros_empresa (empresa_id, user_id) values
  ('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-000000000001'),
  ('99999999-0000-4000-a000-0000000000e2', '99999999-0000-4000-a000-000000000002');
-- Conta de banco
insert into public.conexoes (id, empresa_id, id_externo, status)
values ('99999999-0000-4000-a000-0000000000c0', '99999999-0000-4000-a000-0000000000e1', 'item-r', 'atualizada');
insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo, saldo)
values ('99999999-0000-4000-a000-0000000000c1', '99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000c0', 'cc', 'Banco', 'corrente', 1000);

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-a000-000000000001","role":"authenticated"}', true);

insert into ids values ('carteira', public.criar_conta_manual('99999999-0000-4000-a000-0000000000e1', 'Carteira', 'dinheiro', 500));

-- Aluguel no banco todo dia 31 (até abril); mesada semanal na carteira.
insert into public.recorrencias (id, empresa_id, conta_id, descricao, valor, frequencia, inicio, fim) values
  ('99999999-0000-4000-a000-0000000000f1', '99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000c1',
   'Aluguel', -1500, 'mensal', '2027-01-31', '2027-04-30'),
  ('99999999-0000-4000-a000-0000000000f2', '99999999-0000-4000-a000-0000000000e1', (select id from ids where nome = 'carteira'),
   'Mesada', -50, 'semanal', '2027-01-04', null);

select results_eq(
  $$select data from public.ocorrencias_previstas('99999999-0000-4000-a000-0000000000e1', '2027-01-01', '2027-12-31')
    where recorrencia_id = '99999999-0000-4000-a000-0000000000f1'$$,
  $$values ('2027-01-31'::date), ('2027-02-28'), ('2027-03-31'), ('2027-04-30')$$,
  'mensal no dia 31: fim do mês sem escorregar, e respeita o fim');
select results_eq(
  $$select data, valor_centavos, conta_manual from public.ocorrencias_previstas('99999999-0000-4000-a000-0000000000e1', '2027-01-01', '2027-01-20')
    where recorrencia_id = '99999999-0000-4000-a000-0000000000f2'$$,
  $$values ('2027-01-04'::date, -5000::bigint, true), ('2027-01-11', -5000::bigint, true), ('2027-01-18', -5000::bigint, true)$$,
  'semanal, em centavos, marca a conta manual');
select throws_ok($$select * from public.ocorrencias_previstas('99999999-0000-4000-a000-0000000000e1', '2027-01-01', '2030-01-01')$$,
  '22023', 'periodo_invalido', 'período longo demais');

-- Baixa na conta manual: lança e ajusta o saldo.
select isnt(public.baixar_ocorrencia('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f2', '2027-01-04'),
  null, 'conta manual: baixa gera lançamento');
select is((select saldo from public.contas where id = (select id from ids where nome = 'carteira')), 450.00, 'saldo da carteira 500 - 50');
select is((select count(*) from public.ocorrencias_previstas('99999999-0000-4000-a000-0000000000e1', '2027-01-01', '2027-01-20')
  where recorrencia_id = '99999999-0000-4000-a000-0000000000f2'), 2::bigint, 'baixada sai da previsão');
-- Pular (sem lançar)
select is(public.baixar_ocorrencia('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f2', '2027-01-11', false),
  null, 'pular: sem lançamento');
select is((select saldo from public.contas where id = (select id from ids where nome = 'carteira')), 450.00, 'pular não mexe no saldo');

-- Baixa em conta de banco: só marca.
select is(public.baixar_ocorrencia('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f1', '2027-02-28'),
  null, 'conta de banco: só marca');
select is((select saldo from public.contas where id = '99999999-0000-4000-a000-0000000000c1'), 1000.00, 'saldo do banco intocado');

select throws_ok($$select public.baixar_ocorrencia('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f1', '2027-02-27')$$,
  '22023', 'data_invalida', 'data que não é ocorrência');
select throws_ok($$select public.baixar_ocorrencia('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f1', '2027-05-31')$$,
  '22023', 'data_invalida', 'depois do fim');
select throws_ok($$select public.baixar_ocorrencia('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f1', '2027-02-28')$$,
  '22023', 'ocorrencia_ja_baixada', 'baixa repetida');
select throws_ok($$insert into public.baixas_de_recorrencia (empresa_id, recorrencia_id, data)
  values ('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f1', '2027-03-31')$$,
  '42501', null, 'baixa só pela RPC');

-- Outra empresa não vê nem baixa.
select set_config('request.jwt.claims', '{"sub":"99999999-0000-4000-a000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.recorrencias), 0::bigint, 'B não vê as recorrências de A');
select throws_ok($$select public.baixar_ocorrencia('99999999-0000-4000-a000-0000000000e1', '99999999-0000-4000-a000-0000000000f1', '2027-03-31')$$,
  '42501', 'acesso_negado', 'B não baixa as de A');

select * from finish();
rollback;
