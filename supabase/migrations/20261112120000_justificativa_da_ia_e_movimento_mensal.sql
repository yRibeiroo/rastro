-- Fase 3 do MVP (ADR 0019): justificativa curta da IA em cada categorização e
-- movimento líquido por mês, base do gráfico de saldo ao longo do tempo.

-- ---------- Justificativa da IA ----------
-- Só é gravada quando a origem é 'ia' e é limpa quando o usuário corrige a categoria.
-- Sem constraint amarrando à origem de propósito: a tela só mostra com origem 'ia', e um
-- caminho de escrita que esquecesse de limpar não deve fazer a correção do usuário falhar.
alter table public.transacoes
  add column justificativa_ia text check (length(justificativa_ia) <= 200);

-- aplicar_categorizacao_automatica é security invoker: a sessão precisa do grant da coluna.
grant update (justificativa_ia) on public.transacoes to authenticated;

-- Mesma função da migração 20261009120700, agora gravando a justificativa (só para origem 'ia').
-- p_resultados: [{ "transacao_id", "categoria_id", "centro_de_custo_id", "origem", "regra_id", "confianca", "justificativa" }]
create or replace function public.aplicar_categorizacao_automatica(p_empresa uuid, p_resultados jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with r as (
    select *
    from jsonb_to_recordset(p_resultados) as x (
      transacao_id uuid, categoria_id uuid, centro_de_custo_id uuid, origem text, regra_id uuid,
      confianca numeric, justificativa text
    )
    where x.origem in ('regra', 'ia', 'pluggy')
  ),
  alteradas as (
    update public.transacoes t
    set categoria_id = r.categoria_id,
        centro_de_custo_id = r.centro_de_custo_id,
        categoria_origem = r.origem,
        regra_id = r.regra_id,
        confianca_ia = case when r.origem = 'ia' then r.confianca end,
        justificativa_ia = case when r.origem = 'ia' then left(nullif(btrim(r.justificativa), ''), 200) end,
        categorizacao_automatica_em = now()
    from r
    where t.id = r.transacao_id
      and t.empresa_id = p_empresa
      and not t.categoria_definida_pelo_usuario
    returning 1
  )
  select count(*)::integer from alteradas
$$;

-- ---------- Movimento líquido por mês ----------
-- Diferente dos painéis, conta TUDO o que mexe no saldo: transferências e transações ocultas entram.
-- Só as pendentes ficam de fora. Um mês sem movimento volta com zero. security invoker: a RLS se aplica.
create or replace function public.movimento_mensal(p_empresa uuid, p_de date, p_ate date)
returns table (mes text, liquido_centavos bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform privado.validar_periodo(p_de, p_ate);
  return query
  with meses as (
    select g::date as inicio
    from generate_series(date_trunc('month', p_de), date_trunc('month', p_ate), interval '1 month') as g
  ),
  movimento as (
    select date_trunc('month', t.data)::date as inicio, sum(t.valor) as liquido
    from public.transacoes t
    where t.empresa_id = p_empresa
      and t.data between p_de and p_ate
      and not t.pendente
    group by 1
  )
  select to_char(m.inicio, 'YYYY-MM'), round(coalesce(mv.liquido, 0) * 100)::bigint
  from meses m
  left join movimento mv on mv.inicio = m.inicio
  order by m.inicio;
end;
$$;

revoke all on function public.movimento_mensal(uuid, date, date) from public, anon;
grant execute on function public.movimento_mensal(uuid, date, date) to authenticated, service_role;
