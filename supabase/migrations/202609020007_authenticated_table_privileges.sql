begin;
grant select, update on public.companies to authenticated;
grant select on public.manager_profiles to authenticated;
grant select, insert, update on public.employees to authenticated;
grant select on public.employee_codes to authenticated;
grant select on public.employee_schedules to authenticated;
grant select on public.time_entries to authenticated;
grant select on public.time_entry_adjustments to authenticated;
grant select, insert, update on public.employee_occurrences to authenticated;
grant select, insert, update on public.hour_bank_adjustments to authenticated;
grant select on public.photo_deletion_logs to authenticated;
grant select, insert, update on public.system_settings to authenticated;
grant select, insert, update on public.work_locations to authenticated;
grant select, insert, update on public.employee_vacations to authenticated;
grant select, insert, update on public.company_holidays to authenticated;
revoke delete, truncate, references, trigger on
  public.companies,
  public.manager_profiles,
  public.employees,
  public.employee_codes,
  public.employee_schedules,
  public.time_entries,
  public.time_entry_adjustments,
  public.employee_occurrences,
  public.hour_bank_adjustments,
  public.photo_deletion_logs,
  public.system_settings,
  public.work_locations,
  public.employee_vacations,
  public.company_holidays
from authenticated;
commit;
