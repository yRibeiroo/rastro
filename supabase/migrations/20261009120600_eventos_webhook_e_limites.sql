-- Infraestrutura: deduplicação de webhooks (ADR 0007) e rate limit (ADR 0011).
-- RLS ligada e forçada, nenhuma policy, nenhum grant para anon/authenticated: só service_role.

create table public.eventos_webhook (
  event_id text primary key,
  evento text not null,
  id_externo_conexao text,
  -- Exceção documentada: null no recebimento; o processamento preenche depois.
  empresa_id uuid references public.empresas (id) on delete cascade,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text check (length(erro) <= 500) -- mensagem curta, sem payload
);

create index eventos_webhook_nao_processados_idx on public.eventos_webhook (recebido_em) where processado_em is null;
create index eventos_webhook_empresa_id_idx on public.eventos_webhook (empresa_id);

create table public.limites_de_requisicao (
  chave text not null check (length(chave) between 1 and 200),
  janela timestamptz not null,
  contador integer not null default 0,
  primary key (chave, janela)
);
-- ponytail: a limpeza diária (janela < now() - 1 dia) faz seq scan; criar índice em (janela) se a tabela crescer.

alter table public.eventos_webhook enable row level security;
alter table public.eventos_webhook force row level security;
alter table public.limites_de_requisicao enable row level security;
alter table public.limites_de_requisicao force row level security;

revoke all on public.eventos_webhook, public.limites_de_requisicao from public, anon, authenticated;
grant all on public.eventos_webhook, public.limites_de_requisicao to service_role;
