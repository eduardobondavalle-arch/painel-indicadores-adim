-- Adim Aluguéis — schema principal
-- Execute com `supabase db push` ou cole no SQL Editor do Supabase.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.period_status as enum ('draft', 'open', 'closed');
create type public.response_status as enum ('submitted', 'reopened', 'replaced', 'deleted');
create type public.goal_direction as enum ('higher_is_better', 'lower_is_better');

create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  display_name text not null,
  role text not null default 'admin' check (role in ('admin', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.managers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 3),
  email citext not null unique,
  active boolean not null default true,
  joined_on date not null default current_date,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.submission_periods (
  id uuid primary key default gen_random_uuid(),
  reference_month smallint not null check (reference_month between 1 and 12),
  reference_year smallint not null check (reference_year between 2020 and 2100),
  status public.period_status not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  accept_late boolean not null default false,
  created_by uuid references public.admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference_month, reference_year),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.managers(id),
  period_id uuid not null references public.submission_periods(id),
  submitted_manager_name text not null,
  submitted_manager_email citext not null,
  reference_month smallint not null check (reference_month between 1 and 12),
  reference_year smallint not null check (reference_year between 2020 and 2100),
  confirmed_review boolean not null,
  protocol text not null unique,
  status public.response_status not null default 'submitted',
  allows_replacement boolean not null default false,
  replaced_response_id uuid references public.responses(id),
  administrative_notes text,
  consistency_alert_count integer not null default 0,
  is_late boolean not null default false,
  is_demo boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.admin_users(id)
);

create unique index responses_one_active_per_manager_period
  on public.responses(manager_id, period_id)
  where status in ('submitted', 'reopened');
create index responses_period_idx on public.responses(period_id, submitted_at desc);
create index responses_manager_idx on public.responses(manager_id, submitted_at desc);

create table public.response_values (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete restrict,
  indicator_key text not null,
  indicator_number smallint not null check (indicator_number between 1 and 55),
  block_number smallint not null check (block_number between 1 and 6),
  label text not null,
  value_type text not null check (value_type in ('integer', 'decimal', 'percent', 'currency', 'nps', 'text')),
  value_numeric numeric,
  value_text text,
  original_numeric numeric,
  original_text text,
  updated_at timestamptz not null default now(),
  unique (response_id, indicator_key),
  unique (response_id, indicator_number),
  check (
    (value_type = 'text' and value_text is not null and value_numeric is null)
    or (value_type <> 'text' and value_numeric is not null and value_text is null)
  ),
  check (value_numeric is null or value_numeric >= 0),
  check (value_type not in ('percent', 'nps') or value_numeric between 0 and 100)
);
create index response_values_response_idx on public.response_values(response_id, indicator_number);

create table public.consistency_alerts (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete restrict,
  code text not null,
  message text not null,
  indicator_keys text[] not null default '{}',
  acknowledged_by_manager boolean not null default true,
  created_at timestamptz not null default now()
);
create index consistency_alerts_response_idx on public.consistency_alerts(response_id);

create table public.scoring_pillars (
  id uuid primary key default gen_random_uuid(),
  pillar_number smallint not null unique check (pillar_number between 1 and 5),
  name text not null,
  weight numeric check (weight between 0 and 100),
  minimum_lock numeric check (minimum_lock between 0 and 100),
  active boolean not null default true,
  updated_by uuid references public.admin_users(id),
  updated_at timestamptz not null default now()
);

create table public.scoring_parameters (
  id uuid primary key default gen_random_uuid(),
  indicator_key text not null unique,
  pillar_id uuid not null references public.scoring_pillars(id),
  weight numeric check (weight between 0 and 100),
  minimum_goal numeric,
  maximum_goal numeric,
  direction public.goal_direction,
  formal_complaint_veto boolean not null default false,
  updated_by uuid references public.admin_users(id),
  updated_at timestamptz not null default now(),
  check (minimum_goal is null or maximum_goal is null or maximum_goal >= minimum_goal)
);

create table public.bonus_ranges (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  minimum_score numeric check (minimum_score between 0 and 100),
  amount numeric not null check (amount in (300, 500, 800)),
  updated_by uuid references public.admin_users(id),
  updated_at timestamptz not null default now()
);

create table public.change_history (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete restrict,
  admin_user_id uuid not null references public.admin_users(id),
  field_key text not null,
  old_value jsonb,
  new_value jsonb,
  justification text not null check (char_length(trim(justification)) >= 5),
  changed_at timestamptz not null default now()
);
create index change_history_response_idx on public.change_history(response_id, changed_at desc);

create table public.admin_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid references public.admin_users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_logs_created_idx on public.admin_logs(created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admin_users_touch before update on public.admin_users
for each row execute function public.touch_updated_at();
create trigger managers_touch before update on public.managers
for each row execute function public.touch_updated_at();
create trigger periods_touch before update on public.submission_periods
for each row execute function public.touch_updated_at();
create trigger responses_touch before update on public.responses
for each row execute function public.touch_updated_at();

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = user_id and active = true and role = 'admin'
  );
$$;

create or replace function public.is_staff(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = user_id and active = true and role in ('admin', 'viewer')
  );
$$;

create or replace function public.get_open_periods()
returns table (reference_month smallint, reference_year smallint, closes_at timestamptz, accept_late boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.reference_month, p.reference_year, p.closes_at, p.accept_late
  from public.submission_periods p
  where p.status = 'open'
    and (p.opens_at is null or p.opens_at <= now())
    and (p.closes_at is null or p.closes_at >= now() or p.accept_late)
  order by p.reference_year desc, p.reference_month desc;
$$;

create or replace function public.submit_monthly_response(
  p_manager_name text,
  p_manager_email text,
  p_reference_month smallint,
  p_reference_year smallint,
  p_confirmed_review boolean,
  p_values jsonb,
  p_alerts jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager public.managers%rowtype;
  v_period public.submission_periods%rowtype;
  v_existing public.responses%rowtype;
  v_response_id uuid := gen_random_uuid();
  v_protocol text;
  v_item jsonb;
  v_alert jsonb;
  v_distinct_keys integer;
  v_number integer;
  v_expected_block integer;
  v_expected_type text;
  v_expected_keys text[] := array[
    'contratos_ativos_mes', 'contratos_vencimento_mes', 'contratos_renovados', 'contratos_nao_renovados', 'motivo_nao_renovados',
    'taxa_renovacao_informada', 'renovacoes_60_dias_ou_mais', 'renovacoes_menos_60_dias', 'renovacoes_taxa_cobrada', 'valor_reajustado_mes', 'percentual_reajuste_medio',
    'total_rescisoes', 'rescisoes_sem_inconformidade', 'inconformidade_resolvida', 'inconformidade_nao_resolvida', 'rescisoes_sem_debito', 'rescisoes_com_debito',
    'desocupados_permaneceram_adim', 'desocupados_retirados', 'motivo_real_perda',
    'chamados_abertos', 'chamados_resolvidos', 'chamados_em_aberto', 'chamados_responsabilidade_proprietario', 'chamados_responsabilidade_locatario',
    'tempo_primeira_resposta_horas', 'tempo_resolucao_horas', 'chamados_dentro_sla', 'chamados_fora_sla', 'chamados_reabertos', 'taxa_retrabalho_informada', 'nps_manutencao',
    'tempo_resposta_mensagens_horas', 'nps_proprietarios', 'respostas_pesquisa_proprietarios', 'nps_locatarios', 'respostas_pesquisa_locatarios',
    'reclamacoes_google', 'reclamacoes_reclame_aqui', 'reclamacoes_diretoria', 'descricao_reclamacoes',
    'contratos_migrados_garantida', 'valor_alugueis_migrados', 'diferenca_taxa_comissao', 'cash_go_adesoes', 'cash_go_nao_converteram',
    'imoveis_locados_incorporados', 'imoveis_vagos_trazidos', 'contratos_ativos_fim_mes', 'contratos_residenciais', 'contratos_comerciais',
    'administracao_simples', 'administracao_garantida', 'pontos_atencao', 'faria_diferente'
  ];
begin
  if p_confirmed_review is not true then
    raise exception using message = 'Confirme que os dados foram conferidos.', errcode = 'P0001';
  end if;

  if jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) <> 55 then
    raise exception using message = 'O envio deve conter exatamente os 55 indicadores.', errcode = 'P0001';
  end if;

  select count(distinct item->>'key') into v_distinct_keys
  from jsonb_array_elements(p_values) item;
  if v_distinct_keys <> 55 then
    raise exception using message = 'Há indicadores ausentes ou duplicados.', errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_values) item
    where not ((item->>'key') = any(v_expected_keys))
  ) then
    raise exception using message = 'O conjunto de indicadores não corresponde ao catálogo aprovado.', errcode = 'P0001';
  end if;

  select * into v_manager from public.managers
  where lower(email::text) = lower(trim(p_manager_email)) limit 1;
  if not found then
    raise exception using message = 'E-mail não cadastrado. Confirme o e-mail corporativo com a gestão.', errcode = 'P0001';
  end if;
  if not v_manager.active then
    raise exception using message = 'Esta gestora está inativa e não pode enviar novos dados.', errcode = 'P0001';
  end if;

  select * into v_period from public.submission_periods
  where reference_month = p_reference_month
    and reference_year = p_reference_year
    and status = 'open'
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now() or accept_late)
  limit 1;
  if not found then
    raise exception using message = 'O período selecionado não está aberto para preenchimento.', errcode = 'P0001';
  end if;

  if coalesce((select sum((item->>'value')::numeric) from jsonb_array_elements(p_values) item where item->>'key' in ('reclamacoes_google', 'reclamacoes_reclame_aqui', 'reclamacoes_diretoria')), 0) > 0
    and coalesce(trim((select item->>'value' from jsonb_array_elements(p_values) item where item->>'key' = 'descricao_reclamacoes')), '') = '' then
    raise exception using message = 'Descreva as reclamações registradas.', errcode = 'P0001';
  end if;

  select * into v_existing from public.responses
  where manager_id = v_manager.id and period_id = v_period.id
    and status in ('submitted', 'reopened')
  for update;

  if found and not v_existing.allows_replacement then
    raise exception using message = 'Já existe um envio registrado para esta gestora no período selecionado. Entre em contato com a gestão caso seja necessário corrigir os dados.', errcode = 'P0001';
  elsif found then
    update public.responses
      set status = 'replaced', allows_replacement = false
      where id = v_existing.id;
  end if;

  v_protocol := format(
    'ADIM-%s%s-%s',
    p_reference_year,
    lpad(p_reference_month::text, 2, '0'),
    upper(substr(replace(v_response_id::text, '-', ''), 1, 8))
  );

  insert into public.responses (
    id, manager_id, period_id, submitted_manager_name, submitted_manager_email,
    reference_month, reference_year, confirmed_review, protocol,
    consistency_alert_count, replaced_response_id, is_late
  ) values (
    v_response_id, v_manager.id, v_period.id, trim(p_manager_name), lower(trim(p_manager_email))::citext,
    p_reference_month, p_reference_year, true, v_protocol,
    case when jsonb_typeof(p_alerts) = 'array' then jsonb_array_length(p_alerts) else 0 end,
    case when v_existing.id is not null then v_existing.id else null end,
    coalesce(v_period.closes_at < now(), false)
  );

  for v_item in select * from jsonb_array_elements(p_values)
  loop
    v_number := (v_item->>'number')::integer;
    if v_number not between 1 and 55 or v_item->>'key' <> v_expected_keys[v_number] then
      raise exception using message = 'A numeração dos indicadores não corresponde ao catálogo aprovado.', errcode = 'P0001';
    end if;
    v_expected_block := case when v_number <= 11 then 1 when v_number <= 20 then 2 when v_number <= 32 then 3 when v_number <= 41 then 4 when v_number <= 48 then 5 else 6 end;
    v_expected_type := case
      when v_number in (5, 20, 41, 54, 55) then 'text'
      when v_number in (6, 11, 31) then 'percent'
      when v_number in (10, 43, 44) then 'currency'
      when v_number in (26, 27, 33) then 'decimal'
      when v_number in (32, 34, 36) then 'nps'
      else 'integer'
    end;
    if (v_item->>'block')::integer <> v_expected_block or v_item->>'type' <> v_expected_type then
      raise exception using message = 'O tipo ou bloco do indicador não corresponde ao catálogo aprovado.', errcode = 'P0001';
    end if;
    if v_expected_type = 'text' and v_number <> 41 and coalesce(trim(v_item->>'value'), '') = '' then
      raise exception using message = format('O indicador %s é obrigatório.', v_number), errcode = 'P0001';
    end if;
    if v_expected_type = 'text' and char_length(coalesce(v_item->>'value', '')) > 10000 then
      raise exception using message = format('O indicador %s excede o limite de texto.', v_number), errcode = 'P0001';
    end if;
    insert into public.response_values (
      response_id, indicator_key, indicator_number, block_number, label, value_type,
      value_numeric, value_text, original_numeric, original_text
    ) values (
      v_response_id,
      v_item->>'key',
      (v_item->>'number')::smallint,
      (v_item->>'block')::smallint,
      v_item->>'label',
      v_item->>'type',
      case when v_item->>'type' <> 'text' then (v_item->>'value')::numeric else null end,
      case when v_item->>'type' = 'text' then v_item->>'value' else null end,
      case when v_item->>'type' <> 'text' then (v_item->>'value')::numeric else null end,
      case when v_item->>'type' = 'text' then v_item->>'value' else null end
    );
  end loop;

  if jsonb_typeof(p_alerts) = 'array' then
    for v_alert in select * from jsonb_array_elements(p_alerts)
    loop
      insert into public.consistency_alerts (response_id, code, message, indicator_keys)
      values (
        v_response_id,
        coalesce(v_alert->>'code', 'CONSISTENCY'),
        v_alert->>'message',
        array(select jsonb_array_elements_text(coalesce(v_alert->'keys', '[]'::jsonb)))
      );
    end loop;
  end if;

  return jsonb_build_object('id', v_response_id, 'protocol', v_protocol, 'submitted_at', now());
exception
  when unique_violation then
    raise exception using message = 'Já existe um envio registrado para esta gestora no período selecionado. Entre em contato com a gestão caso seja necessário corrigir os dados.', errcode = 'P0001';
end;
$$;

create or replace function public.edit_response_indicator(
  p_response_id uuid,
  p_indicator_key text,
  p_value_numeric numeric,
  p_value_text text,
  p_justification text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.response_values%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  if char_length(trim(coalesce(p_justification, ''))) < 5 then raise exception 'Justificativa obrigatória'; end if;
  if not exists (select 1 from public.responses where id = p_response_id and status in ('submitted', 'reopened')) then
    raise exception 'Somente respostas ativas podem ser alteradas';
  end if;

  select * into v_old from public.response_values
  where response_id = p_response_id and indicator_key = p_indicator_key for update;
  if not found then raise exception 'Indicador não encontrado'; end if;

  if v_old.value_type = 'text' then
    if p_value_text is null then raise exception 'Valor de texto obrigatório'; end if;
  else
    if p_value_numeric is null or p_value_numeric < 0 then raise exception 'Valor numérico inválido'; end if;
    if v_old.value_type in ('percent', 'nps') and p_value_numeric > 100 then raise exception 'O valor deve estar entre 0 e 100'; end if;
  end if;

  insert into public.change_history (
    response_id, admin_user_id, field_key, old_value, new_value, justification
  ) values (
    p_response_id, auth.uid(), p_indicator_key,
    jsonb_build_object('numeric', v_old.value_numeric, 'text', v_old.value_text),
    jsonb_build_object('numeric', p_value_numeric, 'text', p_value_text),
    trim(p_justification)
  );

  update public.response_values set
    value_numeric = case when value_type = 'text' then null else p_value_numeric end,
    value_text = case when value_type = 'text' then p_value_text else null end,
    updated_at = now()
  where id = v_old.id;

  insert into public.admin_logs(admin_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'indicator.updated', 'response', p_response_id::text, jsonb_build_object('field', p_indicator_key));
  return true;
end;
$$;

create or replace function public.set_response_note(
  p_response_id uuid,
  p_note text,
  p_justification text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_old text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  if char_length(trim(coalesce(p_justification, ''))) < 5 then raise exception 'Justificativa obrigatória'; end if;
  select administrative_notes into v_old from public.responses where id = p_response_id for update;
  if not found then raise exception 'Resposta não encontrada'; end if;
  insert into public.change_history(response_id, admin_user_id, field_key, old_value, new_value, justification)
  values (p_response_id, auth.uid(), 'administrative_notes', to_jsonb(v_old), to_jsonb(p_note), trim(p_justification));
  update public.responses set administrative_notes = p_note where id = p_response_id;
  insert into public.admin_logs(admin_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'response.note_updated', 'response', p_response_id::text);
  return true;
end;
$$;

create or replace function public.reopen_response(p_response_id uuid, p_justification text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_old_status public.response_status;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  if char_length(trim(coalesce(p_justification, ''))) < 5 then raise exception 'Justificativa obrigatória'; end if;
  select status into v_old_status from public.responses where id = p_response_id for update;
  if not found or v_old_status not in ('submitted', 'reopened') then raise exception 'Resposta não pode ser reaberta'; end if;
  insert into public.change_history(response_id, admin_user_id, field_key, old_value, new_value, justification)
  values (p_response_id, auth.uid(), 'status', to_jsonb(v_old_status::text), to_jsonb('reopened'::text), trim(p_justification));
  update public.responses set status = 'reopened', allows_replacement = true where id = p_response_id;
  insert into public.admin_logs(admin_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'response.reopened', 'response', p_response_id::text);
  return true;
end;
$$;

create or replace function public.soft_delete_response(p_response_id uuid, p_justification text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_old_status public.response_status;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  if char_length(trim(coalesce(p_justification, ''))) < 5 then raise exception 'Justificativa obrigatória'; end if;
  select status into v_old_status from public.responses where id = p_response_id for update;
  if not found or v_old_status = 'deleted' then raise exception 'Resposta não encontrada ou já excluída'; end if;
  insert into public.change_history(response_id, admin_user_id, field_key, old_value, new_value, justification)
  values (p_response_id, auth.uid(), 'status', to_jsonb(v_old_status::text), to_jsonb('deleted'::text), trim(p_justification));
  update public.responses set status = 'deleted', deleted_at = now(), deleted_by = auth.uid(), allows_replacement = false
  where id = p_response_id;
  insert into public.admin_logs(admin_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'response.soft_deleted', 'response', p_response_id::text);
  return true;
end;
$$;

-- Row Level Security: anonymous users have no direct table access. Their only
-- allowed operations are the narrow SECURITY DEFINER functions granted below.
alter table public.admin_users enable row level security;
alter table public.managers enable row level security;
alter table public.submission_periods enable row level security;
alter table public.responses enable row level security;
alter table public.response_values enable row level security;
alter table public.consistency_alerts enable row level security;
alter table public.scoring_pillars enable row level security;
alter table public.scoring_parameters enable row level security;
alter table public.bonus_ranges enable row level security;
alter table public.change_history enable row level security;
alter table public.admin_logs enable row level security;

create policy "staff read admin profiles" on public.admin_users for select using (public.is_staff());
create policy "admin manage profiles" on public.admin_users for all using (public.is_admin()) with check (public.is_admin());

create policy "staff read managers" on public.managers for select using (public.is_staff());
create policy "admin manage managers" on public.managers for all using (public.is_admin()) with check (public.is_admin());

create policy "staff read periods" on public.submission_periods for select using (public.is_staff());
create policy "admin manage periods" on public.submission_periods for all using (public.is_admin()) with check (public.is_admin());

create policy "staff read responses" on public.responses for select using (public.is_staff());
create policy "staff read values" on public.response_values for select using (public.is_staff());
create policy "staff read alerts" on public.consistency_alerts for select using (public.is_staff());

create policy "staff read pillars" on public.scoring_pillars for select using (public.is_staff());
create policy "admin manage pillars" on public.scoring_pillars for all using (public.is_admin()) with check (public.is_admin());
create policy "staff read parameters" on public.scoring_parameters for select using (public.is_staff());
create policy "admin manage parameters" on public.scoring_parameters for all using (public.is_admin()) with check (public.is_admin());
create policy "staff read bonus ranges" on public.bonus_ranges for select using (public.is_staff());
create policy "admin manage bonus ranges" on public.bonus_ranges for all using (public.is_admin()) with check (public.is_admin());

create policy "staff read history" on public.change_history for select using (public.is_staff());
create policy "staff read logs" on public.admin_logs for select using (public.is_staff());
create policy "admin create logs" on public.admin_logs for insert with check (public.is_admin());

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.admin_users, public.managers, public.submission_periods, public.responses,
  public.response_values, public.consistency_alerts, public.scoring_pillars,
  public.scoring_parameters, public.bonus_ranges, public.change_history, public.admin_logs to authenticated;
grant insert, update on public.managers, public.submission_periods, public.scoring_pillars,
  public.scoring_parameters, public.bonus_ranges to authenticated;
grant delete on public.scoring_parameters to authenticated;
grant insert on public.admin_logs to authenticated;
grant usage, select on sequence public.admin_logs_id_seq to authenticated;

revoke all on function public.get_open_periods() from public;
revoke all on function public.submit_monthly_response(text, text, smallint, smallint, boolean, jsonb, jsonb) from public;
grant execute on function public.get_open_periods() to anon, authenticated;
grant execute on function public.submit_monthly_response(text, text, smallint, smallint, boolean, jsonb, jsonb) to anon, authenticated;
grant execute on function public.is_admin(uuid), public.is_staff(uuid) to authenticated;
grant execute on function public.edit_response_indicator(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.set_response_note(uuid, text, text) to authenticated;
grant execute on function public.reopen_response(uuid, text) to authenticated;
grant execute on function public.soft_delete_response(uuid, text) to authenticated;

insert into public.scoring_pillars (pillar_number, name)
values
  (1, 'Retenção e renovação'),
  (2, 'Operação e qualidade'),
  (3, 'Relacionamento'),
  (4, 'Crescimento e receita'),
  (5, 'Gestão da carteira')
on conflict (pillar_number) do nothing;

insert into public.bonus_ranges (label, minimum_score, amount)
values ('Faixa 1', null, 300), ('Faixa 2', null, 500), ('Faixa 3', null, 800)
on conflict (label) do nothing;

comment on function public.submit_monthly_response is
  'Única porta pública de escrita. Valida gestora, período, duplicidade e 55 indicadores; não expõe leitura.';
