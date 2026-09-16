begin;
create or replace function public.register_public_time_entry(
  p_employee_id uuid, p_photo_path text, p_latitude float8, p_longitude float8,
  p_accuracy float8, p_browser_info text, p_idempotency_key uuid
) returns table(entry_id uuid, occurred_at timestamptz, entry_type public.time_entry_type, employee_name text, out_of_sequence boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_employee public.employees; v_company public.companies; v_location public.work_locations;
  v_now timestamptz := clock_timestamp(); v_date date; v_count integer; v_type public.time_entry_type;
  v_out boolean; v_half boolean; v_distance float8; v_target_latitude float8; v_target_longitude float8;
  v_target_radius integer; v_target_policy public.radius_policy; v_existing public.time_entries; v_id uuid;
begin
  select employee.* into v_employee from public.employees employee where employee.id = p_employee_id and employee.deleted_at is null;
  if not found then raise exception 'Colaborador não encontrado'; end if;
  if not v_employee.is_active then raise exception 'Colaborador inativo'; end if;
  select company.* into v_company from public.companies company where company.id = v_employee.company_id and company.deleted_at is null;
  v_date := (v_now at time zone v_company.timezone)::date;
  select exists(select 1 from public.employee_schedule_dates d where d.employee_id = p_employee_id and d.work_date = v_date and d.period_type = 'half') into v_half;
  select location.* into v_location from public.work_locations location where location.id = v_employee.work_location_id and location.company_id = v_employee.company_id and location.deleted_at is null;
  if found then v_target_latitude:=v_location.latitude; v_target_longitude:=v_location.longitude; v_target_radius:=v_location.allowed_radius_meters; v_target_policy:=v_location.outside_radius_policy;
  else v_target_latitude:=v_company.company_latitude; v_target_longitude:=v_company.company_longitude; v_target_radius:=v_company.allowed_radius_meters; v_target_policy:=v_company.outside_radius_policy; end if;
  perform pg_advisory_xact_lock(hashtext(p_employee_id::text || v_date::text));
  select time_entry.* into v_existing from public.time_entries time_entry where time_entry.company_id=v_employee.company_id and time_entry.idempotency_key=p_idempotency_key;
  if found then return query select v_existing.id,v_existing.occurred_at,v_existing.entry_type,v_employee.full_name,v_existing.out_of_sequence; return; end if;
  if exists(select 1 from public.time_entries recent where recent.employee_id=p_employee_id and recent.deleted_at is null and recent.occurred_at > v_now-interval '30 seconds') then raise exception 'Aguarde alguns segundos antes de registrar novamente' using errcode='P0002'; end if;
  if v_company.require_location and (p_latitude is null or p_longitude is null or p_accuracy is null) then raise exception 'Localização obrigatória'; end if;
  if v_target_latitude is not null and v_target_longitude is not null and p_latitude is not null then
    v_distance:=public.distance_meters(v_target_latitude,v_target_longitude,p_latitude,p_longitude);
    if v_target_radius is not null and v_distance>v_target_radius and v_target_policy='block' then raise exception 'Registro fora do raio permitido'; end if;
  end if;
  select count(*) into v_count from public.time_entries day_entry where day_entry.employee_id=p_employee_id and day_entry.local_date=v_date and day_entry.deleted_at is null;
  if v_half then v_type:=case v_count when 0 then 'entry'::public.time_entry_type when 1 then 'exit' else 'additional' end; v_out:=v_count>=2;
  else v_type:=case v_count when 0 then 'entry'::public.time_entry_type when 1 then 'break_start' when 2 then 'break_end' when 3 then 'exit' else 'additional' end; v_out:=v_count>=4; end if;
  insert into public.time_entries(company_id,employee_id,occurred_at,local_date,entry_type,photo_path,latitude,longitude,accuracy_meters,distance_meters,outside_allowed_radius,browser_info,origin,out_of_sequence,idempotency_key)
  values(v_employee.company_id,p_employee_id,v_now,v_date,v_type,p_photo_path,p_latitude,p_longitude,p_accuracy,v_distance,coalesce(v_distance>v_target_radius,false),left(p_browser_info,500),'employee',v_out,p_idempotency_key) returning id into v_id;
  return query select v_id,v_now,v_type,v_employee.full_name,v_out;
end $$;
revoke all on function public.register_public_time_entry(uuid,text,float8,float8,float8,text,uuid) from public, anon, authenticated;
grant execute on function public.register_public_time_entry(uuid,text,float8,float8,float8,text,uuid) to service_role;
do $$
declare r record; m record; v_id uuid; v_manager uuid; v_at timestamptz;
begin
  -- Substitui logicamente somente os pontos do intervalo autorizado.
  insert into public.time_entry_adjustments(company_id,time_entry_id,action,previous_value,justification,manager_id,request_metadata)
  select e.company_id,e.id,'delete',jsonb_build_object('occurred_at',e.occurred_at,'entry_type',e.entry_type),
    'Regularização inicial em lote de 01/09/2026 a 07/09/2026',
    (select p.id from public.manager_profiles p where p.company_id=e.company_id and p.deleted_at is null order by p.created_at limit 1),
    jsonb_build_object('source','migration','range_start','2026-09-01','range_end','2026-09-07')
  from public.time_entries e join public.employees emp on emp.id=e.employee_id
  where e.local_date between date '2026-09-01' and date '2026-09-07' and e.deleted_at is null and emp.is_active and emp.deleted_at is null;

  update public.time_entries e set deleted_at=now()
  from public.employees emp where emp.id=e.employee_id and emp.is_active and emp.deleted_at is null
    and e.local_date between date '2026-09-01' and date '2026-09-07' and e.deleted_at is null;

  for r in
    select emp.id employee_id,emp.company_id,c.timezone,d::date work_date,s.entry_time,s.break_start_time,s.break_end_time,s.exit_time,
      coalesce(sd.period_type,'full') period_type
    from public.employees emp join public.companies c on c.id=emp.company_id
    cross join generate_series(date '2026-09-01',date '2026-09-07',interval '1 day') d
    join public.employee_schedules s on s.employee_id=emp.id and s.weekday=extract(dow from d)::integer and s.is_workday
    left join public.employee_schedule_dates sd on sd.employee_id=emp.id and sd.work_date=d::date
    where emp.is_active and emp.deleted_at is null
      and (s.cycle_weeks=1 or (s.cycle_weeks=2 and sd.id is not null))
      and not exists(select 1 from public.company_holidays h where h.company_id=emp.company_id and h.holiday_date=d::date and h.deleted_at is null)
  loop
    select p.id into v_manager from public.manager_profiles p where p.company_id=r.company_id and p.deleted_at is null order by p.created_at limit 1;
    for m in
      select * from (values
        ('entry'::public.time_entry_type,r.entry_time),
        ('break_start'::public.time_entry_type,case when r.period_type='full' then r.break_start_time else null end),
        ('break_end'::public.time_entry_type,case when r.period_type='full' then r.break_end_time else null end),
        ('exit'::public.time_entry_type,case when r.period_type='full' then r.exit_time else r.entry_time + (((extract(epoch from (r.break_start_time-r.entry_time))+extract(epoch from (r.exit_time-r.break_end_time)))/2)::integer * interval '1 second') end)
      ) marks(entry_type,clock_time) where clock_time is not null
    loop
      v_at:=(r.work_date+m.clock_time) at time zone r.timezone;
      insert into public.time_entries(company_id,employee_id,occurred_at,local_date,entry_type,origin,created_by,out_of_sequence)
      values(r.company_id,r.employee_id,v_at,r.work_date,m.entry_type,'manager',v_manager,false) returning id into v_id;
      insert into public.time_entry_adjustments(company_id,time_entry_id,action,new_value,justification,manager_id,request_metadata)
      values(r.company_id,v_id,'create',jsonb_build_object('occurred_at',v_at,'entry_type',m.entry_type),'Regularização inicial em lote de 01/09/2026 a 07/09/2026',v_manager,jsonb_build_object('source','migration','range_start','2026-09-01','range_end','2026-09-07'));
    end loop;
  end loop;
end $$;
commit;
