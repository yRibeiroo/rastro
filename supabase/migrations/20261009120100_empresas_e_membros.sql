-- Empresas, membros e a função de RLS privado.empresa_do_usuario().

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(nome) between 1 and 120),
  criado_em timestamptz not null default now()
);

create table public.membros_empresa (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null default 'dono' check (papel in ('dono', 'membro')),
  criado_em timestamptz not null default now(),
  primary key (empresa_id, user_id)
);

-- Usado pela função de RLS (busca por user_id).
create index membros_empresa_user_id_idx on public.membros_empresa (user_id);

-- Empresas do usuário logado. Retorna conjunto (pronto para multiempresa).
create or replace function privado.empresa_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.empresa_id from public.membros_empresa m where m.user_id = (select auth.uid())
$$;

revoke all on function privado.empresa_do_usuario() from public, anon;
grant execute on function privado.empresa_do_usuario() to authenticated, service_role;

-- RLS ligada e forçada.
alter table public.empresas enable row level security;
alter table public.empresas force row level security;
alter table public.membros_empresa enable row level security;
alter table public.membros_empresa force row level security;

create policy "membros leem" on public.empresas
  for select to authenticated
  using (id in (select privado.empresa_do_usuario()));

-- ADR 0013: o nome da empresa é editável (ADR 0008); só a coluna nome tem grant de update.
create policy "membros atualizam" on public.empresas
  for update to authenticated
  using (id in (select privado.empresa_do_usuario()))
  with check (id in (select privado.empresa_do_usuario()));

create policy "usuario le as proprias memberships" on public.membros_empresa
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Grants explícitos (auto_expose_new_tables = false).
revoke all on public.empresas, public.membros_empresa from public, anon, authenticated;
grant select on public.empresas to authenticated;
grant update (nome) on public.empresas to authenticated;
grant select on public.membros_empresa to authenticated;
grant all on public.empresas, public.membros_empresa to service_role;
