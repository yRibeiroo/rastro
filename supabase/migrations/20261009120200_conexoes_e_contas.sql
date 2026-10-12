-- Conexões bancárias (itens da Pluggy) e contas.
-- unique (empresa_id, id) existe para as FKs compostas (ADR 0013): impede apontar para linha de outra empresa.

create table public.conexoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  provedor text not null default 'pluggy' check (provedor in ('pluggy')),
  id_externo text not null,
  banco text,
  status text not null check (status in ('atualizada', 'atualizando', 'aguardando_usuario', 'erro_de_login', 'desatualizada', 'erro')),
  erro_codigo text,
  erro_mensagem text,
  consentimento_expira_em timestamptz,
  ultima_sincronizacao_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (provedor, id_externo),
  unique (empresa_id, id) -- também cobre o índice (empresa_id)
);

create index conexoes_criado_por_idx on public.conexoes (criado_por);

create trigger conexoes_atualizado_em
  before update on public.conexoes
  for each row execute function privado.definir_atualizado_em();

create table public.contas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  conexao_id uuid not null,
  id_externo text not null,
  nome text not null,
  tipo text check (tipo in ('corrente', 'poupanca', 'cartao_de_credito')),
  numero text check (length(numero) <= 4), -- só os 4 últimos dígitos (minimização)
  saldo numeric(14, 2) not null default 0,
  saldo_atualizado_em timestamptz not null default now(),
  moeda text not null default 'BRL',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (empresa_id, conexao_id) references public.conexoes (empresa_id, id) on delete cascade,
  unique (conexao_id, id_externo),
  unique (empresa_id, id) -- também cobre o índice (empresa_id)
);

create index contas_empresa_conexao_idx on public.contas (empresa_id, conexao_id);

create trigger contas_atualizado_em
  before update on public.contas
  for each row execute function privado.definir_atualizado_em();

alter table public.conexoes enable row level security;
alter table public.conexoes force row level security;
alter table public.contas enable row level security;
alter table public.contas force row level security;

-- Sem insert/delete para authenticated: só a sincronização (service role) cria e remove.
create policy "membros leem" on public.conexoes
  for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros atualizam" on public.conexoes
  for update to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()))
  with check (empresa_id in (select privado.empresa_do_usuario()));

create policy "membros leem" on public.contas
  for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros atualizam" on public.contas
  for update to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()))
  with check (empresa_id in (select privado.empresa_do_usuario()));

revoke all on public.conexoes, public.contas from public, anon, authenticated;
grant select, update on public.conexoes, public.contas to authenticated;
grant all on public.conexoes, public.contas to service_role;
