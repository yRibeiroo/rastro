-- Contas e lançamentos manuais (Fase 2, ADR 0017): saldo, isolamento entre empresas e limites.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email, aud, role)
values
  ('77777777-0000-4000-a000-000000000001', 'a@teste.local', 'authenticated', 'authenticated'),
  ('77777777-0000-4000-a000-000000000002', 'b@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values
  ('77777777-0000-4000-a000-0000000000e1', 'A'),
  ('77777777-0000-4000-a000-0000000000e2', 'B');
insert into public.membros_empresa (empresa_id, user_id) values
  ('77777777-0000-4000-a000-0000000000e1', '77777777-0000-4000-a000-000000000001'),
  ('77777777-0000-4000-a000-0000000000e2', '77777777-0000-4000-a000-000000000002');
select privado.semear_por_perfil('77777777-0000-4000-a000-0000000000e1', 'pessoal');
select privado.semear_por_perfil('77777777-0000-4000-a000-0000000000e2', 'pessoal');
-- Conta de banco (não manual) da empresa A.
insert into public.conexoes (id, empresa_id, id_externo, status)
values ('77777777-0000-4000-a000-0000000000c0', '77777777-0000-4000-a000-0000000000e1', 'item-7', 'atualizada');
insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo)
values ('77777777-0000-4000-a000-0000000000c1', '77777777-0000-4000-a000-0000000000e1', '77777777-0000-4000-a000-0000000000c0', 'cc', 'Banco', 'corrente');

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
-- Lido antes de trocar de papel: como usuário A, a RLS esconderia a categoria de B.
insert into ids select 'categoria_de_b', id from public.categorias where empresa_id = '77777777-0000-4000-a000-0000000000e2' limit 1;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"77777777-0000-4000-a000-000000000001","role":"authenticated"}', true);

-- Contas
insert into ids values ('carteira', public.criar_conta_manual('77777777-0000-4000-a000-0000000000e1', '  Carteira  ', 'dinheiro', 100));
insert into ids values ('poupanca', public.criar_conta_manual('77777777-0000-4000-a000-0000000000e1', 'Cofrinho', 'poupanca'));
select is((select nome from public.contas where id = (select id from ids where nome = 'carteira')), 'Carteira', 'nome aparado');
select is((select saldo from public.contas where id = (select id from ids where nome = 'carteira')), 100.00, 'saldo inicial');
select is((select count(*) from public.conexoes where provedor = 'manual'), 1::bigint, 'uma conexão manual por empresa');
select throws_ok($$select public.criar_conta_manual('77777777-0000-4000-a000-0000000000e1', ' ', 'dinheiro')$$, '22023', 'nome_invalido', 'nome vazio');
select throws_ok($$select public.criar_conta_manual('77777777-0000-4000-a000-0000000000e1', 'X', 'cripto')$$, '22023', 'tipo_invalido', 'tipo desconhecido');
select throws_ok($$select public.criar_conta_manual('77777777-0000-4000-a000-0000000000e2', 'X', 'dinheiro')$$, '42501', 'acesso_negado', 'conta em empresa alheia');

-- Lançamentos
insert into ids values ('gasto', public.lancar_manual('77777777-0000-4000-a000-0000000000e1', (select id from ids where nome = 'carteira'),
  '2026-11-01', 'Feira do sábado', -35.5,
  (select id from public.categorias where empresa_id = '77777777-0000-4000-a000-0000000000e1' and nome = 'Mercado')));
insert into ids values ('sem_categoria', public.lancar_manual('77777777-0000-4000-a000-0000000000e1', (select id from ids where nome = 'carteira'),
  '2026-11-02', 'Venda de bolo', 20));
select is((select saldo from public.contas where id = (select id from ids where nome = 'carteira')), 84.50, 'saldo = 100 - 35,50 + 20');
select is((select categoria_origem from public.transacoes where id = (select id from ids where nome = 'gasto')), 'usuario', 'categoria escolhida = usuario');
select ok((select categoria_definida_pelo_usuario from public.transacoes where id = (select id from ids where nome = 'gasto')), 'categoria escolhida fica travada');
select ok((select categoria_id is null and categorizacao_automatica_em is null from public.transacoes where id = (select id from ids where nome = 'sem_categoria')),
  'sem categoria: fica pendente para a categorização automática');
select throws_ok(format($$select public.lancar_manual('77777777-0000-4000-a000-0000000000e1', %L, '2026-11-01', 'x', 0)$$, (select id from ids where nome = 'carteira')),
  '22023', 'valor_invalido', 'valor zero');
select throws_ok(format($$select public.lancar_manual('77777777-0000-4000-a000-0000000000e1', %L, '2026-11-01', '  ', 10)$$, (select id from ids where nome = 'carteira')),
  '22023', 'descricao_invalida', 'descrição vazia');
select throws_ok($$select public.lancar_manual('77777777-0000-4000-a000-0000000000e1', '77777777-0000-4000-a000-0000000000c1', '2026-11-01', 'x', 10)$$,
  '22023', 'conta_nao_manual', 'conta de banco não aceita lançamento manual');
select throws_ok(format($$select public.lancar_manual('77777777-0000-4000-a000-0000000000e1', %L, '2026-11-01', 'x', 10, %L)$$,
  (select id from ids where nome = 'carteira'),
  (select id from ids where nome = 'categoria_de_b')),
  '23503', null, 'categoria de outra empresa: recusada pela FK composta');

-- Remoção
select lives_ok(format($$select public.remover_lancamento_manual('77777777-0000-4000-a000-0000000000e1', %L)$$, (select id from ids where nome = 'gasto')), 'remove o manual');
select is((select saldo from public.contas where id = (select id from ids where nome = 'carteira')), 120.00, 'saldo devolvido (100 + 20)');
select is((select count(*) from public.transacoes where id = (select id from ids where nome = 'gasto')), 0::bigint, 'lançamento apagado');

-- Edição: o saldo recebe a diferença.
select lives_ok(format($$select public.editar_lancamento_manual('77777777-0000-4000-a000-0000000000e1', %L, '2026-11-03', ' Bolo de pote ', -10)$$, (select id from ids where nome = 'sem_categoria')), 'edita o manual');
select is((select saldo from public.contas where id = (select id from ids where nome = 'carteira')), 90.00, 'saldo ajustado (120 - 20 - 10)');
select is((select data || ' ' || descricao from public.transacoes where id = (select id from ids where nome = 'sem_categoria')), '2026-11-03 Bolo de pote', 'data e descrição trocadas');

-- Usuário B não enxerga nem mexe nas contas de A.
select set_config('request.jwt.claims', '{"sub":"77777777-0000-4000-a000-000000000002","role":"authenticated"}', true);
select throws_ok(format($$select public.lancar_manual('77777777-0000-4000-a000-0000000000e1', %L, '2026-11-01', 'x', 10)$$, (select id from ids where nome = 'carteira')),
  '42501', 'acesso_negado', 'B não lança na empresa A');
select throws_ok(format($$select public.lancar_manual('77777777-0000-4000-a000-0000000000e2', %L, '2026-11-01', 'x', 10)$$, (select id from ids where nome = 'carteira')),
  '22023', 'conta_nao_manual', 'B não lança na conta de A pela própria empresa');
select throws_ok(format($$select public.remover_lancamento_manual('77777777-0000-4000-a000-0000000000e2', %L)$$, (select id from ids where nome = 'sem_categoria')),
  '22023', 'lancamento_nao_manual', 'B não remove lançamento de A');
select throws_ok(format($$select public.editar_lancamento_manual('77777777-0000-4000-a000-0000000000e2', %L, '2026-11-01', 'x', 10)$$, (select id from ids where nome = 'sem_categoria')),
  '22023', 'lancamento_nao_manual', 'B não edita lançamento de A');

-- anon não executa.
reset role;
set local role anon;
select throws_ok($$select public.criar_conta_manual('77777777-0000-4000-a000-0000000000e1', 'X', 'dinheiro')$$, '42501', null, 'anon sem permissão');

select * from finish();
rollback;
