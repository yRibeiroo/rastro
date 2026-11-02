-- "Ocultar dos totais" (Fase 3, ADR 0017): sai dos três painéis; o usuário altera só a coluna oculta.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role)
values ('88888888-0000-4000-a000-000000000001', 'o@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values ('88888888-0000-4000-a000-0000000000e0', 'Oculta');
insert into public.membros_empresa (empresa_id, user_id)
values ('88888888-0000-4000-a000-0000000000e0', '88888888-0000-4000-a000-000000000001');
insert into public.conexoes (id, empresa_id, id_externo, status)
values ('88888888-0000-4000-a000-0000000000c0', '88888888-0000-4000-a000-0000000000e0', 'item-o', 'atualizada');
insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo)
values ('88888888-0000-4000-a000-0000000000c1', '88888888-0000-4000-a000-0000000000e0', '88888888-0000-4000-a000-0000000000c0', 'c', 'CC', 'corrente');
insert into public.transacoes (id, empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor)
values
  ('88888888-0000-4000-a000-0000000000a1', '88888888-0000-4000-a000-0000000000e0', '88888888-0000-4000-a000-0000000000c0',
   '88888888-0000-4000-a000-0000000000c1', 'v', '2026-01-10', 'MERCADO', -100),
  ('88888888-0000-4000-a000-0000000000a2', '88888888-0000-4000-a000-0000000000e0', '88888888-0000-4000-a000-0000000000c0',
   '88888888-0000-4000-a000-0000000000c1', 'o', '2026-01-11', 'APLICACAO CDB', -5000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"88888888-0000-4000-a000-000000000001","role":"authenticated"}', true);

select lives_ok($$update public.transacoes set oculta = true where id = '88888888-0000-4000-a000-0000000000a2'$$, 'usuário oculta a transação');
select throws_ok($$update public.transacoes set valor = 1 where id = '88888888-0000-4000-a000-0000000000a2'$$, '42501', null,
  'valor continua imutável pela sessão');

select results_eq(
  $$select saidas_centavos from public.painel_fluxo_mensal('88888888-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')$$,
  $$values (10000::bigint)$$, 'fluxo mensal sem a oculta');
select results_eq(
  $$select total_centavos from public.painel_por_categoria('88888888-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')$$,
  $$values (10000::bigint)$$, 'por categoria sem a oculta');
select results_eq(
  $$select saidas_centavos from public.painel_por_centro_de_custo('88888888-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')$$,
  $$values (10000::bigint)$$, 'por centro sem a oculta');

-- Reexibir volta para os totais.
update public.transacoes set oculta = false where id = '88888888-0000-4000-a000-0000000000a2';
select results_eq(
  $$select saidas_centavos from public.painel_fluxo_mensal('88888888-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')$$,
  $$values (510000::bigint)$$, 'reexibida volta para o fluxo');

select * from finish();
rollback;
