-- garantir_empresa: idempotente, cria membro dono e sementes; exige usuário autenticado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role)
values ('cccccccc-0000-4000-a000-000000000001', 'c@teste.local', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-a000-000000000001","role":"authenticated"}', true);

create temp table resultado on commit drop as
select public.garantir_empresa('  Refrigeração Palmas  ') as primeira, public.garantir_empresa('Outro nome') as segunda;

select isnt((select primeira from resultado), null, 'retorna um id');
select is((select segunda from resultado), (select primeira from resultado), 'segunda chamada devolve a mesma empresa');
select is((select count(*) from public.empresas), 1::bigint, 'só uma empresa criada');
select is((select nome from public.empresas), 'Refrigeração Palmas', 'nome aparado');
select is((select papel from public.membros_empresa), 'dono', 'membro dono');
select is((select count(*) from public.categorias where padrao), 18::bigint, '18 categorias padrão');
select is((select count(*) from public.categorias where not entra_no_resultado), 1::bigint, 'só Transferências fora do resultado');
select is((select count(*) from public.centros_de_custo where padrao), 4::bigint, '4 centros de custo padrão');
select is((select count(*) from public.regras_categorizacao where origem = 'padrao'), 11::bigint, '11 regras padrão');

-- Sem sessão (auth.uid() nulo): recusa.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.garantir_empresa('x')$$, '42501', 'nao_autenticado', 'sem usuário: nao_autenticado');

reset role;
select is((select count(*) from public.empresas e join public.membros_empresa m on m.empresa_id = e.id
           where m.user_id = 'cccccccc-0000-4000-a000-000000000001'), 1::bigint, 'uma membership no total');

select * from finish();
rollback;
