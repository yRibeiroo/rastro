-- Demo pública: tranca o banco de DEMONSTRAÇÃO para leitura. NUNCA rode em produção.
--
-- Fica fora de supabase/migrations de propósito (não entra no `supabase db push`).
-- Ordem no projeto de demonstração (documentos/operacao.md, seção 10):
--   1. todas as migrações;
--   2. supabase/seed.sql (empresa fictícia);
--   3. criar o usuário da demo e vinculá-lo: select privado.dev_vincular_usuario_a_demo('<e-mail>');
--   4. este arquivo.
--
-- O app já recusa escritas com MODO_DEMO=1 e o visitante nunca recebe o token do usuário.
-- Isto é a segunda tranca: mesmo com um token, a sessão não consegue escrever. Pode rodar de novo.

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- Os grants por coluna (ex.: update (oculta)) não saem com o revoke da tabela.
do $$
declare
  r record;
begin
  for r in
    select distinct table_name, column_name, privilege_type
    from information_schema.column_privileges
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE')
  loop
    execute format(
      'revoke %s (%I) on public.%I from anon, authenticated',
      r.privilege_type, r.column_name, r.table_name
    );
  end loop;
end;
$$;

-- RPCs: tira tudo e devolve só as de leitura.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.painel_fluxo_mensal(uuid, date, date),
  public.painel_por_categoria(uuid, date, date),
  public.painel_por_centro_de_custo(uuid, date, date),
  public.ocorrencias_previstas(uuid, date, date),
  public.candidatos_para_conciliacao(uuid, bigint, date, integer),
  public.leituras_de_comprovante_desde(uuid, timestamptz)
to authenticated;

-- Storage: ninguém envia, troca ou apaga arquivo.
drop policy if exists "anexos: membros enviam" on storage.objects;
drop policy if exists "anexos: membros atualizam" on storage.objects;
drop policy if exists "anexos: membros removem" on storage.objects;
