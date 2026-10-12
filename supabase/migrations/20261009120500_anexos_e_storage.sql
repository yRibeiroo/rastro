-- Anexos (metadados) e bucket privado "anexos" no Storage.

create table public.anexos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  transacao_id uuid not null,
  caminho text not null unique,
  nome_arquivo text not null check (length(nome_arquivo) between 1 and 255),
  tipo_mime text not null check (tipo_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  tamanho_bytes integer not null check (tamanho_bytes between 1 and 10485760), -- 10 MB
  enviado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (empresa_id, transacao_id) references public.transacoes (empresa_id, id) on delete cascade,
  -- '{empresa_id}/{transacao_id}/{uuid}.{ext}': o caminho fica preso à empresa da linha.
  check (starts_with(caminho, empresa_id::text || '/' || transacao_id::text || '/'))
);

create index anexos_transacao_id_idx on public.anexos (transacao_id);
create index anexos_empresa_transacao_idx on public.anexos (empresa_id, transacao_id);
create index anexos_enviado_por_idx on public.anexos (enviado_por);

alter table public.anexos enable row level security;
alter table public.anexos force row level security;

create policy "membros leem" on public.anexos for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros inserem" on public.anexos for insert to authenticated
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros atualizam" on public.anexos for update to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()))
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros removem" on public.anexos for delete to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));

revoke all on public.anexos from public, anon, authenticated;
grant select, insert, update, delete on public.anexos to authenticated;
grant all on public.anexos to service_role;

-- Bucket privado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Primeira pasta do caminho = empresa_id. Comparação como texto (ADR 0013): um nome que não é uuid
-- simplesmente não casa, em vez de estourar erro de cast.
create policy "anexos: membros leem" on storage.objects for select to authenticated
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] in (select e::text from privado.empresa_do_usuario() as e)
  );
create policy "anexos: membros enviam" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] in (select e::text from privado.empresa_do_usuario() as e)
  );
create policy "anexos: membros atualizam" on storage.objects for update to authenticated
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] in (select e::text from privado.empresa_do_usuario() as e)
  )
  with check (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] in (select e::text from privado.empresa_do_usuario() as e)
  );
create policy "anexos: membros removem" on storage.objects for delete to authenticated
  using (
    bucket_id = 'anexos'
    and (storage.foldername(name))[1] in (select e::text from privado.empresa_do_usuario() as e)
  );
