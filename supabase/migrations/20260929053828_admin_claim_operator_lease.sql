create or replace function public.claim_admin_operator_lease(
  p_session_id uuid,
  p_device_id text,
  p_takeover boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_old_lease_id uuid;
  v_new_lease_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in as a Club Admin to operate this session';
  end if;

  select club_id into v_club_id
  from public.sessions
  where id = p_session_id and status = 'LIVE'
  for update;
  if v_club_id is null or not public.is_club_admin(v_club_id) then
    raise exception 'Club Admin authority is required for PIN-free operation';
  end if;
  if length(trim(p_device_id)) = 0 then
    raise exception 'Device ID is required';
  end if;

  select id into v_old_lease_id
  from public.session_operator_leases
  where session_id = p_session_id and revoked_at is null
  for update;

  if v_old_lease_id is not null and not p_takeover then
    raise exception 'Another device currently controls this session';
  end if;

  if v_old_lease_id is not null then
    update public.session_operator_leases set revoked_at = now() where id = v_old_lease_id;
  end if;

  insert into public.session_operator_leases(session_id, device_id)
  values (p_session_id, trim(p_device_id))
  returning id into v_new_lease_id;

  perform public.append_session_event(
    p_session_id,
    case when v_old_lease_id is null then 'OPERATOR_LEASE_CLAIMED' else 'OPERATOR_LEASE_TAKEN_OVER' end,
    null,
    null,
    v_new_lease_id,
    jsonb_build_object('method', 'CLUB_ADMIN_AUTH')
  );

  return v_new_lease_id;
end;
$$;

revoke execute on function public.claim_admin_operator_lease(uuid, text, boolean) from public, anon;
grant execute on function public.claim_admin_operator_lease(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
