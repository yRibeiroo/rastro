-- Extensões e schema privado (não exposto pelo PostgREST).
-- Modelo: documentos/arquitetura/modelo-de-dados.md §Convenções e §Segurança.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists privado;
revoke all on schema privado from public, anon;
-- authenticated precisa de usage para as policies chamarem privado.empresa_do_usuario().
grant usage on schema privado to authenticated, service_role;

-- Gatilho genérico de atualizado_em.
create or replace function privado.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

revoke all on function privado.definir_atualizado_em() from public, anon, authenticated;
