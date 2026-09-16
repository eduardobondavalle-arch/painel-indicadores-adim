-- Keep all 55 operational indicators and all existing responses untouched.
-- Additional facts and the official rules have their own audited, versioned storage.
alter table public.scoring_pillars
  add column if not exists complaint_absence_weight numeric check (complaint_absence_weight between 0 and 100);

create table public.response_bonus_inputs (
  response_id uuid primary key references public.responses(id) on delete cascade,
  eligible_renewals integer check (eligible_renewals >= 0),
  adjustments_due integer check (adjustments_due >= 0),
  adjustments_on_time integer check (adjustments_on_time >= 0),
  eligible_vacancies integer check (eligible_vacancies >= 0),
  maintenance_csat numeric check (maintenance_csat between 1 and 5),
  owner_satisfaction_scale text check (owner_satisfaction_scale in ('nps', 'csat_0_100')),
  tenant_satisfaction_scale text check (tenant_satisfaction_scale in ('nps', 'csat_0_100')),
  directorate_complaints_attributable integer check (directorate_complaints_attributable >= 0),
  cash_go_verified integer check (cash_go_verified >= 0),
  capture_fee_amount numeric check (capture_fee_amount >= 0),
  migration_commission_amount numeric check (migration_commission_amount >= 0),
  updated_at timestamptz not null default now(),
  check (adjustments_due is null or adjustments_on_time is null or adjustments_on_time <= adjustments_due)
);

create table public.scoring_rule_versions (
  id uuid primary key default gen_random_uuid(),
  configuration jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.admin_users(id),
  reason text not null
);

create table public.period_rule_versions (
  period_id uuid primary key references public.submission_periods(id) on delete restrict,
  rule_version_id uuid not null references public.scoring_rule_versions(id) on delete restrict,
  frozen_at timestamptz not null default now(),
  frozen_by uuid references public.admin_users(id)
);

create table public.period_scoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.submission_periods(id) on delete restrict,
  response_id uuid not null references public.responses(id) on delete cascade,
  rule_version_id uuid not null references public.scoring_rule_versions(id) on delete restrict,
  revision integer not null check (revision >= 1),
  result jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.admin_users(id),
  unique (response_id, revision)
);

create index period_scoring_snapshots_period_idx on public.period_scoring_snapshots(period_id, created_at desc);

alter table public.response_bonus_inputs enable row level security;
alter table public.scoring_rule_versions enable row level security;
alter table public.period_rule_versions enable row level security;
alter table public.period_scoring_snapshots enable row level security;
create policy "staff read bonus facts" on public.response_bonus_inputs for select using (public.is_staff());
create policy "staff read rule versions" on public.scoring_rule_versions for select using (public.is_staff());
create policy "staff read frozen rules" on public.period_rule_versions for select using (public.is_staff());
create policy "staff read scoring snapshots" on public.period_scoring_snapshots for select using (public.is_staff());
grant select on public.response_bonus_inputs, public.scoring_rule_versions,
  public.period_rule_versions, public.period_scoring_snapshots to authenticated;

-- Preserve the five original pillar IDs and the three original bonus-range IDs.
update public.scoring_pillars set
  name = case pillar_number
    when 1 then 'Crescimento e Receita'
    when 2 then 'Renovação e Retenção'
    when 3 then 'Rescisão e Retenção de Carteira'
    when 4 then 'Manutenção'
    when 5 then 'Relacionamento e Atendimento'
  end,
  weight = case pillar_number when 1 then 35 when 2 then 25 when 3 then 15 when 4 then 15 else 10 end,
  minimum_lock = 70,
  complaint_absence_weight = case when pillar_number = 5 then 15 else 0 end;

insert into public.scoring_parameters
  (indicator_key, pillar_id, weight, minimum_goal, maximum_goal, direction, formal_complaint_veto)
select rule.key, pillar.id, rule.weight, rule.minimum_goal, rule.maximum_goal,
       rule.direction::public.goal_direction, false
from (values
 ('i1',1,40,0,50,'higher_is_better'),('i2',1,35,0,2,'higher_is_better'),
 ('i3',1,25,0,1,'higher_is_better'),('i4',2,50,60,95,'higher_is_better'),
 ('i5',2,30,0,100,'higher_is_better'),('i6',2,20,0,100,'higher_is_better'),
 ('i7',3,50,0,80,'higher_is_better'),('i8',3,50,50,90,'higher_is_better'),
 ('i9',4,30,4,24,'lower_is_better'),('i10',4,30,48,96,'lower_is_better'),
 ('i11',4,25,0,20,'lower_is_better'),('i12',4,15,3,4.5,'higher_is_better'),
 ('i13',5,35,2,12,'lower_is_better'),('i14',5,30,30,70,'higher_is_better'),
 ('i15',5,20,30,70,'higher_is_better')
) as rule(key,pillar_number,weight,minimum_goal,maximum_goal,direction)
join public.scoring_pillars pillar on pillar.pillar_number = rule.pillar_number
on conflict (indicator_key) do update set pillar_id = excluded.pillar_id,
  weight = excluded.weight, minimum_goal = excluded.minimum_goal,
  maximum_goal = excluded.maximum_goal, direction = excluded.direction,
  formal_complaint_veto = false;

update public.bonus_ranges set
  minimum_score = case amount when 300 then 50 when 500 then 70 else 90 end,
  label = case amount when 300 then 'Faixa 1' when 500 then 'Faixa 2' else 'Faixa 3' end;

-- Public entry point: legacy 55 fields are still validated by the original RPC.
-- Verification-only fields are never accepted from the public submission.
create or replace function public.submit_monthly_response_v2(
  p_manager_name text, p_manager_email text, p_reference_month smallint,
  p_reference_year smallint, p_confirmed_review boolean, p_values jsonb,
  p_alerts jsonb, p_bonus_inputs jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
  v_eligible integer;
  v_adjustments integer;
  v_applied integer;
  v_vacancies integer;
  v_csat numeric;
begin
  if jsonb_typeof(p_bonus_inputs) <> 'object' then raise exception 'Dados adicionais inválidos'; end if;
  if not (p_bonus_inputs ?& array['eligible_renewals','adjustments_due','adjustments_on_time','eligible_vacancies','maintenance_csat','owner_satisfaction_scale','tenant_satisfaction_scale']) then
    raise exception 'Preencha os campos complementares da bonificação';
  end if;
  v_eligible := (p_bonus_inputs->>'eligible_renewals')::integer;
  v_adjustments := (p_bonus_inputs->>'adjustments_due')::integer;
  v_applied := (p_bonus_inputs->>'adjustments_on_time')::integer;
  v_vacancies := (p_bonus_inputs->>'eligible_vacancies')::integer;
  v_csat := (p_bonus_inputs->>'maintenance_csat')::numeric;
  if v_eligible is null or v_eligible < 0 or v_adjustments is null or v_adjustments < 0 or
     v_applied is null or v_applied < 0 or v_applied > v_adjustments or v_vacancies is null or
     v_vacancies < 0 or v_csat is null or v_csat not between 1 and 5 then
    raise exception 'Os dados complementares da bonificação são inválidos';
  end if;
  if p_bonus_inputs->>'owner_satisfaction_scale' is distinct from 'nps' or
     p_bonus_inputs->>'tenant_satisfaction_scale' is distinct from 'nps' then
    raise exception 'Informe a escala da pesquisa de satisfação';
  end if;
  if v_eligible < (select (item->>'value')::integer from jsonb_array_elements(p_values) item where item->>'key' = 'renovacoes_taxa_cobrada') or
     v_vacancies < (select (item->>'value')::integer from jsonb_array_elements(p_values) item where item->>'key' = 'desocupados_permaneceram_adim') then
    raise exception 'Os totais elegíveis não podem ser menores que seus subtotais';
  end if;
  v_result := public.submit_monthly_response(p_manager_name, p_manager_email, p_reference_month,
    p_reference_year, p_confirmed_review, p_values, p_alerts);
  insert into public.response_bonus_inputs (response_id, eligible_renewals, adjustments_due,
    adjustments_on_time, eligible_vacancies, maintenance_csat, owner_satisfaction_scale,
    tenant_satisfaction_scale)
  values ((v_result->>'id')::uuid, v_eligible, v_adjustments, v_applied, v_vacancies,
    v_csat, p_bonus_inputs->>'owner_satisfaction_scale', p_bonus_inputs->>'tenant_satisfaction_scale');
  return v_result;
end;
$$;
revoke all on function public.submit_monthly_response_v2(text,text,smallint,smallint,boolean,jsonb,jsonb,jsonb) from public;
grant execute on function public.submit_monthly_response_v2(text,text,smallint,smallint,boolean,jsonb,jsonb,jsonb) to anon, authenticated;

-- All supplementary corrections carry who/when/why and original/new values.
create or replace function public.edit_response_bonus_input(
  p_response_id uuid, p_field text, p_numeric numeric, p_text text, p_justification text
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_old jsonb; v_new jsonb; v_row public.response_bonus_inputs%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  if char_length(trim(coalesce(p_justification, ''))) < 5 then raise exception 'Justificativa obrigatória'; end if;
  if p_field not in ('eligible_renewals','adjustments_due','adjustments_on_time','eligible_vacancies',
    'maintenance_csat','owner_satisfaction_scale','tenant_satisfaction_scale',
    'directorate_complaints_attributable','cash_go_verified', 'capture_fee_amount','migration_commission_amount') then
    raise exception 'Campo inválido';
  end if;
  if not exists (select 1 from public.responses where id=p_response_id and status in ('submitted','reopened')) then
    raise exception 'Somente respostas ativas podem ser editadas';
  end if;
  insert into public.response_bonus_inputs(response_id) values (p_response_id) on conflict do nothing;
  select * into v_row from public.response_bonus_inputs where response_id=p_response_id for update;
  v_old := to_jsonb(v_row)->p_field;
  if p_field in ('owner_satisfaction_scale','tenant_satisfaction_scale') then
    if p_text not in ('nps','csat_0_100') then raise exception 'Escala inválida'; end if;
    v_new := to_jsonb(p_text);
  else
    if p_numeric is null or p_numeric < 0 then raise exception 'Valor inválido'; end if;
    if p_field in ('eligible_renewals','adjustments_due','adjustments_on_time','eligible_vacancies',
        'directorate_complaints_attributable','cash_go_verified') and p_numeric <> trunc(p_numeric) then
      raise exception 'Informe um número inteiro';
    end if;
    if p_field='maintenance_csat' and p_numeric not between 1 and 5 then raise exception 'CSAT fora da escala 1 a 5'; end if;
    v_new := to_jsonb(p_numeric);
  end if;
  update public.response_bonus_inputs set
    eligible_renewals = case when p_field='eligible_renewals' then p_numeric::integer else eligible_renewals end,
    adjustments_due = case when p_field='adjustments_due' then p_numeric::integer else adjustments_due end,
    adjustments_on_time = case when p_field='adjustments_on_time' then p_numeric::integer else adjustments_on_time end,
    eligible_vacancies = case when p_field='eligible_vacancies' then p_numeric::integer else eligible_vacancies end,
    maintenance_csat = case when p_field='maintenance_csat' then p_numeric else maintenance_csat end,
    owner_satisfaction_scale = case when p_field='owner_satisfaction_scale' then p_text else owner_satisfaction_scale end,
    tenant_satisfaction_scale = case when p_field='tenant_satisfaction_scale' then p_text else tenant_satisfaction_scale end,
    directorate_complaints_attributable = case when p_field='directorate_complaints_attributable' then p_numeric::integer else directorate_complaints_attributable end,
    cash_go_verified = case when p_field='cash_go_verified' then p_numeric::integer else cash_go_verified end,
    capture_fee_amount = case when p_field='capture_fee_amount' then p_numeric else capture_fee_amount end,
    migration_commission_amount = case when p_field='migration_commission_amount' then p_numeric else migration_commission_amount end,
    updated_at = now()
  where response_id=p_response_id;
  select * into v_row from public.response_bonus_inputs where response_id=p_response_id;
  if v_row.eligible_renewals < (select value_numeric from public.response_values
       where response_id=p_response_id and indicator_key='renovacoes_taxa_cobrada') or
     v_row.eligible_vacancies < (select value_numeric from public.response_values
       where response_id=p_response_id and indicator_key='desocupados_permaneceram_adim') then
    raise exception 'Os elegíveis não podem ser menores que os subtotais declarados';
  end if;
  insert into public.change_history(response_id,admin_user_id,field_key,old_value,new_value,justification)
  values (p_response_id,auth.uid(),p_field,v_old,v_new,trim(p_justification));
  return true;
end;
$$;
revoke all on function public.edit_response_bonus_input(uuid,text,numeric,text,text) from public;
grant execute on function public.edit_response_bonus_input(uuid,text,numeric,text,text) to authenticated;

-- Atomic close: pin the exact rules, store all results, then close the period.
create or replace function public.close_period_with_scores(p_period_id uuid, p_version_id uuid, p_results jsonb)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_item jsonb; v_expected integer; v_supplied integer; v_pinned uuid; v_revision integer;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  perform 1 from public.submission_periods where id = p_period_id and status='open' for update;
  if not found then raise exception 'Período não está aberto'; end if;
  if not exists (select 1 from public.scoring_rule_versions where id=p_version_id) then raise exception 'Versão inexistente'; end if;
  select rule_version_id into v_pinned from public.period_rule_versions where period_id=p_period_id;
  if v_pinned is not null and v_pinned <> p_version_id then raise exception 'Use a régua já congelada para este período'; end if;
  select count(*) into v_expected from public.responses where period_id=p_period_id and status in ('submitted','reopened');
  if jsonb_typeof(p_results)<>'array' then raise exception 'Resultados inválidos'; end if;
  select count(distinct item->>'response_id') into v_supplied from jsonb_array_elements(p_results) item;
  if v_expected <> jsonb_array_length(p_results) or v_supplied <> v_expected then
    raise exception 'Todos os envios ativos devem possuir resultado';
  end if;
  if v_pinned is null then
    insert into public.period_rule_versions(period_id,rule_version_id,frozen_by)
    values(p_period_id,p_version_id,auth.uid());
  end if;
  for v_item in select * from jsonb_array_elements(p_results) loop
    if not exists(select 1 from public.responses where id=(v_item->>'response_id')::uuid
      and period_id=p_period_id and status in ('submitted','reopened')) then
      raise exception 'O resultado contém uma resposta de outro período';
    end if;
    select coalesce(max(revision),0)+1 into v_revision from public.period_scoring_snapshots
      where response_id=(v_item->>'response_id')::uuid;
    insert into public.period_scoring_snapshots(period_id,response_id,rule_version_id,revision,result,created_by)
    values(p_period_id,(v_item->>'response_id')::uuid,p_version_id,v_revision,v_item->'result',auth.uid());
  end loop;
  update public.submission_periods set status='closed',accept_late=false where id=p_period_id;
  insert into public.admin_logs(admin_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'period.scoring_frozen','period',p_period_id::text,
    jsonb_build_object('rule_version_id',p_version_id,'responses',v_expected));
  return true;
end;
$$;
revoke all on function public.close_period_with_scores(uuid,uuid,jsonb) from public;
grant execute on function public.close_period_with_scores(uuid,uuid,jsonb) to authenticated;

create or replace function public.record_score_revision(p_response_id uuid,p_result jsonb)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_period_id uuid; v_rule_id uuid; v_revision integer;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  select r.period_id, pr.rule_version_id into v_period_id,v_rule_id
  from public.responses r join public.period_rule_versions pr on pr.period_id=r.period_id
  where r.id=p_response_id and r.status in ('submitted','reopened');
  if not found then raise exception 'Resposta não possui régua fechada'; end if;
  perform 1 from public.period_rule_versions where period_id=v_period_id for update;
  select coalesce(max(revision),0)+1 into v_revision from public.period_scoring_snapshots where response_id=p_response_id;
  insert into public.period_scoring_snapshots(period_id,response_id,rule_version_id,revision,result,created_by)
  values(v_period_id,p_response_id,v_rule_id,v_revision,p_result,auth.uid());
  return true;
end;
$$;
revoke all on function public.record_score_revision(uuid,jsonb) from public;
grant execute on function public.record_score_revision(uuid,jsonb) to authenticated;

insert into public.scoring_rule_versions(configuration,reason)
select jsonb_build_object(
  'pillars', (select jsonb_agg(to_jsonb(p) order by p.pillar_number)
    from (select id,pillar_number,name,weight,minimum_lock,complaint_absence_weight from public.scoring_pillars) p),
  'parameters', (select jsonb_agg(to_jsonb(k) order by k.indicator_key)
    from (select indicator_key,pillar_id,weight,minimum_goal,maximum_goal,direction,formal_complaint_veto from public.scoring_parameters where indicator_key ~ '^i([1-9]|1[0-5])$') k),
  'bonuses', (select jsonb_agg(to_jsonb(b) order by b.amount)
    from (select id,label,minimum_score,amount from public.bonus_ranges) b)
), 'Régua oficial da planilha Controle_Bonificacao_Gestoras_1.xlsx';

-- Every parameter edit and its new version are committed in the same transaction.
create or replace function public.save_official_scoring_rules(p_configuration jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_pillar jsonb; v_kpi jsonb; v_bonus jsonb; v_version uuid;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Justificativa obrigatória'; end if;
  if jsonb_array_length(p_configuration->'pillars') <> 5 or
     jsonb_array_length(p_configuration->'parameters') <> 15 or
     jsonb_array_length(p_configuration->'bonuses') <> 3 then raise exception 'Régua incompleta'; end if;
  if (select count(distinct item->>'indicator_key') from jsonb_array_elements(p_configuration->'parameters') item) <> 15 or
     exists (select 1 from jsonb_array_elements(p_configuration->'parameters') item where item->>'indicator_key' !~ '^i([1-9]|1[0-5])$') then
    raise exception 'São permitidos apenas os 15 KPIs oficiais';
  end if;
  if (select sum((item->>'weight')::numeric) from jsonb_array_elements(p_configuration->'pillars') item) <> 100 then
    raise exception 'Os pesos dos pilares devem somar 100';
  end if;
  for v_pillar in select * from jsonb_array_elements(p_configuration->'pillars') loop
    update public.scoring_pillars set weight=(v_pillar->>'weight')::numeric,
      minimum_lock=(v_pillar->>'minimum_lock')::numeric,
      complaint_absence_weight=(v_pillar->>'complaint_absence_weight')::numeric,
      updated_by=auth.uid(), updated_at=now()
    where id=(v_pillar->>'id')::uuid and pillar_number=(v_pillar->>'pillar_number')::integer;
    if not found then raise exception 'Pilar inválido'; end if;
  end loop;
  for v_kpi in select * from jsonb_array_elements(p_configuration->'parameters') loop
    update public.scoring_parameters set weight=(v_kpi->>'weight')::numeric,
      minimum_goal=(v_kpi->>'minimum_goal')::numeric,
      maximum_goal=(v_kpi->>'maximum_goal')::numeric,
      direction=(v_kpi->>'direction')::public.goal_direction,
      updated_by=auth.uid(), updated_at=now()
    where indicator_key=v_kpi->>'indicator_key' and pillar_id=(v_kpi->>'pillar_id')::uuid;
    if not found then raise exception 'Indicador fora do pilar oficial'; end if;
  end loop;
  for v_bonus in select * from jsonb_array_elements(p_configuration->'bonuses') loop
    update public.bonus_ranges set minimum_score=(v_bonus->>'minimum_score')::numeric,
      updated_by=auth.uid(),updated_at=now()
    where id=(v_bonus->>'id')::uuid and amount=(v_bonus->>'amount')::numeric;
    if not found then raise exception 'Faixa não encontrada'; end if;
  end loop;
  insert into public.scoring_rule_versions(configuration,created_by,reason)
  select jsonb_build_object(
    'pillars',(select jsonb_agg(to_jsonb(p) order by p.pillar_number) from
      (select id,pillar_number,name,weight,minimum_lock,complaint_absence_weight from public.scoring_pillars) p),
    'parameters',(select jsonb_agg(to_jsonb(k) order by k.indicator_key) from
      (select indicator_key,pillar_id,weight,minimum_goal,maximum_goal,direction,formal_complaint_veto
       from public.scoring_parameters where indicator_key ~ '^i([1-9]|1[0-5])$') k),
    'bonuses',(select jsonb_agg(to_jsonb(b) order by b.amount) from
      (select id,label,minimum_score,amount from public.bonus_ranges) b)
  ),auth.uid(),trim(p_reason) returning id into v_version;
  insert into public.admin_logs(admin_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'scoring.updated','scoring',v_version::text,jsonb_build_object('reason',trim(p_reason)));
  return v_version;
end;
$$;
revoke all on function public.save_official_scoring_rules(jsonb,text) from public;
grant execute on function public.save_official_scoring_rules(jsonb,text) to authenticated;

-- Administrative changes must pass through the audited/versioned RPC. Keep the
-- original public submission RPC available during rollout so the currently
-- deployed frontend remains functional until the new frontend is deployed.
-- Responses submitted through it lack the new facts and remain pending for
-- scoring until an administrator supplies audited corrections.
revoke insert,update,delete on public.scoring_pillars, public.scoring_parameters,
  public.bonus_ranges from authenticated;
