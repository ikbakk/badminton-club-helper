create or replace function public.start_match(
  p_session_id uuid,
  p_lease_id uuid,
  p_team_a uuid[],
  p_team_b uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match uuid;
  v_sequence integer;
  v_player uuid;
begin
  if not public.valid_operator_lease(p_session_id, p_lease_id) then
    raise exception 'Valid operator lease required';
  end if;

  if cardinality(p_team_a) <> 2
     or cardinality(p_team_b) <> 2
     or cardinality(array(select distinct unnest(p_team_a || p_team_b))) <> 4 then
    raise exception 'Choose exactly four distinct players in two teams';
  end if;

  if exists (
    select 1
    from public.matches
    where session_id = p_session_id and status = 'IN_PROGRESS'
  ) then
    raise exception 'A match is already in progress';
  end if;

  if exists (
    select 1
    from unnest(p_team_a || p_team_b) as selected_players(player_id)
    where not exists (
      select 1
      from public.session_participants as participant
      where participant.session_id = p_session_id
        and participant.player_id = selected_players.player_id
        and participant.status = 'READY'
    )
  ) then
    raise exception 'Every selected player must be READY';
  end if;

  select coalesce(max(sequence_number), 0) + 1
  into v_sequence
  from public.matches
  where session_id = p_session_id;

  insert into public.matches(session_id, sequence_number, status, started_at)
  values (p_session_id, v_sequence, 'IN_PROGRESS', now())
  returning id into v_match;

  insert into public.sets(match_id, set_number, status, started_at)
  values (v_match, 1, 'IN_PROGRESS', now());

  insert into public.set_players(set_id, player_id, team)
  select set_row.id, selected_players.player_id, 'A'
  from public.sets as set_row
  cross join unnest(p_team_a) as selected_players(player_id)
  where set_row.match_id = v_match and set_row.set_number = 1
  union all
  select set_row.id, selected_players.player_id, 'B'
  from public.sets as set_row
  cross join unnest(p_team_b) as selected_players(player_id)
  where set_row.match_id = v_match and set_row.set_number = 1;

  foreach v_player in array p_team_a || p_team_b loop
    update public.session_participants
    set status = 'PLAYING', ready_since = null, updated_at = now()
    where session_id = p_session_id and player_id = v_player;

    update public.participant_status_periods
    set ended_at = now()
    where session_participant_id = (
      select participant.id
      from public.session_participants as participant
      where participant.session_id = p_session_id and participant.player_id = v_player
    ) and ended_at is null;

    insert into public.participant_status_periods(session_participant_id, status)
    select participant.id, 'PLAYING'
    from public.session_participants as participant
    where participant.session_id = p_session_id and participant.player_id = v_player;
  end loop;

  perform public.append_session_event(
    p_session_id,
    'MATCH_STARTED',
    'match',
    v_match,
    p_lease_id,
    jsonb_build_object('sequence', v_sequence)
  );

  return v_match;
end;
$$;

notify pgrst, 'reload schema';
