begin;
alter table public.employee_schedules drop constraint if exists schedule_cycle_anchor;
comment on column public.employee_schedules.cycle_weeks is '1 = toda semana; 2 = somente datas explícitas em employee_schedule_dates. cycle_anchor_date permanece apenas para compatibilidade histórica.';
commit;
