-- Importações de extrato e comprovantes (ADR 0016): isolamento entre empresas, chave de acesso única
-- por empresa, anexo de comprovante no caminho {empresa}/comprovantes/{id}/, conciliação e anon sem acesso.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------- Preparação (como postgres) ----------
insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-0000-4000-a000-000000000001', 'e@teste.local', 'authenticated', 'authenticated'),
  ('ffffffff-0000-4000-a000-000000000001', 'f@teste.local', 'authenticated', 'authenticated');
insert into public.empresas (id, nome) values
  ('eeeeeeee-0000-4000-a000-0000000000e0', 'Empresa E'),
  ('ffffffff-0000-4000-a000-0000000000e0', 'Empresa F');
insert into public.membros_empresa (empresa_id, user_id) values
  ('eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-000000000001'),
  ('ffffffff-0000-4000-a000-0000000000e0', 'ffffffff-0000-4000-a000-000000000001');

do $$
declare
  p text;
  e uuid;
begin
  foreach p in array array['eeeeeeee', 'ffffffff'] loop
    e := (p || '-0000-4000-a000-0000000000e0')::uuid;
    insert into public.conexoes (id, empresa_id, provedor, id_externo, status)
      values ((p || '-0000-4000-a000-0000000000c0')::uuid, e, 'arquivo', e::text, 'atualizada');
    insert into public.contas (id, empresa_id, conexao_id, id_externo, nome, tipo)
      values ((p || '-0000-4000-a000-0000000000c1')::uuid, e, (p || '-0000-4000-a000-0000000000c0')::uuid, 'conta-' || p, 'CC', 'corrente');
    insert into public.transacoes (id, empresa_id, conexao_id, conta_id, id_externo, data, descricao, valor)
      values ((p || '-0000-4000-a000-0000000000a1')::uuid, e, (p || '-0000-4000-a000-0000000000c0')::uuid,
              (p || '-0000-4000-a000-0000000000c1')::uuid, 'fitid-' || p, '2026-03-10', 'PIX ENVIADO POSTO', -150.25);
    insert into public.importacoes_de_extrato (id, empresa_id, conexao_id, conta_id, nome_do_arquivo, periodo_de, periodo_ate, novas)
      values ((p || '-0000-4000-a000-0000000000b0')::uuid, e, (p || '-0000-4000-a000-0000000000c0')::uuid,
              (p || '-0000-4000-a000-0000000000c1')::uuid, 'extrato.ofx', '2026-03-01', '2026-03-31', 1);
    insert into public.comprovantes (id, empresa_id, situacao, tipo, valor, data, chave_de_acesso)
      values ((p || '-0000-4000-a000-0000000000d0')::uuid, e, 'pendente', 'nfce', 150.25, '2026-03-11', repeat('1', 44));
    insert into public.anexos (empresa_id, comprovante_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes)
      values (e, (p || '-0000-4000-a000-0000000000d0')::uuid,
              e::text || '/comprovantes/' || p || '-0000-4000-a000-0000000000d0/foto.jpg', 'foto.jpg', 'image/jpeg', 100);
    insert into storage.objects (bucket_id, name)
      values ('anexos', e::text || '/comprovantes/' || p || '-0000-4000-a000-0000000000d0/foto.jpg');
  end loop;
end;
$$;

-- ---------- Restrições (como postgres) ----------
select throws_ok($$insert into public.comprovantes (empresa_id, situacao, valor, chave_de_acesso) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'pendente', 1, repeat('1', 44))$$,
  '23505', null, 'chave de acesso duplicada na mesma empresa é rejeitada');
select lives_ok($$insert into public.comprovantes (empresa_id, situacao, valor, chave_de_acesso) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'pendente', 1, null), ('eeeeeeee-0000-4000-a000-0000000000e0', 'pendente', 2, null)$$,
  'vários comprovantes sem chave na mesma empresa');
select throws_ok($$insert into public.comprovantes (empresa_id, chave_de_acesso) values ('eeeeeeee-0000-4000-a000-0000000000e0', '123')$$, '23514', null, 'chave de acesso precisa ter 44 dígitos');
select throws_ok($$insert into public.comprovantes (empresa_id, itens) values ('eeeeeeee-0000-4000-a000-0000000000e0', '{}')$$, '23514', null, 'itens precisa ser array');
select throws_ok($$insert into public.comprovantes (empresa_id, situacao) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'conciliado')$$, '23514', null, 'conciliado exige transação');
select throws_ok($$insert into public.anexos (empresa_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000e0/x/y.pdf', 'y.pdf', 'application/pdf', 1)$$,
  '23514', null, 'anexo sem transação nem comprovante é rejeitado');
select throws_ok($$insert into public.anexos (empresa_id, transacao_id, comprovante_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000a1', 'eeeeeeee-0000-4000-a000-0000000000d0', 'eeeeeeee-0000-4000-a000-0000000000e0/comprovantes/eeeeeeee-0000-4000-a000-0000000000d0/z.pdf', 'z.pdf', 'application/pdf', 1)$$,
  '23514', null, 'anexo não pertence a transação e comprovante ao mesmo tempo');
select throws_ok($$insert into public.anexos (empresa_id, comprovante_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000d0', 'eeeeeeee-0000-4000-a000-0000000000e0/eeeeeeee-0000-4000-a000-0000000000d0/z.pdf', 'z.pdf', 'application/pdf', 1)$$,
  '23514', null, 'anexo de comprovante fora de /comprovantes/ é rejeitado');
select lives_ok($$insert into public.conexoes (empresa_id, provedor, id_externo, status) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'arquivo', 'outro', 'atualizada')$$, 'provedor arquivo aceito');
select throws_ok($$insert into public.conexoes (empresa_id, provedor, id_externo, status) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'belvo', 'x', 'atualizada')$$, '23514', null, 'provedor desconhecido rejeitado');

-- ---------- Como usuário E ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-0000-4000-a000-000000000001","role":"authenticated"}', true);

select is((select array_agg(distinct empresa_id) from public.importacoes_de_extrato), array['eeeeeeee-0000-4000-a000-0000000000e0'::uuid], 'importacoes: só E');
select is((select array_agg(distinct empresa_id) from public.comprovantes), array['eeeeeeee-0000-4000-a000-0000000000e0'::uuid], 'comprovantes: só E');
select is((select count(*) from storage.objects where name like '%/comprovantes/%'), 1::bigint, 'storage: E só vê o próprio comprovante');

-- Chave de acesso: a mesma chave de F é aceita em E (já existe em F), mas não repetida em E.
select lives_ok($$insert into public.comprovantes (empresa_id, valor, chave_de_acesso) values ('eeeeeeee-0000-4000-a000-0000000000e0', 5, repeat('2', 44))$$, 'E grava comprovante com chave');
reset role;
select lives_ok($$insert into public.comprovantes (empresa_id, valor, chave_de_acesso) values ('ffffffff-0000-4000-a000-0000000000e0', 5, repeat('2', 44))$$, 'mesma chave aceita em outra empresa');
set local role authenticated;
select throws_ok($$insert into public.comprovantes (empresa_id, valor, chave_de_acesso) values ('eeeeeeee-0000-4000-a000-0000000000e0', 6, repeat('2', 44))$$, '23505', null, 'E não repete a chave');

-- Escritas em F: barradas.
select throws_ok($$insert into public.comprovantes (empresa_id, valor) values ('ffffffff-0000-4000-a000-0000000000e0', 1)$$, '42501', null, 'E não insere comprovante em F');
select throws_ok($$insert into public.importacoes_de_extrato (empresa_id, conexao_id, conta_id, nome_do_arquivo, periodo_de, periodo_ate) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'eeeeeeee-0000-4000-a000-0000000000c0', 'eeeeeeee-0000-4000-a000-0000000000c1', 'x.ofx', '2026-01-01', '2026-01-31')$$,
  '42501', null, 'importação é exclusiva do service role');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('anexos', 'ffffffff-0000-4000-a000-0000000000e0/comprovantes/ffffffff-0000-4000-a000-0000000000d0/x.jpg')$$,
  '42501', null, 'E não envia arquivo para comprovantes de F');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('anexos', 'eeeeeeee-0000-4000-a000-0000000000e0/comprovantes/eeeeeeee-0000-4000-a000-0000000000d0/verso.jpg')$$,
  'E envia arquivo para os próprios comprovantes');
select throws_ok($$update public.comprovantes set transacao_id = 'ffffffff-0000-4000-a000-0000000000a1', situacao = 'conciliado' where id = 'eeeeeeee-0000-4000-a000-0000000000d0'$$,
  '23503', null, 'E não concilia com transação de F');
select throws_ok($$insert into public.anexos (empresa_id, comprovante_id, caminho, nome_arquivo, tipo_mime, tamanho_bytes) values ('eeeeeeee-0000-4000-a000-0000000000e0', 'ffffffff-0000-4000-a000-0000000000d0', 'eeeeeeee-0000-4000-a000-0000000000e0/comprovantes/ffffffff-0000-4000-a000-0000000000d0/x.jpg', 'x.jpg', 'image/jpeg', 1)$$,
  '23503', null, 'E não anexa arquivo ao comprovante de F');
update public.comprovantes set situacao = 'ambiguo' where empresa_id = 'ffffffff-0000-4000-a000-0000000000e0';
delete from public.comprovantes where empresa_id = 'ffffffff-0000-4000-a000-0000000000e0';
delete from public.anexos where empresa_id = 'ffffffff-0000-4000-a000-0000000000e0';

-- Conciliação: candidatos só da própria empresa, por valor absoluto e ±3 dias.
select is((select array_agg(id) from public.candidatos_para_conciliacao('eeeeeeee-0000-4000-a000-0000000000e0', 15025, '2026-03-12', 3)),
  array['eeeeeeee-0000-4000-a000-0000000000a1'::uuid], 'candidato com mesmo valor absoluto e data em ±3 dias');
select is((select valor_centavos from public.candidatos_para_conciliacao('eeeeeeee-0000-4000-a000-0000000000e0', 15025, '2026-03-12', 3)), -15025::bigint, 'valor_centavos com sinal da transação');
select is((select count(*) from public.candidatos_para_conciliacao('eeeeeeee-0000-4000-a000-0000000000e0', 15025, '2026-03-14', 3)), 0::bigint, 'fora da tolerância não é candidato');
select is((select count(*) from public.candidatos_para_conciliacao('ffffffff-0000-4000-a000-0000000000e0', 15025, '2026-03-10', 3)), 0::bigint, 'E não vê candidatos de F');

select lives_ok($$update public.comprovantes set transacao_id = 'eeeeeeee-0000-4000-a000-0000000000a1', situacao = 'conciliado' where id = 'eeeeeeee-0000-4000-a000-0000000000d0'$$, 'E concilia o próprio comprovante');

-- ---------- Como anon ----------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select * from public.importacoes_de_extrato', '42501', null, 'anon não lê importacoes_de_extrato');
select throws_ok('select * from public.comprovantes', '42501', null, 'anon não lê comprovantes');
select throws_ok($$select * from public.candidatos_para_conciliacao('eeeeeeee-0000-4000-a000-0000000000e0', 1, '2026-03-10', 3)$$, '42501', null, 'anon não executa candidatos_para_conciliacao');
select is((select count(*) from storage.objects where name like '%/comprovantes/%'), 0::bigint, 'anon não vê comprovantes no storage');

-- ---------- Verificação (como postgres) ----------
reset role;
select is((select situacao from public.comprovantes where id = 'ffffffff-0000-4000-a000-0000000000d0'), 'pendente', 'comprovante de F intacto');
select is((select count(*) from public.anexos where empresa_id = 'ffffffff-0000-4000-a000-0000000000e0'), 1::bigint, 'anexo de F intacto');
select is((select situacao from public.comprovantes where id = 'eeeeeeee-0000-4000-a000-0000000000d0'), 'conciliado', 'conciliação de E gravada');

-- Transação some (ex.: conta removida): o comprovante volta a pendente em vez de quebrar.
delete from public.transacoes where id = 'eeeeeeee-0000-4000-a000-0000000000a1';
select is((select situacao || ':' || coalesce(transacao_id::text, '-') from public.comprovantes where id = 'eeeeeeee-0000-4000-a000-0000000000d0'),
  'pendente:-', 'transação removida devolve o comprovante para pendente');

-- Remover o comprovante remove o anexo.
delete from public.comprovantes where id = 'eeeeeeee-0000-4000-a000-0000000000d0';
select is((select count(*) from public.anexos where comprovante_id = 'eeeeeeee-0000-4000-a000-0000000000d0'), 0::bigint, 'anexo removido com o comprovante');

select * from finish();
rollback;
