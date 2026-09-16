begin;
create table if not exists public.employee_schedule_dates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  employee_id uuid not null references public.employees(id),
  work_date date not null,
  period_type text not null default 'full' check (period_type in ('full', 'half')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date)
);
create index if not exists employee_schedule_dates_employee_date
  on public.employee_schedule_dates(employee_id, work_date);
alter table public.employee_schedule_dates enable row level security;
create policy employee_schedule_dates_manager_select on public.employee_schedule_dates
  for select to authenticated using (public.is_company_manager(company_id));
create policy employee_schedule_dates_manager_insert on public.employee_schedule_dates
  for insert to authenticated with check (public.is_company_manager(company_id));
create policy employee_schedule_dates_manager_update on public.employee_schedule_dates
  for update to authenticated using (public.is_company_manager(company_id)) with check (public.is_company_manager(company_id));
create policy employee_schedule_dates_manager_delete on public.employee_schedule_dates
  for delete to authenticated using (public.is_company_manager(company_id));
grant select, insert, update, delete on public.employee_schedule_dates to authenticated;
revoke all on public.employee_schedule_dates from anon;
create or replace function public.delete_employee_registration(p_employee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile public.manager_profiles;
begin
  select profile.* into v_profile from public.manager_profiles profile
  where profile.user_id = auth.uid() and profile.deleted_at is null;
  if not found then raise exception 'Gestor não autorizado'; end if;

  if not exists (
    select 1 from public.employees employee
    where employee.id = p_employee_id and employee.company_id = v_profile.company_id and employee.deleted_at is null
  ) then raise exception 'Colaborador não encontrado'; end if;

  update public.employees set is_active = false, deleted_at = now()
  where id = p_employee_id and company_id = v_profile.company_id;
  update public.employee_codes set is_active = false
  where employee_id = p_employee_id and company_id = v_profile.company_id;
end;
$$;
revoke all on function public.delete_employee_registration(uuid) from public, anon;
grant execute on function public.delete_employee_registration(uuid) to authenticated;
commit;
