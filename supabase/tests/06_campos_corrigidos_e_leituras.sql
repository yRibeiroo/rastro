-- RF-41 / RNF-26: campos corrigidos e contagem de leituras pela IA, isolada por empresa.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, aud, role) values
  ('aaaa0000-0000-4000-a000-000000000001', 'g@teste.local', 'authenticated', 'authenticated'),
  ('bbbb0000-0000-4000-a000-000000000001', 'h@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values
  ('aaaa0000-0000-4000-a000-0000000000e0', 'Empresa G'),
  ('bbbb0000-0000-4000-a000-0000000000e0', 'Empresa H');
insert into public.membros_empresa (empresa_id, user_id) values
  ('aaaa0000-0000-4000-a000-0000000000e0', 'aaaa0000-0000-4000-a000-000000000001'),
  ('bbbb0000-0000-4000-a000-0000000000e0', 'bbbb0000-0000-4000-a000-000000000001');
insert into public.comprovantes (empresa_id, situacao, leituras_ia_em) values
  ('aaaa0000-0000-4000-a000-0000000000e0', 'pendente', array['2026-09-30 23:00-03', '2026-10-02 10:00-03', '2026-10-05 10:00-03']::timestamptz[]),
  ('aaaa0000-0000-4000-a000-0000000000e0', 'lendo', '{}'),
  ('bbbb0000-0000-4000-a000-0000000000e0', 'pendente', array['2026-10-03 10:00-03']::timestamptz[]);

select is((select campos_corrigidos from public.comprovantes where situacao = 'lendo'), '{}'::text[], 'campos_corrigidos começa vazio');
select is(public.leituras_de_comprovante_desde('aaaa0000-0000-4000-a000-0000000000e0', '2026-10-01 00:00-03'), 2,
  'conta as leituras do mês (a de setembro fica de fora)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbb0000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select is(public.leituras_de_comprovante_desde('aaaa0000-0000-4000-a000-0000000000e0', '2026-10-01 00:00-03'), 0,
  'outra empresa não enxerga as leituras (RLS)');
select is(public.leituras_de_comprovante_desde('bbbb0000-0000-4000-a000-0000000000e0', '2026-10-01 00:00-03'), 1,
  'a própria empresa enxerga as suas');
select lives_ok($$update public.comprovantes set campos_corrigidos = array['valorCentavos'] where empresa_id = 'bbbb0000-0000-4000-a000-0000000000e0'$$,
  'membro atualiza campos_corrigidos');
reset role;

set local role anon;
select throws_ok($$select public.leituras_de_comprovante_desde('aaaa0000-0000-4000-a000-0000000000e0', now())$$,
  '42501', null, 'anon não executa a função');
reset role;

select * from finish();
rollback;
