begin;
alter table public.companies add column if not exists legal_name text;
alter table public.companies add column if not exists tax_id text;
alter table public.companies add column if not exists employer_address text;
commit;
