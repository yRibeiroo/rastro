-- Extrato OFX importado + comprovantes lidos por IA (ADR 0016). Desvios registrados no ADR 0016 §Banco.

-- ---------- Conexão "arquivo" ----------
-- Convenção: uma conexão 'arquivo' por empresa, com id_externo = empresa_id::text (unique (provedor, id_externo)).
alter table public.conexoes drop constraint conexoes_provedor_check;
alter table public.conexoes add constraint conexoes_provedor_check check (provedor in ('pluggy', 'arquivo'));

-- ---------- Importações de extrato ----------
-- Histórico imutável: só o service role (que grava as transações) insere.
create table public.importacoes_de_extrato (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  conexao_id uuid not null,
  conta_id uuid not null,
  nome_do_arquivo text not null check (length(nome_do_arquivo) between 1 and 255),
  periodo_de date not null,
  periodo_ate date not null,
  novas integer not null default 0 check (novas >= 0),
  atualizadas integer not null default 0 check (atualizadas >= 0),
  criado_em timestamptz not null default now(),
  foreign key (empresa_id, conexao_id) references public.conexoes (empresa_id, id) on delete cascade,
  foreign key (empresa_id, conta_id) references public.contas (empresa_id, id) on delete cascade,
  check (periodo_de <= periodo_ate)
);

-- Listagem (mais recentes primeiro) e "última importação que cobre a data" (alerta de pendentes).
create index importacoes_empresa_criado_idx on public.importacoes_de_extrato (empresa_id, criado_em desc);
create index importacoes_empresa_conexao_idx on public.importacoes_de_extrato (empresa_id, conexao_id);
create index importacoes_empresa_conta_idx on public.importacoes_de_extrato (empresa_id, conta_id);

alter table public.importacoes_de_extrato enable row level security;
alter table public.importacoes_de_extrato force row level security;

create policy "membros leem" on public.importacoes_de_extrato
  for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));

revoke all on public.importacoes_de_extrato from public, anon, authenticated;
grant select on public.importacoes_de_extrato to authenticated;
grant all on public.importacoes_de_extrato to service_role;

-- ---------- Comprovantes ----------
-- O arquivo fica em anexos (anexos.comprovante_id). transacao_id é preenchido ao conciliar.
create table public.comprovantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  transacao_id uuid,
  situacao text not null default 'lendo'
    check (situacao in ('lendo', 'conciliado', 'pendente', 'ambiguo', 'erro_de_leitura')),
  tipo text check (tipo in ('pix', 'boleto', 'nfce', 'nfe', 'recibo', 'outro')),
  valor numeric(14, 2) check (valor > 0), -- valor absoluto; nulo enquanto lendo / erro de leitura
  data date,
  emissor text check (length(emissor) <= 200),
  documento_emissor text check (documento_emissor ~ '^[0-9]{11}([0-9]{3})?$'), -- CPF ou CNPJ só dígitos
  chave_de_acesso text check (chave_de_acesso ~ '^[0-9]{44}$'),
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array'),
  confianca numeric(3, 2) check (confianca between 0 and 1),
  erro text check (length(erro) <= 500),
  enviado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (empresa_id, transacao_id) references public.transacoes (empresa_id, id)
    on delete set null (transacao_id),
  -- NULLs são distintos: equivale ao índice parcial "where chave_de_acesso is not null" e serve de alvo de upsert.
  unique (empresa_id, chave_de_acesso),
  unique (empresa_id, id),
  check ((situacao = 'conciliado') = (transacao_id is not null))
);

create index comprovantes_empresa_situacao_data_idx on public.comprovantes (empresa_id, situacao, data desc);
create index comprovantes_empresa_transacao_idx on public.comprovantes (empresa_id, transacao_id);
create index comprovantes_enviado_por_idx on public.comprovantes (enviado_por);

create trigger comprovantes_atualizado_em
  before update on public.comprovantes
  for each row execute function privado.definir_atualizado_em();

-- Se a transação conciliada some (on delete set null), o comprovante volta a 'pendente' em vez de violar o check.
create or replace function privado.desconciliar_comprovante_sem_transacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.transacao_id is null and new.situacao = 'conciliado' then
    new.situacao := 'pendente';
  end if;
  return new;
end;
$$;

revoke all on function privado.desconciliar_comprovante_sem_transacao() from public, anon, authenticated;

create trigger comprovantes_desconciliar_sem_transacao
  before update on public.comprovantes
  for each row execute function privado.desconciliar_comprovante_sem_transacao();

alter table public.comprovantes enable row level security;
alter table public.comprovantes force row level security;

create policy "membros leem" on public.comprovantes for select to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros inserem" on public.comprovantes for insert to authenticated
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros atualizam" on public.comprovantes for update to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()))
  with check (empresa_id in (select privado.empresa_do_usuario()));
create policy "membros removem" on public.comprovantes for delete to authenticated
  using (empresa_id in (select privado.empresa_do_usuario()));

revoke all on public.comprovantes from public, anon, authenticated;
grant select, insert, update, delete on public.comprovantes to authenticated;
grant all on public.comprovantes to service_role;

-- ---------- Anexos: de uma transação OU de um comprovante ----------
-- Comprovante: '{empresa_id}/comprovantes/{comprovante_id}/{arquivo}', transacao_id nulo (a ligação com a
-- transação fica em comprovantes.transacao_id). Anexo comum: '{empresa_id}/{transacao_id}/{arquivo}'.
-- As policies do Storage já aceitam qualquer caminho cuja primeira pasta seja a empresa do usuário.
alter table public.anexos alter column transacao_id drop not null;
alter table public.anexos add column comprovante_id uuid;
alter table public.anexos drop constraint anexos_check;
alter table public.anexos
  add constraint anexos_comprovante_fkey foreign key (empresa_id, comprovante_id)
    references public.comprovantes (empresa_id, id) on delete cascade,
  add constraint anexos_um_arquivo_por_comprovante unique (empresa_id, comprovante_id), -- também indexa a FK
  add constraint anexos_dono_e_caminho_check check (
    num_nonnulls(transacao_id, comprovante_id) = 1
    and starts_with(caminho, empresa_id::text || '/' || case
      when comprovante_id is not null then 'comprovantes/' || comprovante_id::text
      else transacao_id::text end || '/')
  );

-- ---------- Conciliação ----------
-- Candidatos: mesmo valor absoluto (entrada ou saída) e data em ± tolerância.
create index transacoes_empresa_valor_data_idx on public.transacoes (empresa_id, valor, data);

-- security invoker: a RLS de transacoes se aplica. Tolerância limitada a 0..31 dias.
create or replace function public.candidatos_para_conciliacao(
  p_empresa uuid, p_valor_centavos bigint, p_data date, p_tolerancia_dias integer default 3
)
returns table (id uuid, data date, valor_centavos bigint, descricao text, contraparte text)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.data, round(t.valor * 100)::bigint, t.descricao, t.contraparte
  from public.transacoes t
  cross join lateral (select least(greatest(coalesce(p_tolerancia_dias, 3), 0), 31) as dias) d
  where t.empresa_id = p_empresa
    and t.valor in (abs(p_valor_centavos) / 100.0, -abs(p_valor_centavos) / 100.0)
    and t.data between p_data - d.dias and p_data + d.dias
  order by abs(t.data - p_data), t.data, t.id
$$;

revoke all on function public.candidatos_para_conciliacao(uuid, bigint, date, integer) from public, anon;
grant execute on function public.candidatos_para_conciliacao(uuid, bigint, date, integer) to authenticated, service_role;
