-- A categoria definida pelo usuário nunca é sobrescrita (upsert, aplicação automática, gatilho).
-- Também: atualizado_em e rate limit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into public.empresas (id, nome) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'Upsert');
select privado.semear_empresa('eeeeeeee-0000-4000-a000-0000000000e0');
insert into public.conexoes (id, empresa_id, id_externo, status)
values ('eeeeeeee-0000-4000-a000-0000000000c0', 'eeeeeeee-0000-4000-a000-0000000000e0', 'item-e', 'atualizada');
insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo)
values ('eeeeeeee-0000-4000-a000-0000000000c1', 'eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000c0', 'c', 'CC', 'corrente');

-- t1: categoria do usuário (Alimentação). t2: categorizada por regra.
insert into public.transacoes (id, empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor,
                               categoria_id, categoria_origem, categoria_definida_pelo_usuario, atualizado_em)
select v.id::uuid, 'eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000c0', 'eeeeeeee-0000-4000-a000-0000000000c1',
       v.ide, '2026-02-01', 'PIX ENVIADO POSTO SAO JOAO', -50,
       (select id from public.categorias where empresa_id = 'eeeeeeee-0000-4000-a000-0000000000e0' and nome = v.cat),
       v.origem, v.usuario, now() - interval '1 day'
from (values
  ('eeeeeeee-0000-4000-a000-0000000000a1', 't1', 'Alimentação', 'usuario', true),
  ('eeeeeeee-0000-4000-a000-0000000000a2', 't2', 'Combustível', 'regra', false)
) as v (id, ide, cat, origem, usuario);

create temp table categoria_usuario on commit drop as
select id from public.categorias where empresa_id = 'eeeeeeee-0000-4000-a000-0000000000e0' and nome = 'Alimentação';
grant select on categoria_usuario to service_role;

-- Upsert da sincronização (como service_role), atualizando só as colunas permitidas.
set local role service_role;
insert into public.transacoes (empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor)
values ('eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000c0', 'eeeeeeee-0000-4000-a000-0000000000c1',
        't1', '2026-02-02', 'PIX ENVIADO POSTO SAO JOAO LTDA', -55)
on conflict (empresa_id, id_externo) do update
set data = excluded.data, descricao = excluded.descricao, descricao_original = excluded.descricao_original,
    valor = excluded.valor, pendente = excluded.pendente, contraparte = excluded.contraparte,
    metodo_de_pagamento = excluded.metodo_de_pagamento, categoria_do_provedor = excluded.categoria_do_provedor,
    conta_id = excluded.conta_id;

select is((select descricao from public.transacoes where id_externo = 't1'), 'PIX ENVIADO POSTO SAO JOAO LTDA', 'upsert atualiza dados bancários');
select is((select categoria_id from public.transacoes where id_externo = 't1'), (select id from categoria_usuario), 'upsert não toca a categoria do usuário');
select ok((select atualizado_em > now() - interval '1 minute' from public.transacoes where id_externo = 't1'), 'atualizado_em renovado pelo gatilho');

-- Upsert "errado" que tenta zerar a categorização: o gatilho restaura.
insert into public.transacoes (empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor)
values ('eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000c0', 'eeeeeeee-0000-4000-a000-0000000000c1',
        't1', '2026-02-02', 'X', -55)
on conflict (empresa_id, id_externo) do update
set categoria_id = null, categoria_origem = null, categoria_definida_pelo_usuario = false;
select is((select categoria_id from public.transacoes where id_externo = 't1'), (select id from categoria_usuario), 'gatilho restaura a categoria do usuário');
select is((select categoria_definida_pelo_usuario from public.transacoes where id_externo = 't1'), true, 'gatilho mantém a proteção');

-- Escrita automática que mantém o flag mas muda a origem: o check barra.
select throws_ok($$update public.transacoes set categoria_origem = 'regra' where id_externo = 't1'$$, '23514', null, 'origem automática com flag do usuário é barrada');

-- Aplicação automática (RPC) ignora a transação do usuário.
select is(
  public.aplicar_categorizacao_automatica('eeeeeeee-0000-4000-a000-0000000000e0', jsonb_build_array(
    jsonb_build_object('transacao_id', 'eeeeeeee-0000-4000-a000-0000000000a1', 'categoria_id',
      (select id from public.categorias where empresa_id = 'eeeeeeee-0000-4000-a000-0000000000e0' and nome = 'Outros'), 'origem', 'ia', 'confianca', 0.9),
    jsonb_build_object('transacao_id', 'eeeeeeee-0000-4000-a000-0000000000a2', 'categoria_id',
      (select id from public.categorias where empresa_id = 'eeeeeeee-0000-4000-a000-0000000000e0' and nome = 'Outros'), 'origem', 'ia', 'confianca', 0.9)
  )),
  1, 'aplicação automática altera só a não definida pelo usuário'
);
select is((select categoria_id from public.transacoes where id_externo = 't1'), (select id from categoria_usuario), 't1 continua com a categoria do usuário');
select is((select categoria_origem from public.transacoes where id_externo = 't2'), 'ia', 't2 recategorizada pela IA');
select is((select confianca_ia from public.transacoes where id_externo = 't2'), 0.90::numeric(3, 2), 'confiança gravada');
select isnt((select categorizacao_automatica_em from public.transacoes where id_externo = 't2'), null, 'categorizacao_automatica_em marcada');

-- Rate limit (service_role): janela fixa, máximo 2.
select is(public.consumir_limite_de_requisicao('teste:ip:abc', 2, 60), true, '1ª dentro');
select is(public.consumir_limite_de_requisicao('teste:ip:abc', 2, 60), true, '2ª dentro');
select is(public.consumir_limite_de_requisicao('teste:ip:abc', 2, 60), false, '3ª fora');

select * from finish();
rollback;
