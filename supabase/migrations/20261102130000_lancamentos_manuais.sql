-- Fase 2 do roteiro (ADR 0017): contas e lançamentos manuais.
-- Convenção igual à da conexão 'arquivo' (ADR 0016): uma conexão 'manual' por empresa, com id_externo = empresa_id::text.
-- As RPCs são security definer (transacoes/contas não aceitam insert pela sessão) e conferem a membership.

alter table public.conexoes drop constraint conexoes_provedor_check;
alter table public.conexoes add constraint conexoes_provedor_check check (provedor in ('pluggy', 'arquivo', 'manual'));

-- 'dinheiro' = carteira (conta manual sem banco).
alter table public.contas drop constraint contas_tipo_check;
alter table public.contas add constraint contas_tipo_check check (tipo in ('corrente', 'poupanca', 'cartao_de_credito', 'dinheiro'));

-- Lança 42501 se o usuário logado não é membro da empresa.
create or replace function privado.exigir_membro(p_empresa uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_empresa is null
     or p_empresa not in (select privado.empresa_do_usuario()) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
end;
$$;

revoke all on function privado.exigir_membro(uuid) from public, anon, authenticated;

create or replace function public.criar_conta_manual(
  p_empresa uuid,
  p_nome text,
  p_tipo text,
  p_saldo_inicial numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conexao uuid;
  v_conta uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
begin
  perform privado.exigir_membro(p_empresa);
  if length(v_nome) not between 1 and 200 then
    raise exception 'nome_invalido' using errcode = '22023';
  end if;
  if p_tipo is null or p_tipo not in ('corrente', 'poupanca', 'cartao_de_credito', 'dinheiro') then
    raise exception 'tipo_invalido' using errcode = '22023';
  end if;
  if p_saldo_inicial is null or abs(p_saldo_inicial) >= 1e12 then
    raise exception 'valor_invalido' using errcode = '22023';
  end if;

  insert into public.conexoes (empresa_id, provedor, id_externo, status, criado_por)
  values (p_empresa, 'manual', p_empresa::text, 'atualizada', (select auth.uid()))
  on conflict (provedor, id_externo) do update set atualizado_em = now()
  returning id into v_conexao;

  insert into public.contas (empresa_id, conexao_id, id_externo, nome, tipo, saldo)
  values (p_empresa, v_conexao, 'manual:' || gen_random_uuid()::text, v_nome, p_tipo, round(p_saldo_inicial, 2))
  returning id into v_conta;

  return v_conta;
end;
$$;

-- Valor com sinal (negativo = saída). Sem categoria, a categorização automática assume depois.
create or replace function public.lancar_manual(
  p_empresa uuid,
  p_conta uuid,
  p_data date,
  p_descricao text,
  p_valor numeric,
  p_categoria uuid default null,
  p_centro uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conexao uuid;
  v_id uuid;
  v_descricao text := btrim(coalesce(p_descricao, ''));
begin
  perform privado.exigir_membro(p_empresa);

  select c.conexao_id into v_conexao
  from public.contas c
  join public.conexoes x on x.id = c.conexao_id
  where c.id = p_conta and c.empresa_id = p_empresa and x.provedor = 'manual';
  if v_conexao is null then
    raise exception 'conta_nao_manual' using errcode = '22023';
  end if;

  if length(v_descricao) not between 1 and 500 then
    raise exception 'descricao_invalida' using errcode = '22023';
  end if;
  if p_valor is null or round(p_valor, 2) = 0 or abs(p_valor) >= 1e12 then
    raise exception 'valor_invalido' using errcode = '22023';
  end if;
  if p_data is null then
    raise exception 'data_invalida' using errcode = '22023';
  end if;

  -- Categoria e centro de outra empresa: as FKs compostas (empresa_id, id) recusam (23503).
  insert into public.transacoes (
    empresa_id, conexao_id, conta_id, id_externo, data, descricao, descricao_original, valor,
    categoria_id, centro_de_custo_id, categoria_origem, categoria_definida_pelo_usuario
  )
  values (
    p_empresa, v_conexao, p_conta, 'manual:' || gen_random_uuid()::text, p_data, v_descricao, v_descricao,
    round(p_valor, 2), p_categoria, p_centro,
    case when p_categoria is not null then 'usuario' end, p_categoria is not null
  )
  returning id into v_id;

  update public.contas
  set saldo = saldo + round(p_valor, 2), saldo_atualizado_em = now()
  where id = p_conta;

  return v_id;
end;
$$;

-- Só lançamentos manuais. Com anexo, recusa: o arquivo no Storage ficaria órfão (remova o anexo antes).
create or replace function public.remover_lancamento_manual(p_empresa uuid, p_transacao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conta uuid;
  v_valor numeric;
begin
  perform privado.exigir_membro(p_empresa);

  select t.conta_id, t.valor into v_conta, v_valor
  from public.transacoes t
  join public.conexoes x on x.id = t.conexao_id
  where t.id = p_transacao and t.empresa_id = p_empresa and x.provedor = 'manual'
  for update of t;
  if v_conta is null then
    raise exception 'lancamento_nao_manual' using errcode = '22023';
  end if;
  if exists (select 1 from public.anexos a where a.transacao_id = p_transacao) then
    raise exception 'lancamento_com_anexos' using errcode = '22023';
  end if;

  delete from public.transacoes where id = p_transacao;

  update public.contas
  set saldo = saldo - v_valor, saldo_atualizado_em = now()
  where id = v_conta;
end;
$$;

revoke all on function public.criar_conta_manual(uuid, text, text, numeric) from public, anon;
revoke all on function public.lancar_manual(uuid, uuid, date, text, numeric, uuid, uuid) from public, anon;
revoke all on function public.remover_lancamento_manual(uuid, uuid) from public, anon;
grant execute on function public.criar_conta_manual(uuid, text, text, numeric) to authenticated, service_role;
grant execute on function public.lancar_manual(uuid, uuid, date, text, numeric, uuid, uuid) to authenticated, service_role;
grant execute on function public.remover_lancamento_manual(uuid, uuid) to authenticated, service_role;
