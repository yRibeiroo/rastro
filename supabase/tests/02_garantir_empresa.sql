-- garantir_empresa: idempotente, cria membro dono e sementes por perfil (ADR 0017); exige usuário autenticado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, aud, role)
values
  ('cccccccc-0000-4000-a000-000000000001', 'c@teste.local', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-a000-000000000002', 'p@teste.local', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-a000-000000000001","role":"authenticated"}', true);

-- Perfil 'empresa' (padrão do parâmetro).
create temp table resultado on commit drop as
select public.garantir_empresa('  Refrigeração Palmas  ') as primeira, public.garantir_empresa('Outro nome', 'pessoal') as segunda;

select isnt((select primeira from resultado), null, 'retorna um id');
select is((select segunda from resultado), (select primeira from resultado), 'segunda chamada devolve a mesma empresa (perfil ignorado)');
select is((select count(*) from public.empresas), 1::bigint, 'só uma empresa criada');
select is((select nome from public.empresas), 'Refrigeração Palmas', 'nome aparado');
select is((select perfil from public.empresas), 'empresa', 'perfil padrão empresa');
select is((select papel from public.membros_empresa), 'dono', 'membro dono');
select is((select count(*) from public.categorias where padrao), 20::bigint, '20 categorias padrão (empresa)');
select is((select count(*) from public.categorias where not entra_no_resultado), 1::bigint, 'só Transferências fora do resultado');
select is((select count(*) from public.centros_de_custo where padrao), 3::bigint, '3 centros de custo padrão');
select is((select count(*) from public.regras_categorizacao where origem = 'padrao'), 12::bigint, '12 regras padrão (empresa)');

-- Perfil 'pessoal': outro usuário.
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-4000-a000-000000000002","role":"authenticated"}', true);
create temp table pessoal on commit drop as select public.garantir_empresa('', 'pessoal') as id;

select is((select nome from public.empresas where id = (select id from pessoal)), 'Minhas finanças', 'nome padrão do perfil pessoal');
select is((select perfil from public.empresas where id = (select id from pessoal)), 'pessoal', 'perfil pessoal');
select is((select count(*) from public.categorias where empresa_id = (select id from pessoal)), 22::bigint, '22 categorias (pessoal)');
select is((select count(*) from public.categorias where empresa_id = (select id from pessoal) and not entra_no_resultado), 2::bigint,
  'Transferências e Investimentos fora do resultado');
select is((select count(*) from public.centros_de_custo where empresa_id = (select id from pessoal)), 0::bigint, 'pessoal sem centros de custo');
select is((select count(*) from public.regras_categorizacao where empresa_id = (select id from pessoal)), 14::bigint, '14 regras (pessoal)');

select throws_ok($$select public.garantir_empresa('x', 'outro')$$, '22023', 'perfil_invalido', 'perfil desconhecido: perfil_invalido');

-- Sem sessão (auth.uid() nulo): recusa.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.garantir_empresa('x')$$, '42501', 'nao_autenticado', 'sem usuário: nao_autenticado');

select * from finish();
rollback;
