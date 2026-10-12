-- Categorias, centros de custo e regras de categorização.

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(nome) between 1 and 60),
  tipo text not null check (tipo in ('entrada', 'saida', 'ambos')),
  entra_no_resultado boolean not null default true,
  padrao boolean not null default false,
  arquivada boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (empresa_id, id)
);

create unique index categorias_empresa_nome_unico on public.categorias (empresa_id, lower(nome));

create table public.centros_de_custo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(nome) between 1 and 60),
  padrao boolean not null default false,
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (empresa_id, id)
);

create unique index centros_de_custo_empresa_nome_unico on public.centros_de_custo (empresa_id, lower(nome));

create table public.regras_categorizacao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  -- Já normalizado: maiúsculas, espaços colapsados, sem espaço nas pontas (a remoção de acentos é do app).
  padrao text not null check (
    length(padrao) between 2 and 100
    and padrao = upper(padrao)
    and padrao = btrim(regexp_replace(padrao, '\s+', ' ', 'g'))
  ),
  campo text not null default 'descricao' check (campo in ('descricao', 'contraparte')),
  prioridade integer not null default 100, -- menor número vence
  categoria_id uuid not null,
  centro_de_custo_id uuid,
  origem text not null check (origem in ('padrao', 'usuario', 'correcao')),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  -- ADR 0013: "no action" (não "restrict") para que apagar a empresa em cascata funcione.
  foreign key (empresa_id, categoria_id) references public.categorias (empresa_id, id),
  foreign key (empresa_id, centro_de_custo_id) references public.centros_de_custo (empresa_id, id)
    on delete set null (centro_de_custo_id),
  unique (empresa_id, campo, padrao),
  unique (empresa_id, id)
);

create index regras_empresa_ativa_prioridade_idx on public.regras_categorizacao (empresa_id, ativa, prioridade);
create index regras_empresa_categoria_idx on public.regras_categorizacao (empresa_id, categoria_id);
create index regras_empresa_centro_idx on public.regras_categorizacao (empresa_id, centro_de_custo_id);

alter table public.categorias enable row level security;
alter table public.categorias force row level security;
alter table public.centros_de_custo enable row level security;
alter table public.centros_de_custo force row level security;
alter table public.regras_categorizacao enable row level security;
alter table public.regras_categorizacao force row level security;

-- Política padrão: CRUD para membros da empresa.
do $$
declare
  t text;
begin
  foreach t in array array['categorias', 'centros_de_custo', 'regras_categorizacao'] loop
    execute format($p$
      create policy "membros leem" on public.%1$I for select to authenticated
        using (empresa_id in (select privado.empresa_do_usuario()));
      create policy "membros inserem" on public.%1$I for insert to authenticated
        with check (empresa_id in (select privado.empresa_do_usuario()));
      create policy "membros atualizam" on public.%1$I for update to authenticated
        using (empresa_id in (select privado.empresa_do_usuario()))
        with check (empresa_id in (select privado.empresa_do_usuario()));
      create policy "membros removem" on public.%1$I for delete to authenticated
        using (empresa_id in (select privado.empresa_do_usuario()));
      revoke all on public.%1$I from public, anon, authenticated;
      grant select, insert, update, delete on public.%1$I to authenticated;
      grant all on public.%1$I to service_role;
    $p$, t);
  end loop;
end;
$$;
