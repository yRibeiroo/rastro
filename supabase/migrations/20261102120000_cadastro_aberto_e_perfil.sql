-- ADR 0017: cadastro aberto + perfil da conta (pessoal ou empresa) com sementes genéricas.
-- As empresas já existentes ficam como 'empresa' e mantêm as sementes que já têm.
-- privado.semear_empresa(uuid) continua existindo (sementes da HOMETEC, usadas pelo seed.sql e testes).

alter table public.empresas
  add column perfil text not null default 'empresa' check (perfil in ('pessoal', 'empresa'));

-- Sementes genéricas por perfil. Idempotente.
create or replace function privado.semear_por_perfil(p_empresa uuid, p_perfil text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_perfil = 'pessoal' then
    insert into public.categorias (empresa_id, nome, tipo, entra_no_resultado, padrao)
    select p_empresa, s.nome, s.tipo, s.entra, true
    from (values
      ('Salário', 'entrada', true),
      ('Renda extra', 'entrada', true),
      ('Rendimentos', 'entrada', true),
      ('Outras receitas', 'entrada', true),
      ('Moradia', 'saida', true),
      ('Contas de consumo (água, luz, internet, telefone)', 'saida', true),
      ('Mercado', 'saida', true),
      ('Restaurantes e delivery', 'saida', true),
      ('Transporte', 'saida', true),
      ('Combustível', 'saida', true),
      ('Saúde', 'saida', true),
      ('Educação', 'saida', true),
      ('Lazer', 'saida', true),
      ('Assinaturas', 'saida', true),
      ('Compras', 'saida', true),
      ('Cuidados pessoais', 'saida', true),
      ('Pets', 'saida', true),
      ('Impostos e taxas', 'saida', true),
      ('Tarifas bancárias', 'saida', true),
      ('Investimentos', 'ambos', false),
      ('Transferências', 'ambos', false),
      ('Outros', 'ambos', true)
    ) as s (nome, tipo, entra)
    on conflict (empresa_id, lower(nome)) do nothing;

    insert into public.regras_categorizacao (empresa_id, padrao, campo, prioridade, categoria_id, centro_de_custo_id, origem)
    select p_empresa, s.padrao, 'descricao', 100, c.id, null, 'padrao'
    from (values
      ('POSTO', 'Combustível'),
      ('COMBUSTIVE', 'Combustível'),
      ('IFOOD', 'Restaurantes e delivery'),
      ('RAPPI', 'Restaurantes e delivery'),
      ('UBER', 'Transporte'),
      ('NETFLIX', 'Assinaturas'),
      ('SPOTIFY', 'Assinaturas'),
      ('FARMACIA', 'Saúde'),
      ('DROGARIA', 'Saúde'),
      ('SUPERMERCADO', 'Mercado'),
      ('TARIFA', 'Tarifas bancárias'),
      ('IOF', 'Impostos e taxas'),
      ('ALUGUEL', 'Moradia'),
      ('CONDOMINIO', 'Moradia')
    ) as s (padrao, categoria)
    join public.categorias c on c.empresa_id = p_empresa and c.nome = s.categoria
    on conflict (empresa_id, campo, padrao) do nothing;
    return;
  end if;

  -- 'empresa': plano de contas genérico de pequena empresa.
  insert into public.categorias (empresa_id, nome, tipo, entra_no_resultado, padrao)
  select p_empresa, s.nome, s.tipo, s.entra, true
  from (values
    ('Receita de vendas', 'entrada', true),
    ('Receita de serviços', 'entrada', true),
    ('Outras receitas', 'entrada', true),
    ('Fornecedores e mercadorias', 'saida', true),
    ('Folha de pagamento', 'saida', true),
    ('Pró-labore', 'saida', true),
    ('Impostos e taxas', 'saida', true),
    ('Aluguel', 'saida', true),
    ('Contas de consumo (água, luz, internet, telefone)', 'saida', true),
    ('Software e assinaturas', 'saida', true),
    ('Marketing e publicidade', 'saida', true),
    ('Combustível', 'saida', true),
    ('Manutenção de veículos', 'saida', true),
    ('Alimentação', 'saida', true),
    ('Material de escritório', 'saida', true),
    ('Serviços contábeis', 'saida', true),
    ('Tarifas bancárias', 'saida', true),
    ('Empréstimos e juros', 'saida', true),
    ('Transferências', 'ambos', false),
    ('Outros', 'ambos', true)
  ) as s (nome, tipo, entra)
  on conflict (empresa_id, lower(nome)) do nothing;

  insert into public.centros_de_custo (empresa_id, nome, padrao)
  select p_empresa, s.nome, true
  from (values ('Administrativo'), ('Comercial'), ('Operacional')) as s (nome)
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
    ('FACEBK', 'Marketing e publicidade', 'Comercial'),
    ('RESTAURANTE', 'Alimentação', null),
    ('IFOOD', 'Alimentação', null)
  ) as s (padrao, categoria, centro)
  join public.categorias c on c.empresa_id = p_empresa and c.nome = s.categoria
  left join public.centros_de_custo cc on cc.empresa_id = p_empresa and cc.nome = s.centro
  on conflict (empresa_id, campo, padrao) do nothing;
end;
$$;

revoke all on function privado.semear_por_perfil(uuid, text) from public, anon, authenticated;

-- Novo parâmetro p_perfil (usado só na criação; para quem já tem empresa, é ignorado).
drop function public.garantir_empresa(text);

create function public.garantir_empresa(p_nome text, p_perfil text default 'empresa')
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
  if p_perfil is null or p_perfil not in ('pessoal', 'empresa') then
    raise exception 'perfil_invalido' using errcode = '22023';
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

  insert into public.empresas (nome, perfil)
  values (
    left(coalesce(nullif(btrim(p_nome), ''), case p_perfil when 'pessoal' then 'Minhas finanças' else 'Minha empresa' end), 120),
    p_perfil
  )
  returning id into v_empresa;

  insert into public.membros_empresa (empresa_id, user_id, papel) values (v_empresa, v_uid, 'dono');

  perform privado.semear_por_perfil(v_empresa, p_perfil);

  return v_empresa;
end;
$$;

revoke all on function public.garantir_empresa(text, text) from public, anon;
grant execute on function public.garantir_empresa(text, text) to authenticated, service_role;
