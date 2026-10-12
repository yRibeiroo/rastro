-- RPCs: garantir_empresa, painéis, rate limit e aplicação automática de categoria.

-- Sementes padrão de uma empresa (categorias, centros de custo, regras). Idempotente.
-- Fica em privado: só é chamada por garantir_empresa e pelo seed de desenvolvimento.
create or replace function privado.semear_empresa(p_empresa uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.categorias (empresa_id, nome, tipo, entra_no_resultado, padrao)
  select p_empresa, s.nome, s.tipo, s.entra, true
  from (values
    ('Receita de serviços', 'entrada', true),
    ('Outras receitas', 'entrada', true),
    ('Combustível', 'saida', true),
    ('Material elétrico', 'saida', true),
    ('Peças de refrigeração', 'saida', true),
    ('Equipamentos de incêndio', 'saida', true),
    ('Ferramentas e equipamentos', 'saida', true),
    ('Alimentação', 'saida', true),
    ('Impostos e taxas', 'saida', true),
    ('Folha de pagamento', 'saida', true),
    ('Pró-labore', 'saida', true),
    ('Aluguel', 'saida', true),
    ('Contas de consumo (água, luz, internet, telefone)', 'saida', true),
    ('Manutenção de veículos', 'saida', true),
    ('Tarifas bancárias', 'saida', true),
    ('Serviços contábeis', 'saida', true),
    ('Transferências', 'ambos', false),
    ('Outros', 'ambos', true)
  ) as s (nome, tipo, entra)
  on conflict (empresa_id, lower(nome)) do nothing;

  insert into public.centros_de_custo (empresa_id, nome, padrao)
  select p_empresa, s.nome, true
  from (values ('Ar-condicionado/Refrigeração'), ('Elétrica'), ('Prevenção contra incêndio'), ('Administrativo')) as s (nome)
  on conflict (empresa_id, lower(nome)) do nothing;

  insert into public.regras_categorizacao (empresa_id, padrao, campo, prioridade, categoria_id, centro_de_custo_id, origem)
  select p_empresa, s.padrao, 'descricao', 100, c.id, cc.id, 'padrao'
  from (values
    ('POSTO', 'Combustível', null),
    ('COMBUSTIVE', 'Combustível', null),
    ('TARIFA', 'Tarifas bancárias', 'Administrativo'),
    ('CESTA DE RELACIONAMENTO', 'Tarifas bancárias', 'Administrativo'),
    ('IOF', 'Impostos e taxas', 'Administrativo'),
    ('DARF', 'Impostos e taxas', 'Administrativo'),
    ('SIMPLES NACIONAL', 'Impostos e taxas', 'Administrativo'),
    ('FGTS', 'Folha de pagamento', 'Administrativo'),
    ('ALUGUEL', 'Aluguel', 'Administrativo'),
    ('RESTAURANTE', 'Alimentação', null),
    ('IFOOD', 'Alimentação', null)
  ) as s (padrao, categoria, centro)
  join public.categorias c on c.empresa_id = p_empresa and c.nome = s.categoria
  left join public.centros_de_custo cc on cc.empresa_id = p_empresa and cc.nome = s.centro
  on conflict (empresa_id, campo, padrao) do nothing;
end;
$$;

revoke all on function privado.semear_empresa(uuid) from public, anon, authenticated;

-- Chamada no callback do login. Cria empresa + membro dono + sementes se o usuário não tiver empresa.
create or replace function public.garantir_empresa(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_empresa uuid;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  -- Serializa chamadas concorrentes do mesmo usuário (duas abas no callback).
  perform pg_advisory_xact_lock(hashtextextended('garantir_empresa:' || v_uid::text, 0));

  select m.empresa_id into v_empresa
  from public.membros_empresa m
  where m.user_id = v_uid
  order by m.criado_em, m.empresa_id
  limit 1;

  if v_empresa is not null then
    return v_empresa;
  end if;

  insert into public.empresas (nome)
  values (left(coalesce(nullif(btrim(p_nome), ''), 'Minha empresa'), 120))
  returning id into v_empresa;

  insert into public.membros_empresa (empresa_id, user_id, papel) values (v_empresa, v_uid, 'dono');

  perform privado.semear_empresa(v_empresa);

  return v_empresa;
end;
$$;

revoke all on function public.garantir_empresa(text) from public, anon;
grant execute on function public.garantir_empresa(text) to authenticated, service_role;

-- Valida o período dos painéis (máximo de 24 meses, contratos §7).
create or replace function privado.validar_periodo(p_de date, p_ate date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate > (p_de + interval '25 months') then
    raise exception 'periodo_invalido' using errcode = '22023';
  end if;
end;
$$;

revoke all on function privado.validar_periodo(date, date) from public, anon;
grant execute on function privado.validar_periodo(date, date) to authenticated, service_role;

-- Painéis: security invoker (a RLS se aplica). Excluem pendentes e categorias com entra_no_resultado = false.
-- "data" já é a data contábil (date); o período é calculado pelo app no fuso America/Araguaina.
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

-- Só saídas; total positivo. categoria_id null = "Sem categoria".
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
    and t.valor < 0
    and coalesce(c.entra_no_resultado, true)
  group by t.categoria_id, c.nome
  order by 3 desc, 2;
end;
$$;

-- centro_de_custo_id null = "Sem centro de custo".
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
    and coalesce(c.entra_no_resultado, true)
  group by t.centro_de_custo_id, cc.nome
  order by 2;
end;
$$;

revoke all on function public.painel_fluxo_mensal(uuid, date, date) from public, anon;
revoke all on function public.painel_por_categoria(uuid, date, date) from public, anon;
revoke all on function public.painel_por_centro_de_custo(uuid, date, date) from public, anon;
grant execute on function public.painel_fluxo_mensal(uuid, date, date) to authenticated, service_role;
grant execute on function public.painel_por_categoria(uuid, date, date) to authenticated, service_role;
grant execute on function public.painel_por_centro_de_custo(uuid, date, date) to authenticated, service_role;

-- Rate limit com janela fixa (ADR 0011). true = ainda dentro do limite.
create or replace function public.consumir_limite_de_requisicao(p_chave text, p_maximo integer, p_janela_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dentro boolean;
begin
  if p_chave is null or p_maximo is null or p_maximo < 0 or p_janela_segundos is null or p_janela_segundos <= 0 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;

  insert into public.limites_de_requisicao as l (chave, janela, contador)
  values (p_chave, to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos), 1)
  on conflict (chave, janela) do update set contador = l.contador + 1
  returning l.contador <= p_maximo into v_dentro;

  return v_dentro;
end;
$$;

revoke all on function public.consumir_limite_de_requisicao(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite_de_requisicao(text, integer, integer) to service_role;

-- Aplicação automática de categoria (contratos §10, aplicarCategorizacaoAutomatica).
-- Filtra categoria_definida_pelo_usuario = false no banco: a categoria do usuário nunca é sobrescrita.
-- p_resultados: [{ "transacao_id", "categoria_id", "centro_de_custo_id", "origem": "regra"|"ia"|"pluggy", "regra_id", "confianca" }]
create or replace function public.aplicar_categorizacao_automatica(p_empresa uuid, p_resultados jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with r as (
    select *
    from jsonb_to_recordset(p_resultados) as x (
      transacao_id uuid, categoria_id uuid, centro_de_custo_id uuid, origem text, regra_id uuid, confianca numeric
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
        categorizacao_automatica_em = now()
    from r
    where t.id = r.transacao_id
      and t.empresa_id = p_empresa
      and not t.categoria_definida_pelo_usuario
    returning 1
  )
  select count(*)::integer from alteradas
$$;

revoke all on function public.aplicar_categorizacao_automatica(uuid, jsonb) from public, anon;
grant execute on function public.aplicar_categorizacao_automatica(uuid, jsonb) to authenticated, service_role;
