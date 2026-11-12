-- Fase 3 do MVP: justificativa da IA gravada só para origem 'ia' e movimento líquido por mês.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, aud, role)
values ('77777777-0000-4000-a000-000000000001', 'j@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values ('77777777-0000-4000-a000-0000000000e0', 'Justificativa');
insert into public.membros_empresa (empresa_id, user_id)
values ('77777777-0000-4000-a000-0000000000e0', '77777777-0000-4000-a000-000000000001');
insert into public.categorias (id, empresa_id, nome, tipo)
values ('77777777-0000-4000-a000-0000000000ca', '77777777-0000-4000-a000-0000000000e0', 'Combustível', 'saida');
insert into public.conexoes (id, empresa_id, id_externo, status)
values ('77777777-0000-4000-a000-0000000000c0', '77777777-0000-4000-a000-0000000000e0', 'item-j', 'atualizada');
insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo)
values ('77777777-0000-4000-a000-0000000000c1', '77777777-0000-4000-a000-0000000000e0', '77777777-0000-4000-a000-0000000000c0', 'c', 'CC', 'corrente');
insert into public.transacoes (id, empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor, pendente, oculta)
values
  ('77777777-0000-4000-a000-0000000000a1', '77777777-0000-4000-a000-0000000000e0', '77777777-0000-4000-a000-0000000000c0',
   '77777777-0000-4000-a000-0000000000c1', 'a', '2026-01-10', 'POSTO', -100, false, false),
  ('77777777-0000-4000-a000-0000000000a2', '77777777-0000-4000-a000-0000000000e0', '77777777-0000-4000-a000-0000000000c0',
   '77777777-0000-4000-a000-0000000000c1', 'b', '2026-01-11', 'APLICACAO CDB', -5000, false, true),
  ('77777777-0000-4000-a000-0000000000a3', '77777777-0000-4000-a000-0000000000e0', '77777777-0000-4000-a000-0000000000c0',
   '77777777-0000-4000-a000-0000000000c1', 'c', '2026-01-12', 'PIX PENDENTE', -900, true, false),
  ('77777777-0000-4000-a000-0000000000a4', '77777777-0000-4000-a000-0000000000e0', '77777777-0000-4000-a000-0000000000c0',
   '77777777-0000-4000-a000-0000000000c1', 'd', '2026-03-05', 'PIX RECEBIDO', 2000, false, false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-0000-4000-a000-000000000001","role":"authenticated"}', true);

select is(
  public.aplicar_categorizacao_automatica('77777777-0000-4000-a000-0000000000e0', jsonb_build_array(
    jsonb_build_object('transacao_id', '77777777-0000-4000-a000-0000000000a1', 'categoria_id', '77777777-0000-4000-a000-0000000000ca',
      'origem', 'ia', 'confianca', 0.9, 'justificativa', '  Posto de combustível.  '),
    jsonb_build_object('transacao_id', '77777777-0000-4000-a000-0000000000a4', 'categoria_id', null,
      'origem', 'regra', 'justificativa', 'não deve ser gravada')
  )),
  2, 'aplica as duas categorizações');
select is(
  (select justificativa_ia from public.transacoes where id = '77777777-0000-4000-a000-0000000000a1'),
  'Posto de combustível.', 'justificativa da IA gravada sem espaços nas pontas');
select is(
  (select justificativa_ia from public.transacoes where id = '77777777-0000-4000-a000-0000000000a4'),
  null, 'origem que não é IA não grava justificativa');

-- O saldo conta tudo o que mexe na conta: a oculta entra, a pendente não. Mês sem movimento volta zerado.
select results_eq(
  $$select mes, liquido_centavos from public.movimento_mensal('77777777-0000-4000-a000-0000000000e0', '2026-01-01', '2026-03-31')$$,
  $$values ('2026-01', -510000::bigint), ('2026-02', 0::bigint), ('2026-03', 200000::bigint)$$,
  'movimento líquido por mês');
select throws_ok(
  $$select * from public.movimento_mensal('77777777-0000-4000-a000-0000000000e0', '2026-03-01', '2026-01-01')$$,
  '22023', null, 'período invertido é recusado');

select * from finish();
rollback;
