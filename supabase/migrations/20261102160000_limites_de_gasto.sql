-- Fase 6 do roteiro (ADR 0017): limite de gasto mensal por categoria.
-- O gasto do mês sai de painel_por_categoria (já exclui ocultas, pendentes e transferências).

create table public.limites_de_gasto (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  categoria_id uuid not null,
  valor_mensal numeric(14, 2) not null check (valor_mensal > 0 and valor_mensal < 1e12),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, categoria_id),
  -- Categoria de outra empresa: a FK composta recusa.
  foreign key (empresa_id, categoria_id) references public.categorias (empresa_id, id) on delete cascade
);

create trigger limites_de_gasto_atualizado_em
  before update on public.limites_de_gasto
  for each row execute function privado.definir_atualizado_em();

alter table public.limites_de_gasto enable row level security;
alter table public.limites_de_gasto force row level security;

create policy "membros leem" on public.limites_de_gasto for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros inserem" on public.limites_de_gasto for insert to authenticated
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros atualizam" on public.limites_de_gasto for update to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()))
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros removem" on public.limites_de_gasto for delete to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));

revoke all on public.limites_de_gasto from public, anon, authenticated;
grant select, insert, delete on public.limites_de_gasto to authenticated;
grant update (valor_mensal) on public.limites_de_gasto to authenticated;
grant all on public.limites_de_gasto to service_role;
