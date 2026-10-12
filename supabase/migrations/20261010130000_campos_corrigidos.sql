-- RF-41 e RNF-26 (ADR 0016): campos corrigidos à mão e leituras pela IA por comprovante.

-- Campos que o usuário corrigiu: uma releitura pela IA não os sobrescreve.
alter table public.comprovantes
  add column campos_corrigidos text[] not null default '{}',
  -- Instantes de cada leitura pela IA (envio e "Tentar ler de novo"): base do teto mensal.
  add column leituras_ia_em timestamptz[] not null default '{}';

-- Leituras pela IA da empresa desde um instante (teto mensal, RNF-26).
-- security invoker: a RLS de comprovantes se aplica.
create or replace function public.leituras_de_comprovante_desde(p_empresa uuid, p_desde timestamptz)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.comprovantes c
  cross join lateral unnest(c.leituras_ia_em) as l(em)
  where c.empresa_id = p_empresa and l.em >= p_desde
$$;

revoke all on function public.leituras_de_comprovante_desde(uuid, timestamptz) from public, anon;
grant execute on function public.leituras_de_comprovante_desde(uuid, timestamptz) to authenticated, service_role;
