-- Session operation now requires an authenticated Club Admin. Legacy lease IDs
-- remain nullable command parameters for schema compatibility and audit history,
-- but no longer grant authority.
create or replace function public.valid_operator_lease(p_session_id uuid, p_lease_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in with a Club Admin account to manage the live session';
  end if;
  if not exists (
    select 1 from public.sessions s
    where s.id = p_session_id and s.status = 'LIVE'
      and public.is_club_admin(s.club_id)
  ) then
    raise exception 'Club Admin authority is required for this live session';
  end if;
  return true;
end;
$$;

revoke execute on function public.valid_operator_lease(uuid, uuid) from public, anon;
grant execute on function public.valid_operator_lease(uuid, uuid) to authenticated;

-- Remove the PIN-taking start command and all stored session PIN credentials.
drop function public.start_session(uuid, text);
create function public.start_session(p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if auth.uid() is null or not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  insert into public.sessions(club_id, created_by_user_id)
  values (p_club_id, auth.uid())
  returning id into v_session;
  perform public.append_session_event(v_session, 'SESSION_STARTED');
  return v_session;
end;
$$;

drop table if exists public.session_operator_credentials;
revoke execute on function public.claim_operator_lease(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.claim_admin_operator_lease(uuid, text, boolean) from public, anon, authenticated;

-- Closed-session commands still require the Club Admin who owns the session.
create or replace function public.reopen_session(p_session_id uuid, p_lease_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant record;
  v_previous_status public.participant_status;
begin
  if auth.uid() is null or not exists (
    select 1 from public.sessions s
    where s.id = p_session_id and public.is_club_admin(s.club_id)
  ) then
    raise exception 'Club Admin authority is required';
  end if;
  if exists (select 1 from public.session_obligations where session_id = p_session_id) then
    raise exception 'A session with confirmed fees cannot be reopened';
  end if;
  if not exists (
    select 1 from public.sessions
    where id = p_session_id and status = 'CLOSED' and fee_per_person is null
  ) then
    raise exception 'Only a closed session before fee confirmation can be reopened';
  end if;
  update public.sessions set status = 'LIVE', closed_at = null where id = p_session_id;
  for v_participant in
    select id, status from public.session_participants where session_id = p_session_id for update
  loop
    select period.status into v_previous_status
    from public.participant_status_periods period
    where period.session_participant_id = v_participant.id
    order by period.started_at desc, period.id desc limit 1;
    update public.session_participants
    set status = coalesce(v_previous_status, 'READY'::public.participant_status),
        ready_since = case when v_previous_status = 'READY' then now() else null end,
        left_at = case when v_previous_status = 'LEFT' then left_at else null end,
        updated_at = now()
    where id = v_participant.id;
    insert into public.participant_status_periods(session_participant_id, status)
    values (v_participant.id, coalesce(v_previous_status, 'READY'::public.participant_status));
  end loop;
  perform public.append_session_event(p_session_id, 'SESSION_REOPENED', 'session', p_session_id);
end;
$$;

create or replace function public.suggest_session_fee(p_session_id uuid, p_lease_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from public.sessions
  where id = p_session_id and public.is_club_admin(club_id);
  if auth.uid() is null or v_club_id is null then
    raise exception 'Club Admin authority is required';
  end if;
  return (
    select fee_per_person from public.sessions
    where club_id = v_club_id and id <> p_session_id
      and status = 'CLOSED' and fee_per_person is not null
    order by closed_at desc limit 1
  );
end;
$$;

create or replace function public.confirm_session_fee(
  p_session_id uuid, p_lease_id uuid, p_fee integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.sessions s where s.id = p_session_id and public.is_club_admin(s.club_id)
  ) then
    raise exception 'Club Admin authority is required';
  end if;
  if p_fee <= 0 then raise exception 'Fee must be greater than zero'; end if;
  update public.sessions
  set fee_per_person = p_fee
  where id = p_session_id and status = 'CLOSED' and fee_per_person is null;
  if not found then raise exception 'Session fee is already confirmed or session is not closed'; end if;
  insert into public.session_obligations(session_id, player_id, amount)
  select p_session_id, player_id, p_fee
  from public.session_participants where session_id = p_session_id;
  get diagnostics v_count = row_count;
  perform public.append_session_event(
    p_session_id, 'SESSION_FEE_CONFIRMED', 'session', p_session_id, null,
    jsonb_build_object('fee', p_fee, 'attendees', v_count)
  );
  return v_count;
end;
$$;

create or replace function public.submit_session_finance(
  p_session_id uuid,
  p_lease_id uuid,
  p_reported_court_cost integer default null,
  p_reported_shuttlecock_cost integer default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_submission_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.sessions s where s.id = p_session_id and public.is_club_admin(s.club_id)
  ) then
    raise exception 'Club Admin authority is required';
  end if;
  if p_reported_court_cost is not null and p_reported_court_cost <= 0 then
    raise exception 'Court cost must be greater than zero';
  end if;
  if p_reported_shuttlecock_cost is not null and p_reported_shuttlecock_cost <= 0 then
    raise exception 'Shuttlecock cost must be greater than zero';
  end if;
  if p_reported_court_cost is null and p_reported_shuttlecock_cost is null
      and nullif(trim(p_notes), '') is null then
    raise exception 'Enter a reported cost or a note';
  end if;
  if not exists (select 1 from public.sessions where id = p_session_id and status = 'CLOSED') then
    raise exception 'Close the session before submitting finance details';
  end if;
  insert into public.finance_submissions(
    session_id, reported_court_cost, reported_shuttlecock_cost, notes,
    submitted_by_operator_lease_id
  ) values (
    p_session_id, p_reported_court_cost, p_reported_shuttlecock_cost,
    nullif(trim(p_notes), ''), null
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$$;

-- Keep the legacy RPC argument shape, but allow only authenticated Club Admins.
revoke execute on function public.start_session(uuid),
  public.check_in_player(uuid, uuid, uuid),
  public.change_participant_status(uuid, uuid, uuid, public.participant_status),
  public.add_guest_and_check_in(uuid, uuid, text),
  public.start_match(uuid, uuid, uuid[], uuid[]),
  public.complete_set(uuid, uuid, smallint, smallint),
  public.substitute_player(uuid, uuid, uuid, uuid, public.participant_status),
  public.abandon_match(uuid, uuid),
  public.close_session(uuid, uuid),
  public.confirm_session_fee(uuid, uuid, integer),
  public.reopen_session(uuid, uuid),
  public.suggest_session_fee(uuid, uuid),
  public.correct_completed_set(uuid, uuid, smallint, smallint, smallint),
  public.set_leave_after_match(uuid, uuid, uuid, boolean),
  public.submit_session_finance(uuid, uuid, integer, integer, text),
  public.append_session_event(uuid, text, text, uuid, uuid, jsonb)
from public, anon;

grant execute on function public.start_session(uuid),
  public.check_in_player(uuid, uuid, uuid),
  public.change_participant_status(uuid, uuid, uuid, public.participant_status),
  public.add_guest_and_check_in(uuid, uuid, text),
  public.start_match(uuid, uuid, uuid[], uuid[]),
  public.complete_set(uuid, uuid, smallint, smallint),
  public.substitute_player(uuid, uuid, uuid, uuid, public.participant_status),
  public.abandon_match(uuid, uuid),
  public.close_session(uuid, uuid),
  public.confirm_session_fee(uuid, uuid, integer),
  public.reopen_session(uuid, uuid),
  public.suggest_session_fee(uuid, uuid),
  public.correct_completed_set(uuid, uuid, smallint, smallint, smallint),
  public.set_leave_after_match(uuid, uuid, uuid, boolean),
  public.submit_session_finance(uuid, uuid, integer, integer, text)
to authenticated;

-- History projections need a fresh fee value immediately after confirmation.
create or replace view public.public_session_history as
select s.id, s.started_at, s.closed_at, s.fee_per_person,
  count(sp.id)::integer as attendance
from public.sessions s
left join public.session_participants sp on sp.session_id = s.id
group by s.id;

notify pgrst, 'reload schema';
