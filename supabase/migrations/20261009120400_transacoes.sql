-- Transações. Valor negativo = saída.
-- FKs compostas por (empresa_id, ...) impedem referenciar conta/categoria/centro/regra de outra empresa (ADR 0013).

create table public.transacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  conexao_id uuid not null,
  conta_id uuid not null,
  id_externo text not null,
  data date not null,
  descricao text not null,
  descricao_original text,
  valor numeric(14, 2) not null check (valor <> 0),
  pendente boolean not null default false,
  contraparte text,
  metodo_de_pagamento text,
  categoria_do_provedor text,
  categoria_id uuid,
  centro_de_custo_id uuid,
  categoria_origem text check (categoria_origem in ('regra', 'ia', 'usuario', 'pluggy')),
  categoria_definida_pelo_usuario boolean not null default false,
  regra_id uuid,
  confianca_ia numeric(3, 2) check (confianca_ia between 0 and 1),
  categorizacao_automatica_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (empresa_id, conexao_id) references public.conexoes (empresa_id, id) on delete cascade,
  foreign key (empresa_id, conta_id) references public.contas (empresa_id, id) on delete cascade,
  foreign key (empresa_id, categoria_id) references public.categorias (empresa_id, id)
    on delete set null (categoria_id),
  foreign key (empresa_id, centro_de_custo_id) references public.centros_de_custo (empresa_id, id)
    on delete set null (centro_de_custo_id),
  foreign key (empresa_id, regra_id) references public.regras_categorizacao (empresa_id, id)
    on delete set null (regra_id),
  unique (empresa_id, id_externo), -- alvo do upsert da sincronização
  unique (empresa_id, id),
  check (not categoria_definida_pelo_usuario or categoria_origem = 'usuario'),
  check ((categoria_origem = 'ia') = (confianca_ia is not null))
);

-- Extrato paginado por cursor e painel.
create index transacoes_empresa_data_idx on public.transacoes (empresa_id, data desc, id);
-- Filtros e painel.
create index transacoes_empresa_categoria_idx on public.transacoes (empresa_id, categoria_id, data);
create index transacoes_empresa_centro_idx on public.transacoes (empresa_id, centro_de_custo_id, data);
-- Pendentes de categorização.
create index transacoes_pendentes_categorizacao_idx on public.transacoes (empresa_id)
  where categoria_id is null and categorizacao_automatica_em is null and not categoria_definida_pelo_usuario;
-- Busca ilike no extrato.
create index transacoes_descricao_trgm_idx on public.transacoes using gin (descricao extensions.gin_trgm_ops);
create index transacoes_contraparte_trgm_idx on public.transacoes using gin (contraparte extensions.gin_trgm_ops);
-- Chaves estrangeiras.
create index transacoes_conta_id_idx on public.transacoes (conta_id);
create index transacoes_conexao_id_idx on public.transacoes (conexao_id);
create index transacoes_regra_id_idx on public.transacoes (regra_id);

create trigger transacoes_atualizado_em
  before update on public.transacoes
  for each row execute function privado.definir_atualizado_em();

-- Defesa no banco: uma vez definida pelo usuário, nenhuma escrita automática desmarca a proteção.
-- Se um update tentar desligar categoria_definida_pelo_usuario, as colunas de categoria voltam ao valor anterior.
-- (Uma escrita automática que mantenha o flag e mude a origem viola o check "origem = usuario".)
create or replace function privado.proteger_categoria_do_usuario()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.categoria_definida_pelo_usuario and not new.categoria_definida_pelo_usuario then
    new.categoria_definida_pelo_usuario := true;
    new.categoria_id := old.categoria_id;
    new.centro_de_custo_id := old.centro_de_custo_id;
    new.categoria_origem := old.categoria_origem;
    new.regra_id := old.regra_id;
    new.confianca_ia := old.confianca_ia;
  end if;
  return new;
end;
$$;

revoke all on function privado.proteger_categoria_do_usuario() from public, anon, authenticated;

create trigger transacoes_proteger_categoria_do_usuario
  before update on public.transacoes
  for each row execute function privado.proteger_categoria_do_usuario();

alter table public.transacoes enable row level security;
alter table public.transacoes force row level security;

-- Sem insert/delete para authenticated: só a sincronização (service role) cria e remove.
create policy "membros leem" on public.transacoes
  for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros atualizam" on public.transacoes
  for update to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()))
  with check (empresa_id in (select privado.empresa_do_usuario()));

revoke all on public.transacoes from public, anon, authenticated;
grant select on public.transacoes to authenticated;
-- O usuário só altera categorização (ADR 0013): dados bancários são imutáveis pela sessão.
grant update (
  categoria_id, centro_de_custo_id, categoria_origem, categoria_definida_pelo_usuario,
  regra_id, confianca_ia, categorizacao_automatica_em
) on public.transacoes to authenticated;
grant all on public.transacoes to service_role;
