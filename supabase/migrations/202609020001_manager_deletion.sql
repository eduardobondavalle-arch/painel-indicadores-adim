-- Exclusão administrativa de gestoras com preservação opcional do histórico.

alter table public.responses
  drop constraint if exists responses_manager_id_fkey;

alter table public.responses
  alter column manager_id drop not null;

alter table public.responses
  add constraint responses_manager_id_fkey
  foreign key (manager_id) references public.managers(id) on delete set null;

create or replace function public.delete_manager(
  p_manager_id uuid,
  p_delete_data boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager public.managers%rowtype;
  v_response_ids uuid[] := '{}'::uuid[];
  v_response_count integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  select * into v_manager
  from public.managers
  where id = p_manager_id
  for update;

  if not found then
    raise exception 'Gestora não encontrada';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]), count(*)::integer
  into v_response_ids, v_response_count
  from public.responses
  where manager_id = p_manager_id;

  if p_delete_data and v_response_count > 0 then
    update public.responses
    set replaced_response_id = null
    where replaced_response_id = any(v_response_ids);

    delete from public.change_history
    where response_id = any(v_response_ids);

    delete from public.consistency_alerts
    where response_id = any(v_response_ids);

    delete from public.response_values
    where response_id = any(v_response_ids);

    delete from public.responses
    where id = any(v_response_ids);
  end if;

  delete from public.managers
  where id = p_manager_id;

  insert into public.admin_logs(admin_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when p_delete_data then 'manager.deleted_with_data' else 'manager.deleted_registration' end,
    'manager',
    p_manager_id::text,
    jsonb_build_object(
      'deleted_responses', case when p_delete_data then v_response_count else 0 end,
      'preserved_responses', case when p_delete_data then 0 else v_response_count end
    )
  );

  return jsonb_build_object(
    'deleted_responses', case when p_delete_data then v_response_count else 0 end,
    'preserved_responses', case when p_delete_data then 0 else v_response_count end
  );
end;
$$;

revoke all on function public.delete_manager(uuid, boolean) from public;
grant execute on function public.delete_manager(uuid, boolean) to authenticated;
