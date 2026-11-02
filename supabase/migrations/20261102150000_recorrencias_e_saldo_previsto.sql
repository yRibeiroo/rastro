-- Fase 4 do roteiro (ADR 0017): recorrências (contas a pagar e a receber) e saldo previsto.
-- As ocorrências não são gravadas: saem da regra (início + n × passo). Só a baixa ("paguei"/"pulei") é gravada.

create table public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  conta_id uuid not null,
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  valor numeric(14, 2) not null check (valor <> 0), -- negativo = a pagar
  categoria_id uuid,
  frequencia text not null check (frequencia in ('semanal', 'mensal', 'anual')),
  inicio date not null,
  fim date check (fim is null or fim >= inicio),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  foreign key (empresa_id, conta_id) references public.contas (empresa_id, id) on delete cascade,
  foreign key (empresa_id, categoria_id) references public.categorias (empresa_id, id)
    on delete set null (categoria_id),
  unique (empresa_id, id) -- também cobre o índice (empresa_id)
);

create index recorrencias_empresa_conta_idx on public.recorrencias (empresa_id, conta_id);
create index recorrencias_empresa_categoria_idx on public.recorrencias (empresa_id, categoria_id);

-- Ocorrência resolvida: paga/recebida (com o lançamento, se a conta é manual) ou pulada.
create table public.baixas_de_recorrencia (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  recorrencia_id uuid not null,
  data date not null,
  transacao_id uuid,
  criado_em timestamptz not null default now(),
  primary key (recorrencia_id, data),
  foreign key (empresa_id, recorrencia_id) references public.recorrencias (empresa_id, id) on delete cascade,
  foreign key (empresa_id, transacao_id) references public.transacoes (empresa_id, id)
    on delete set null (transacao_id)
);

create index baixas_empresa_recorrencia_idx on public.baixas_de_recorrencia (empresa_id, recorrencia_id);
create index baixas_empresa_transacao_idx on public.baixas_de_recorrencia (empresa_id, transacao_id);

alter table public.recorrencias enable row level security;
alter table public.recorrencias force row level security;
alter table public.baixas_de_recorrencia enable row level security;
alter table public.baixas_de_recorrencia force row level security;

-- Recorrências são dados do usuário (como categorias): CRUD pela sessão, sempre na própria empresa.
create policy "membros leem" on public.recorrencias for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros inserem" on public.recorrencias for insert to authenticated
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros atualizam" on public.recorrencias for update to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()))
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros removem" on public.recorrencias for delete to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));

-- Baixas: leitura pela sessão; escrita só pela RPC (que também pode lançar na conta manual).
create policy "membros leem" on public.baixas_de_recorrencia for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));

revoke all on public.recorrencias, public.baixas_de_recorrencia from public, anon, authenticated;
grant select, insert, delete on public.recorrencias to authenticated;
grant update (descricao, valor, categoria_id, fim, ativa) on public.recorrencias to authenticated;
grant select on public.baixas_de_recorrencia to authenticated;
grant all on public.recorrencias, public.baixas_de_recorrencia to service_role;

-- n-ésima ocorrência = início + n × passo (calculado do início: o dia 31 não escorrega para 28).
create or replace function privado.passo_da_recorrencia(p_frequencia text, p_n integer)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_frequencia
    when 'semanal' then make_interval(days => 7 * p_n)
    when 'mensal' then make_interval(months => p_n)
    else make_interval(years => p_n)
  end
$$;

revoke all on function privado.passo_da_recorrencia(text, integer) from public, anon;
grant execute on function privado.passo_da_recorrencia(text, integer) to authenticated, service_role;

-- Ocorrências ainda não baixadas entre p_de e p_ate (o app passa p_de = hoje − 60 para trazer as atrasadas).
-- security invoker: a RLS se aplica.
create or replace function public.ocorrencias_previstas(p_empresa uuid, p_de date, p_ate date)
returns table (
  recorrencia_id uuid,
  data date,
  descricao text,
  valor_centavos bigint,
  conta_id uuid,
  tipo_da_conta text,
  conta_manual boolean,
  categoria_id uuid
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate > p_de + 800 then
    raise exception 'periodo_invalido' using errcode = '22023';
  end if;
  return query
  select r.id, o.data, r.descricao, round(r.valor * 100)::bigint, r.conta_id, c.tipo, x.provedor = 'manual', r.categoria_id
  from public.recorrencias r
  join public.contas c on c.id = r.conta_id
  join public.conexoes x on x.id = c.conexao_id
  cross join lateral (
    select (r.inicio + privado.passo_da_recorrencia(r.frequencia, n))::date as data
    from generate_series(
      0,
      (least(p_ate, coalesce(r.fim, p_ate)) - r.inicio)
        / case r.frequencia when 'semanal' then 7 when 'mensal' then 28 else 365 end + 1
    ) as n
  ) o
  where r.empresa_id = p_empresa
    and r.ativa
    and o.data between greatest(p_de, r.inicio) and least(p_ate, coalesce(r.fim, p_ate))
    and not exists (
      select 1 from public.baixas_de_recorrencia b where b.recorrencia_id = r.id and b.data = o.data
    )
  order by o.data, r.descricao;
end;
$$;

revoke all on function public.ocorrencias_previstas(uuid, date, date) from public, anon;
grant execute on function public.ocorrencias_previstas(uuid, date, date) to authenticated, service_role;

-- Baixa de uma ocorrência. Conta manual + p_lancar: gera o lançamento (e ajusta o saldo) na mesma transação.
-- Conta de banco: só marca (a transação real chega pelo extrato). Devolve o id do lançamento ou null.
create or replace function public.baixar_ocorrencia(
  p_empresa uuid,
  p_recorrencia uuid,
  p_data date,
  p_lancar boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recorrencias%rowtype;
  v_manual boolean;
  v_transacao uuid;
begin
  perform privado.exigir_membro(p_empresa);

  select * into r from public.recorrencias where id = p_recorrencia and empresa_id = p_empresa and ativa;
  if r.id is null then
    raise exception 'recorrencia_nao_encontrada' using errcode = '22023';
  end if;
  -- A data precisa ser uma ocorrência da regra.
  if p_data is null or p_data < r.inicio or (r.fim is not null and p_data > r.fim) or not exists (
    select 1 from generate_series(0, (p_data - r.inicio) / case r.frequencia when 'semanal' then 7 when 'mensal' then 28 else 365 end + 1) n
    where (r.inicio + privado.passo_da_recorrencia(r.frequencia, n))::date = p_data
  ) then
    raise exception 'data_invalida' using errcode = '22023';
  end if;
  if exists (select 1 from public.baixas_de_recorrencia b where b.recorrencia_id = r.id and b.data = p_data) then
    raise exception 'ocorrencia_ja_baixada' using errcode = '22023';
  end if;

  select x.provedor = 'manual' into v_manual
  from public.contas c join public.conexoes x on x.id = c.conexao_id
  where c.id = r.conta_id;

  if v_manual and coalesce(p_lancar, true) then
    v_transacao := public.lancar_manual(p_empresa, r.conta_id, p_data, r.descricao, r.valor, r.categoria_id, null);
  end if;

  insert into public.baixas_de_recorrencia (empresa_id, recorrencia_id, data, transacao_id)
  values (p_empresa, r.id, p_data, v_transacao);

  return v_transacao;
end;
$$;

revoke all on function public.baixar_ocorrencia(uuid, uuid, date, boolean) from public, anon;
grant execute on function public.baixar_ocorrencia(uuid, uuid, date, boolean) to authenticated, service_role;
