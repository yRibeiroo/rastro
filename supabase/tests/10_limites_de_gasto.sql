-- Limites de gasto (Fase 6, ADR 0017): CRUD pela sessão, isolamento e validações.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role)
values
  ('aaaa1111-0000-4000-a000-000000000001', 'l@teste.local', 'authenticated', 'authenticated'),
  ('aaaa1111-0000-4000-a000-000000000002', 'l2@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values
  ('aaaa1111-0000-4000-a000-0000000000e1', 'L'),
  ('aaaa1111-0000-4000-a000-0000000000e2', 'Outra');
insert into public.membros_empresa (empresa_id, user_id) values
  ('aaaa1111-0000-4000-a000-0000000000e1', 'aaaa1111-0000-4000-a000-000000000001'),
  ('aaaa1111-0000-4000-a000-0000000000e2', 'aaaa1111-0000-4000-a000-000000000002');
select privado.semear_por_perfil('aaaa1111-0000-4000-a000-0000000000e1', 'pessoal');
select privado.semear_por_perfil('aaaa1111-0000-4000-a000-0000000000e2', 'pessoal');

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids
select 'mercado_a', id from public.categorias where empresa_id = 'aaaa1111-0000-4000-a000-0000000000e1' and nome = 'Mercado'
union all
select 'mercado_b', id from public.categorias where empresa_id = 'aaaa1111-0000-4000-a000-0000000000e2' and nome = 'Mercado';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaa1111-0000-4000-a000-000000000001","role":"authenticated"}', true);

select lives_ok(format($$insert into public.limites_de_gasto (empresa_id, categoria_id, valor_mensal)
  values ('aaaa1111-0000-4000-a000-0000000000e1', %L, 800)$$, (select id from ids where nome = 'mercado_a')), 'define o limite');
select throws_ok(format($$insert into public.limites_de_gasto (empresa_id, categoria_id, valor_mensal)
  values ('aaaa1111-0000-4000-a000-0000000000e1', %L, 900)$$, (select id from ids where nome = 'mercado_a')),
  '23505', null, 'um limite por categoria');
select throws_ok(format($$insert into public.limites_de_gasto (empresa_id, categoria_id, valor_mensal)
  values ('aaaa1111-0000-4000-a000-0000000000e1', %L, 0)$$, (select id from ids where nome = 'mercado_a')),
  '23514', null, 'valor precisa ser positivo');
select throws_ok(format($$insert into public.limites_de_gasto (empresa_id, categoria_id, valor_mensal)
  values ('aaaa1111-0000-4000-a000-0000000000e1', %L, 100)$$, (select id from ids where nome = 'mercado_b')),
  '23503', null, 'categoria de outra empresa recusada');
select throws_ok(format($$insert into public.limites_de_gasto (empresa_id, categoria_id, valor_mensal)
  values ('aaaa1111-0000-4000-a000-0000000000e2', %L, 100)$$, (select id from ids where nome = 'mercado_b')),
  '42501', null, 'não cria limite em empresa alheia (RLS)');

select set_config('request.jwt.claims', '{"sub":"aaaa1111-0000-4000-a000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.limites_de_gasto), 0::bigint, 'B não vê os limites de A');
update public.limites_de_gasto set valor_mensal = 1;
reset role;
select is((select valor_mensal from public.limites_de_gasto where empresa_id = 'aaaa1111-0000-4000-a000-0000000000e1'), 800.00,
  'B não altera os limites de A');

select * from finish();
rollback;
