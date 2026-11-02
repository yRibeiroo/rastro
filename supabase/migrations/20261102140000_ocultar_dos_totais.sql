-- Fase 3 do roteiro (ADR 0017): "ocultar dos totais" — a transação continua no extrato e no saldo
-- da conta, mas sai do painel (fluxo, para onde foi e resultado por centro). Ex.: aplicação e resgate,
-- pagamento da fatura do cartão já lançado item a item, dinheiro emprestado que volta.
-- A sincronização (upsert) não toca a coluna: a escolha do usuário fica.

alter table public.transacoes add column oculta boolean not null default false;

grant update (oculta) on public.transacoes to authenticated;

-- Mesmas funções da migração 20261009120700, agora com "and not t.oculta".
create or replace function public.painel_fluxo_mensal(p_empresa uuid, p_de date, p_ate date)
returns table (mes text, entradas_centavos bigint, saidas_centavos bigint)
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
    select
      date_trunc('month', t.data)::date as inicio,
      coalesce(sum(t.valor) filter (where t.valor > 0), 0) as entradas,
      coalesce(-sum(t.valor) filter (where t.valor < 0), 0) as saidas
    from public.transacoes t
    left join public.categorias c on c.id = t.categoria_id
    where t.empresa_id = p_empresa
      and t.data between p_de and p_ate
      and not t.pendente
      and not t.oculta
      and coalesce(c.entra_no_resultado, true)
    group by 1
  )
  select
    to_char(m.inicio, 'YYYY-MM'),
    round(coalesce(mv.entradas, 0) * 100)::bigint,
    round(coalesce(mv.saidas, 0) * 100)::bigint
  from meses m
  left join movimento mv on mv.inicio = m.inicio
  order by m.inicio;
end;
$$;

create or replace function public.painel_por_categoria(p_empresa uuid, p_de date, p_ate date)
returns table (categoria_id uuid, nome text, total_centavos bigint, quantidade integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform privado.validar_periodo(p_de, p_ate);
  return query
  select
    t.categoria_id,
    coalesce(c.nome, 'Sem categoria'),
    round(-sum(t.valor) * 100)::bigint,
    count(*)::integer
  from public.transacoes t
  left join public.categorias c on c.id = t.categoria_id
  where t.empresa_id = p_empresa
    and t.data between p_de and p_ate
    and not t.pendente
    and not t.oculta
    and t.valor < 0
    and coalesce(c.entra_no_resultado, true)
  group by t.categoria_id, c.nome
  order by 3 desc, 2;
end;
$$;

create or replace function public.painel_por_centro_de_custo(p_empresa uuid, p_de date, p_ate date)
returns table (centro_de_custo_id uuid, nome text, entradas_centavos bigint, saidas_centavos bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform privado.validar_periodo(p_de, p_ate);
  return query
  select
    t.centro_de_custo_id,
    coalesce(cc.nome, 'Sem centro de custo'),
    round(coalesce(sum(t.valor) filter (where t.valor > 0), 0) * 100)::bigint,
    round(coalesce(-sum(t.valor) filter (where t.valor < 0), 0) * 100)::bigint
  from public.transacoes t
  left join public.categorias c on c.id = t.categoria_id
  left join public.centros_de_custo cc on cc.id = t.centro_de_custo_id
  where t.empresa_id = p_empresa
    and t.data between p_de and p_ate
    and not t.pendente
    and not t.oculta
    and coalesce(c.entra_no_resultado, true)
  group by t.centro_de_custo_id, cc.nome
  order by 2;
end;
$$;
