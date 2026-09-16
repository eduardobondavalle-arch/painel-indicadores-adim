begin;
alter table public.manager_profiles add column if not exists work_location_id uuid references public.work_locations(id) on delete restrict;
create index if not exists manager_profiles_work_location on public.manager_profiles(work_location_id) where deleted_at is null;
commit;
