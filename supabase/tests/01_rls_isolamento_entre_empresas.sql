-- RLS: um usuário da empresa A não vê, não insere, não altera e não remove nada da empresa B.
-- Anon não vê nada. Infraestrutura só para service_role.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------- Preparação (como postgres) ----------
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-a000-000000000001', 'a@teste.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-a000-000000000001', 'b@teste.local', 'authenticated', 'authenticated');

insert into public.empresas (id, nome) values
  ('aaaaaaaa-0000-4000-a000-0000000000e0', 'Empresa A'),
  ('bbbbbbbb-0000-4000-a000-0000000000e0', 'Empresa B');
insert into public.membros_empresa (empresa_id, user_id) values
  ('aaaaaaaa-0000-4000-a000-0000000000e0', 'aaaaaaaa-0000-4000-a000-000000000001'),
  ('bbbbbbbb-0000-4000-a000-0000000000e0', 'bbbbbbbb-0000-4000-a000-000000000001');
select privado.semear_empresa('aaaaaaaa-0000-4000-a000-0000000000e0');
select privado.semear_empresa('bbbbbbbb-0000-4000-a000-0000000000e0');

-- Mesma estrutura nas duas empresas, com ids previsíveis (prefixo aaaaaaaa / bbbbbbbb).
do $$
declare
  p text;
  e uuid;
begin
  foreach p in array array['aaaaaaaa', 'bbbbbbbb'] loop
    e := (p || '-0000-4000-a000-0000000000e0')::uuid;
    insert into public.conexoes (id, empresa_id, id_externo, status)
      values ((p || '-0000-4000-a000-0000000000c0')::uuid, e, 'item-' || p, 'atualizada');
    insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo)
      values ((p || '-0000-4000-a000-0000000000c1')::uuid, e, (p || '-0000-4000-a000-0000000000c0')::uuid, 'conta-' || p, 'CC', 'corrente');
    insert into public.categorias (id, empresa_id, nome, tipo)
      values ((p || '-0000-4000-a000-0000000000ca')::uuid, e, 'Teste ' || p, 'saida');
    insert into public.centros_de_custo (id, empresa_id, nome)
      values ((p || '-0000-4000-a000-0000000000cc')::uuid, e, 'Centro ' || p);
    insert into public.regras_categorizacao (id, empresa_id, padrao, categoria_id, origem)
      values ((p || '-0000-4000-a000-0000000000ae')::uuid, e, 'TESTE ' || upper(p), (p || '-0000-4000-a000-0000000000ca')::uuid, 'usuario');
    insert into public.transacoes (id, empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor)
      values ((p || '-0000-4000-a000-0000000000a1')::uuid, e, (p || '-0000-4000-a000-0000000000c0')::uuid,
              (p || '-0000-4000-a000-0000000000c1')::uuid, 'tx-' || p, '2026-01-10', 'PIX ENVIADO POSTO', -100);
    insert into public.anexos (id, empresa_id, transacao_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes)
      values ((p || '-0000-4000-a000-0000000000a2')::uuid, e, (p || '-0000-4000-a000-0000000000a1')::uuid,
              e::text || '/' || p || '-0000-4000-a000-0000000000a1/arquivo.pdf', 'nota.pdf', 'application/pdf', 100);
    insert into storage.objects (bucket_id, name)
      values ('anexos', e::text || '/' || p || '-0000-4000-a000-0000000000a1/arquivo.pdf');
  end loop;
end;
$$;
insert into public.eventos_webhook (event_id, evento) values ('evt-1', 'item/updated');
insert into public.limites_de_requisicao (chave, janela, contador) values ('k', now(), 1);

-- ---------- Como usuário A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-a000-000000000001","role":"authenticated"}', true);

-- Leitura: só a própria empresa.
select is((select array_agg(distinct id) from public.empresas), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'A só vê a empresa A');
select is((select array_agg(distinct user_id) from public.membros_empresa), array['aaaaaaaa-0000-4000-a000-000000000001'::uuid], 'A só vê a própria membership');
select is((select array_agg(distinct empresa_id) from public.conexoes), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'conexoes: só A');
select is((select array_agg(distinct empresa_id) from public.contas), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'contas: só A');
select is((select array_agg(distinct empresa_id) from public.categorias), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'categorias: só A');
select is((select array_agg(distinct empresa_id) from public.centros_de_custo), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'centros_de_custo: só A');
select is((select array_agg(distinct empresa_id) from public.regras_categorizacao), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'regras: só A');
select is((select array_agg(distinct empresa_id) from public.transacoes), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'transacoes: só A');
select is((select array_agg(distinct empresa_id) from public.anexos), array['aaaaaaaa-0000-4000-a000-0000000000e0'::uuid], 'anexos: só A');
select is((select count(*) from storage.objects where bucket_id = 'anexos'), 1::bigint, 'storage: A só vê o próprio objeto');
select is((select count(*) from storage.objects where name like 'bbbbbbbb%'), 0::bigint, 'storage: A não vê objeto de B');

-- Inserção na empresa B: barrada pela RLS.
select throws_ok($$insert into public.categorias (empresa_id, nome, tipo) values ('bbbbbbbb-0000-4000-a000-0000000000e0', 'X', 'saida')$$, '42501', null, 'A não insere categoria em B');
select throws_ok($$insert into public.centros_de_custo (empresa_id, nome) values ('bbbbbbbb-0000-4000-a000-0000000000e0', 'X')$$, '42501', null, 'A não insere centro em B');
select throws_ok($$insert into public.regras_categorizacao (empresa_id, padrao, categoria_id, origem) values ('bbbbbbbb-0000-4000-a000-0000000000e0', 'XX', 'bbbbbbbb-0000-4000-a000-0000000000ca', 'usuario')$$, '42501', null, 'A não insere regra em B');
select throws_ok($$insert into public.anexos (empresa_id, transacao_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes) values ('bbbbbbbb-0000-4000-a000-0000000000e0', 'bbbbbbbb-0000-4000-a000-0000000000a1', 'bbbbbbbb-0000-4000-a000-0000000000e0/bbbbbbbb-0000-4000-a000-0000000000a1/y.pdf', 'y.pdf', 'application/pdf', 1)$$, '42501', null, 'A não insere anexo em B');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('anexos', 'bbbbbbbb-0000-4000-a000-0000000000e0/x/y.pdf')$$, '42501', null, 'A não envia arquivo para a pasta de B');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('anexos', 'aaaaaaaa-0000-4000-a000-0000000000e0/x/y.pdf')$$, 'A envia arquivo para a própria pasta');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('anexos', 'nao-e-uuid/y.pdf')$$, '42501', null, 'pasta inválida é barrada sem erro de cast');

-- Sincronização é exclusiva do service role: nem na própria empresa.
select throws_ok($$insert into public.transacoes (empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor) values ('aaaaaaaa-0000-4000-a000-0000000000e0', 'aaaaaaaa-0000-4000-a000-0000000000c0', 'aaaaaaaa-0000-4000-a000-0000000000c1', 'novo', '2026-01-01', 'X', 1)$$, '42501', null, 'authenticated não insere transação');
select throws_ok($$insert into public.contas (empresa_id, conexao_id, id_externo, nome) values ('aaaaaaaa-0000-4000-a000-0000000000e0', 'aaaaaaaa-0000-4000-a000-0000000000c0', 'nova', 'X')$$, '42501', null, 'authenticated não insere conta');
select throws_ok($$insert into public.conexoes (empresa_id, id_externo, status) values ('aaaaaaaa-0000-4000-a000-0000000000e0', 'novo', 'atualizada')$$, '42501', null, 'authenticated não insere conexão');
select throws_ok($$delete from public.transacoes where id = 'aaaaaaaa-0000-4000-a000-0000000000a1'$$, '42501', null, 'authenticated não remove transação');
select throws_ok($$insert into public.empresas (nome) values ('Nova')$$, '42501', null, 'authenticated não cria empresa diretamente');
select throws_ok($$insert into public.membros_empresa (empresa_id, user_id) values ('bbbbbbbb-0000-4000-a000-0000000000e0', 'aaaaaaaa-0000-4000-a000-000000000001')$$, '42501', null, 'A não se adiciona à empresa B');

-- Usuário só altera a categorização da transação, não os dados bancários.
select throws_ok($$update public.transacoes set valor = 1 where id = 'aaaaaaaa-0000-4000-a000-0000000000a1'$$, '42501', null, 'A não altera o valor da transação');
select lives_ok($$update public.transacoes set categoria_id = 'aaaaaaaa-0000-4000-a000-0000000000ca', categoria_origem = 'usuario', categoria_definida_pelo_usuario = true where id = 'aaaaaaaa-0000-4000-a000-0000000000a1'$$, 'A categoriza a própria transação');

-- FKs compostas: não dá para apontar para linhas de B.
select throws_ok($$update public.transacoes set categoria_id = 'bbbbbbbb-0000-4000-a000-0000000000ca' where id = 'aaaaaaaa-0000-4000-a000-0000000000a1'$$, '23503', null, 'A não usa categoria de B na própria transação');
select throws_ok($$update public.transacoes set centro_de_custo_id = 'bbbbbbbb-0000-4000-a000-0000000000cc' where id = 'aaaaaaaa-0000-4000-a000-0000000000a1'$$, '23503', null, 'A não usa centro de custo de B');
select throws_ok($$insert into public.regras_categorizacao (empresa_id, padrao, categoria_id, origem) values ('aaaaaaaa-0000-4000-a000-0000000000e0', 'YY', 'bbbbbbbb-0000-4000-a000-0000000000ca', 'usuario')$$, '23503', null, 'A não cria regra apontando para categoria de B');
select throws_ok($$insert into public.anexos (empresa_id, transacao_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes) values ('aaaaaaaa-0000-4000-a000-0000000000e0', 'bbbbbbbb-0000-4000-a000-0000000000a1', 'aaaaaaaa-0000-4000-a000-0000000000e0/bbbbbbbb-0000-4000-a000-0000000000a1/z.pdf', 'z.pdf', 'application/pdf', 1)$$, '23503', null, 'A não anexa arquivo à transação de B');

-- Alterações e remoções em B: silenciosamente 0 linhas (verificado abaixo como postgres).
update public.empresas set nome = 'hackeada' where id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
update public.conexoes set status = 'erro' where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
update public.contas set nome = 'hackeada' where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
update public.categorias set nome = 'hackeada' where id = 'bbbbbbbb-0000-4000-a000-0000000000ca';
update public.centros_de_custo set nome = 'hackeado' where id = 'bbbbbbbb-0000-4000-a000-0000000000cc';
update public.regras_categorizacao set prioridade = 1 where id = 'bbbbbbbb-0000-4000-a000-0000000000ae';
update public.transacoes set categoria_id = null where id = 'bbbbbbbb-0000-4000-a000-0000000000a1';
update public.anexos set nome_arquivo = 'hackeado' where id = 'bbbbbbbb-0000-4000-a000-0000000000a2';
delete from public.categorias where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
delete from public.centros_de_custo where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
delete from public.regras_categorizacao where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
delete from public.anexos where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
delete from storage.objects where name like 'bbbbbbbb%';
-- Mover uma linha própria para B também é barrado (with check).
select throws_ok($$update public.categorias set empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0' where id = 'aaaaaaaa-0000-4000-a000-0000000000ca'$$, '42501', null, 'A não move categoria para B');

-- Painel de B pela sessão de A: vazio.
select is((select count(*) from public.painel_por_categoria('bbbbbbbb-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')), 0::bigint, 'painel de B vazio para A');
select is((select sum(saidas_centavos) from public.painel_fluxo_mensal('bbbbbbbb-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')), 0::numeric, 'fluxo de B zerado para A');

-- Infraestrutura: só service_role.
select throws_ok($$select * from public.eventos_webhook$$, '42501', null, 'authenticated não lê eventos_webhook');
select throws_ok($$select * from public.limites_de_requisicao$$, '42501', null, 'authenticated não lê limites_de_requisicao');
select throws_ok($$select public.consumir_limite_de_requisicao('x', 1, 60)$$, '42501', null, 'authenticated não executa consumir_limite_de_requisicao');

-- ---------- Como anon ----------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(format('select * from public.%I', t), '42501', null, 'anon não lê ' || t)
from unnest(array['empresas', 'membros_empresa', 'conexoes', 'contas', 'categorias', 'centros_de_custo',
                  'regras_categorizacao', 'transacoes', 'anexos', 'eventos_webhook', 'limites_de_requisicao']) as t;
select is((select count(*) from storage.objects where bucket_id = 'anexos'), 0::bigint, 'anon não vê arquivos');
select throws_ok($$select public.garantir_empresa('x')$$, '42501', null, 'anon não executa garantir_empresa');
select throws_ok($$select * from public.painel_fluxo_mensal('aaaaaaaa-0000-4000-a000-0000000000e0', '2026-01-01', '2026-01-31')$$, '42501', null, 'anon não executa painel');
select throws_ok($$select privado.empresa_do_usuario()$$, '42501', null, 'anon não acessa o schema privado');

-- ---------- Verificação (como postgres): B intacta ----------
reset role;
select is((select nome from public.empresas where id = 'bbbbbbbb-0000-4000-a000-0000000000e0'), 'Empresa B', 'nome de B intacto');
select is((select status from public.conexoes where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0'), 'atualizada', 'conexão de B intacta');
select is((select nome from public.contas where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0'), 'CC', 'conta de B intacta');
select is((select nome from public.categorias where id = 'bbbbbbbb-0000-4000-a000-0000000000ca'), 'Teste bbbbbbbb', 'categoria de B intacta');
select is((select count(*) from public.categorias where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0'), 19::bigint, 'nenhuma categoria de B removida');
select is((select count(*) from public.centros_de_custo where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0'), 5::bigint, 'nenhum centro de B removido');
select is((select count(*) from public.regras_categorizacao where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0'), 12::bigint, 'nenhuma regra de B removida');
select is((select prioridade from public.regras_categorizacao where id = 'bbbbbbbb-0000-4000-a000-0000000000ae'), 100, 'regra de B intacta');
select is((select nome_arquivo from public.anexos where id = 'bbbbbbbb-0000-4000-a000-0000000000a2'), 'nota.pdf', 'anexo de B intacto');
select is((select count(*) from storage.objects where name like 'bbbbbbbb%'), 1::bigint, 'arquivo de B intacto');
select is((select categoria_definida_pelo_usuario from public.transacoes where id = 'aaaaaaaa-0000-4000-a000-0000000000a1'), true, 'update próprio de A gravou');

-- Apagar a empresa leva tudo junto (cascata com FKs compostas).
delete from public.empresas where id = 'bbbbbbbb-0000-4000-a000-0000000000e0';
select is((select count(*) from public.transacoes where empresa_id = 'bbbbbbbb-0000-4000-a000-0000000000e0'), 0::bigint, 'cascata ao apagar empresa');

select * from finish();
rollback;
