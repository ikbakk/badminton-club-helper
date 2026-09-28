-- A narrow operator command; the client never mutates participant rows directly.
create or replace function public.set_leave_after_match(
  p_session_id uuid,
  p_lease_id uuid,
  p_participant_id uuid,
  p_leave_after_match boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.valid_operator_lease(p_session_id, p_lease_id) then
    raise exception 'Valid operator lease required';
  end if;

  update public.session_participants
  set leave_after_match = p_leave_after_match,
      updated_at = now()
  where id = p_participant_id
    and session_id = p_session_id
    and status in ('READY', 'PLAYING');

  if not found then
    raise exception 'Only READY or PLAYING participants can be marked to leave after a match';
  end if;

  perform public.append_session_event(
    p_session_id,
    'LEAVE_AFTER_MATCH_CHANGED',
    'session_participant',
    p_participant_id,
    p_lease_id,
    jsonb_build_object('enabled', p_leave_after_match)
  );
end;
$$;

grant execute on function public.set_leave_after_match(uuid, uuid, uuid, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
