-- Recovery and correction commands for the manual courtside core. These retain
-- the append-only session-event trail while keeping all state transitions atomic.

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
  if not exists (
    select 1
    from public.session_operator_leases
    where id = p_lease_id and session_id = p_session_id and revoked_at is null
  ) then
    raise exception 'Valid operator lease required';
  end if;

  if exists (select 1 from public.session_obligations where session_id = p_session_id) then
    raise exception 'A session with confirmed fees cannot be reopened';
  end if;

  if not exists (
    select 1 from public.sessions where id = p_session_id and status = 'CLOSED' and fee_per_person is null
  ) then
    raise exception 'Only a closed session before fee confirmation can be reopened';
  end if;

  update public.sessions
  set status = 'LIVE', closed_at = null
  where id = p_session_id;

  for v_participant in
    select id, status
    from public.session_participants
    where session_id = p_session_id
    for update
  loop
    select period.status
    into v_previous_status
    from public.participant_status_periods period
    where period.session_participant_id = v_participant.id
    order by period.started_at desc, period.id desc
    limit 1;

    update public.session_participants
    set status = coalesce(v_previous_status, 'READY'::public.participant_status),
        ready_since = case when v_previous_status = 'READY' then now() else null end,
        left_at = case when v_previous_status = 'LEFT' then left_at else null end,
        updated_at = now()
    where id = v_participant.id;

    insert into public.participant_status_periods(session_participant_id, status)
    values (v_participant.id, coalesce(v_previous_status, 'READY'::public.participant_status));
  end loop;

  perform public.append_session_event(p_session_id, 'SESSION_REOPENED', 'session', p_session_id, p_lease_id);
end;
$$;

create or replace function public.suggest_session_fee(p_session_id uuid, p_lease_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
begin
  if not exists (
    select 1
    from public.session_operator_leases
    where id = p_lease_id and session_id = p_session_id and revoked_at is null
  ) then
    raise exception 'Valid operator lease required';
  end if;

  select club_id into v_club_id from public.sessions where id = p_session_id;

  return (
    select fee_per_person
    from public.sessions
    where club_id = v_club_id
      and id <> p_session_id
      and status = 'CLOSED'
      and fee_per_person is not null
    order by closed_at desc
    limit 1
  );
end;
$$;

create or replace function public.correct_completed_set(
  p_session_id uuid,
  p_lease_id uuid,
  p_set_number smallint,
  p_team_a_score smallint,
  p_team_b_score smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set_id uuid;
begin
  if not public.valid_operator_lease(p_session_id, p_lease_id) then
    raise exception 'Valid operator lease required';
  end if;

  if p_set_number not in (1, 2)
    or p_team_a_score < 0
    or p_team_b_score < 0
    or p_team_a_score = p_team_b_score
    or greatest(p_team_a_score, p_team_b_score) > 99 then
    raise exception 'Enter valid, non-tied set scores';
  end if;

  select sets.id
  into v_set_id
  from public.sets
  join public.matches on matches.id = sets.match_id
  where matches.session_id = p_session_id
    and matches.status = 'IN_PROGRESS'
    and sets.set_number = p_set_number
    and sets.status = 'COMPLETED'
  for update of sets;

  if v_set_id is null then
    raise exception 'Only a completed set in the active match can be corrected';
  end if;

  update public.sets
  set team_a_score = p_team_a_score,
      team_b_score = p_team_b_score
  where id = v_set_id;

  perform public.append_session_event(
    p_session_id,
    'SET_SCORE_CORRECTED',
    'set',
    v_set_id,
    p_lease_id,
    jsonb_build_object('set', p_set_number, 'a', p_team_a_score, 'b', p_team_b_score)
  );
end;
$$;

create or replace function public.change_participant_status(
  p_session_id uuid,
  p_lease_id uuid,
  p_participant_id uuid,
  p_status public.participant_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.valid_operator_lease(p_session_id, p_lease_id) then
    raise exception 'Valid operator lease required';
  end if;
  if p_status = 'PLAYING' then
    raise exception 'PLAYING is controlled only by match commands';
  end if;

  update public.session_participants
  set status = p_status,
      ready_since = case when p_status = 'READY' then now() else null end,
      left_at = case when p_status = 'LEFT' then now() else null end,
      updated_at = now()
  where id = p_participant_id and session_id = p_session_id;

  if not found then
    raise exception 'Participant not found';
  end if;

  update public.participant_status_periods
  set ended_at = now()
  where session_participant_id = p_participant_id and ended_at is null;
  insert into public.participant_status_periods(session_participant_id, status)
  values (p_participant_id, p_status);
  perform public.append_session_event(
    p_session_id,
    'PLAYER_STATUS_CHANGED',
    'session_participant',
    p_participant_id,
    p_lease_id,
    jsonb_build_object('status', p_status)
  );
end;
$$;

grant execute on function public.reopen_session(uuid, uuid),
  public.suggest_session_fee(uuid, uuid),
  public.correct_completed_set(uuid, uuid, smallint, smallint, smallint)
to anon, authenticated;

notify pgrst, 'reload schema';
