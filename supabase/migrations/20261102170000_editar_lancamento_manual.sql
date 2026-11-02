-- Pendência da v2 (ADR 0017): editar data, descrição e valor de um lançamento manual.
-- O saldo da conta manual recebe a diferença (novo − antigo) na mesma transação.
create or replace function public.editar_lancamento_manual(
  p_empresa uuid,
  p_transacao uuid,
  p_data date,
  p_descricao text,
  p_valor numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conta uuid;
  v_antigo numeric;
  v_descricao text := btrim(coalesce(p_descricao, ''));
begin
  perform privado.exigir_membro(p_empresa);

  select t.conta_id, t.valor into v_conta, v_antigo
  from public.transacoes t
  join public.conexoes x on x.id = t.conexao_id
  where t.id = p_transacao and t.empresa_id = p_empresa and x.provedor = 'manual'
  for update of t;
  if v_conta is null then
    raise exception 'lancamento_nao_manual' using errcode = '22023';
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

  update public.transacoes
  set data = p_data, descricao = v_descricao, descricao_original = v_descricao, valor = round(p_valor, 2)
  where id = p_transacao;

  update public.contas
  set saldo = saldo + round(p_valor, 2) - v_antigo, saldo_atualizado_em = now()
  where id = v_conta;
end;
$$;

revoke all on function public.editar_lancamento_manual(uuid, uuid, date, text, numeric) from public, anon;
grant execute on function public.editar_lancamento_manual(uuid, uuid, date, text, numeric) to authenticated, service_role;
