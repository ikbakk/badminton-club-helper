-- Smart Rotation keeps only facts produced by trusted session commands.
-- Recommender snapshots reuse the existing recommendation tables; actual play
-- is linked through matches.rotation_recommendation_id and set_players.

create or replace function public.get_rotation_fairness_state(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_result jsonb;
begin
  select s.club_id into v_club_id
  from public.sessions s
  where s.id = p_session_id and s.status = 'LIVE';

  if v_club_id is null or auth.uid() is null or not public.is_club_admin(v_club_id) then
    return '[]'::jsonb;
  end if;

  with rotations as (
    select
      m.id as match_id,
      m.sequence_number,
      e.metadata->'selected_player_ids' as selected_player_ids,
      e.metadata->'ready_player_ids' as ready_player_ids
    from public.session_events e
    join public.matches m on m.id = e.entity_id and m.session_id = e.session_id
    where e.session_id = p_session_id and e.event_type = 'ROTATION_STARTED'
  ), participant_history as (
    select
      sp.id as participant_id,
      sp.player_id,
      coalesce(count(r.sequence_number) filter (
        where r.ready_player_ids @> jsonb_build_array(sp.player_id::text)
      ), 0)::integer as eligible_opportunities,
      coalesce(count(r.sequence_number) filter (
        where r.ready_player_ids @> jsonb_build_array(sp.player_id::text)
          and not (r.selected_player_ids @> jsonb_build_array(sp.player_id::text))
      ), 0)::integer as missed_opportunities,
      coalesce(count(r.sequence_number) filter (
        where r.ready_player_ids @> jsonb_build_array(sp.player_id::text)
          and not (r.selected_player_ids @> jsonb_build_array(sp.player_id::text))
          and r.sequence_number > coalesce((
            select max(previous.sequence_number)
            from rotations previous
            where previous.selected_player_ids @> jsonb_build_array(sp.player_id::text)
          ), 0)
      ), 0)::integer as current_opportunity_debt,
      coalesce(count(r.sequence_number) filter (
        where r.selected_player_ids @> jsonb_build_array(sp.player_id::text)
      ), 0)::integer as rotations_played,
      coalesce((
        select count(*)
        from public.sets s
        join public.matches m on m.id = s.match_id
        join public.set_players set_player on set_player.set_id = s.id
        where m.session_id = p_session_id
          and set_player.player_id = sp.player_id
          and s.status = 'COMPLETED'
      ), 0)::integer as sets_played,
      coalesce((
        select count(*)
        from rotations recent
        where recent.selected_player_ids @> jsonb_build_array(sp.player_id::text)
          and recent.sequence_number > coalesce((
            select max(not_selected.sequence_number)
            from rotations not_selected
            where not (not_selected.selected_player_ids @> jsonb_build_array(sp.player_id::text))
          ), 0)
      ), 0)::integer as consecutive_rotations
    from public.session_participants sp
    left join rotations r on true
    where sp.session_id = p_session_id
    group by sp.id, sp.player_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'participant_id', h.participant_id,
    'player_id', h.player_id,
    'eligible_opportunities', h.eligible_opportunities,
    'missed_opportunities', h.missed_opportunities,
    'current_opportunity_debt', h.current_opportunity_debt,
    'rotations_played', h.rotations_played,
    'sets_played', h.sets_played,
    'consecutive_rotations', h.consecutive_rotations
  ) order by h.player_id), '[]'::jsonb)
  into v_result
  from participant_history h;

  return v_result;
end;
$$;

create or replace function public.save_rotation_recommendation(
  p_session_id uuid,
  p_recommended_player_ids uuid[],
  p_ranked_candidates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_ready_ids uuid[];
  v_candidate_ids uuid[];
  v_marked_ids uuid[];
  v_recommendation_id uuid;
  v_candidate jsonb;
begin
  select s.club_id into v_club_id
  from public.sessions s
  where s.id = p_session_id and s.status = 'LIVE';
  if v_club_id is null or auth.uid() is null or not public.is_club_admin(v_club_id) then
    raise exception 'Club Admin authority is required for this live session';
  end if;
  if exists (select 1 from public.matches where session_id = p_session_id and status = 'IN_PROGRESS') then
    raise exception 'Cannot prepare a next-match recommendation while a match is active';
  end if;
  if cardinality(p_recommended_player_ids) <> 4
     or cardinality(array(select distinct unnest(p_recommended_player_ids))) <> 4
     or p_ranked_candidates is null or jsonb_typeof(p_ranked_candidates) <> 'array' then
    raise exception 'Recommendation must contain exactly four distinct players and a candidate ranking';
  end if;

  select coalesce(array_agg(sp.player_id order by sp.player_id), '{}'::uuid[])
  into v_ready_ids
  from public.session_participants sp
  where sp.session_id = p_session_id and sp.status = 'READY';
  if cardinality(v_ready_ids) < 4 then raise exception 'At least four READY players are required'; end if;

  select coalesce(array_agg((candidate->>'player_id')::uuid order by (candidate->>'player_id')::uuid), '{}'::uuid[])
  into v_candidate_ids
  from jsonb_array_elements(p_ranked_candidates) candidate;
  select coalesce(array_agg((candidate->>'player_id')::uuid order by (candidate->>'player_id')::uuid), '{}'::uuid[])
  into v_marked_ids
  from jsonb_array_elements(p_ranked_candidates) candidate
  where (candidate->>'recommended')::boolean;

  if v_candidate_ids is distinct from v_ready_ids
     or v_marked_ids is distinct from (
       select array_agg(selected_id order by selected_id)
       from unnest(p_recommended_player_ids) as selected(selected_id)
     ) then
    raise exception 'Recommendation candidate set is stale or inconsistent with READY state';
  end if;

  insert into public.rotation_recommendations(session_id, algorithm_version, diagnostics)
  values (p_session_id, 'smart-rotation-1-current-debt-v1', jsonb_build_object('source', 'live_recommendation'))
  returning id into v_recommendation_id;

  for v_candidate in select value from jsonb_array_elements(p_ranked_candidates)
  loop
    insert into public.rotation_candidate_scores(
      recommendation_id, player_id, rank, priority_score, recommended, diagnostics
    ) values (
      v_recommendation_id,
      (v_candidate->>'player_id')::uuid,
      (v_candidate->>'rank')::integer,
      nullif(v_candidate->>'priority_score', '')::numeric,
      (v_candidate->>'recommended')::boolean,
      v_candidate->'diagnostics'
    );
  end loop;
  return v_recommendation_id;
end;
$$;

drop function public.start_match(uuid, uuid, uuid[], uuid[]);

create function public.start_match(
  p_session_id uuid,
  p_lease_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_rotation_recommendation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match uuid;
  v_sequence integer;
  v_ready_ids uuid[];
  v_selected_ids uuid[] := p_team_a || p_team_b;
  v_player uuid;
begin
  if not public.valid_operator_lease(p_session_id, p_lease_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if cardinality(p_team_a) <> 2 or cardinality(p_team_b) <> 2
     or cardinality(array(select distinct unnest(v_selected_ids))) <> 4 then
    raise exception 'Choose exactly four distinct players in two teams';
  end if;
  if exists (select 1 from public.matches where session_id = p_session_id and status = 'IN_PROGRESS') then
    raise exception 'A match is already in progress';
  end if;
  if exists (
    select 1 from unnest(v_selected_ids) selected(player_id)
    where not exists (
      select 1 from public.session_participants sp
      where sp.session_id = p_session_id and sp.player_id = selected.player_id and sp.status = 'READY'
    )
  ) then raise exception 'Every selected player must be READY'; end if;
  if p_rotation_recommendation_id is not null and not exists (
    select 1 from public.rotation_recommendations recommendation
    where recommendation.id = p_rotation_recommendation_id and recommendation.session_id = p_session_id
  ) then raise exception 'Rotation recommendation does not belong to this session'; end if;

  select coalesce(array_agg(sp.player_id order by sp.player_id), '{}'::uuid[])
  into v_ready_ids
  from public.session_participants sp
  where sp.session_id = p_session_id and sp.status = 'READY';
  if cardinality(v_ready_ids) < 4 then raise exception 'At least four READY players are required'; end if;

  select coalesce(max(sequence_number), 0) + 1 into v_sequence
  from public.matches where session_id = p_session_id;
  insert into public.matches(session_id, sequence_number, status, started_at, rotation_recommendation_id)
  values (p_session_id, v_sequence, 'IN_PROGRESS', now(), p_rotation_recommendation_id)
  returning id into v_match;
  insert into public.sets(match_id, set_number, status, started_at)
  values (v_match, 1, 'IN_PROGRESS', now());
  insert into public.set_players(set_id, player_id, team)
  select s.id, selected.player_id, 'A'
  from public.sets s cross join unnest(p_team_a) selected(player_id)
  where s.match_id = v_match and s.set_number = 1
  union all
  select s.id, selected.player_id, 'B'
  from public.sets s cross join unnest(p_team_b) selected(player_id)
  where s.match_id = v_match and s.set_number = 1;

  perform public.append_session_event(
    p_session_id, 'ROTATION_STARTED', 'match', v_match, p_lease_id,
    jsonb_build_object(
      'sequence', v_sequence,
      'ready_player_ids', to_jsonb(v_ready_ids),
      'selected_player_ids', to_jsonb(v_selected_ids),
      'rotation_recommendation_id', p_rotation_recommendation_id
    )
  );
  perform public.append_session_event(p_session_id, 'MATCH_STARTED', 'match', v_match, p_lease_id,
    jsonb_build_object('sequence', v_sequence));

  foreach v_player in array v_selected_ids loop
    update public.session_participants
    set status = 'PLAYING', ready_since = null, updated_at = now()
    where session_id = p_session_id and player_id = v_player;
    update public.participant_status_periods
    set ended_at = now()
    where session_participant_id = (
      select sp.id from public.session_participants sp
      where sp.session_id = p_session_id and sp.player_id = v_player
    ) and ended_at is null;
    insert into public.participant_status_periods(session_participant_id, status)
    select sp.id, 'PLAYING' from public.session_participants sp
    where sp.session_id = p_session_id and sp.player_id = v_player;
  end loop;
  return v_match;
end;
$$;

revoke execute on function public.get_rotation_fairness_state(uuid),
  public.save_rotation_recommendation(uuid, uuid[], jsonb),
  public.start_match(uuid, uuid, uuid[], uuid[], uuid)
from public, anon;
grant execute on function public.get_rotation_fairness_state(uuid),
  public.save_rotation_recommendation(uuid, uuid[], jsonb),
  public.start_match(uuid, uuid, uuid[], uuid[], uuid)
to authenticated;

notify pgrst, 'reload schema';
