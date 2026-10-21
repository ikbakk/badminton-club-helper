-- Session-scoped courts and optional deciding sets. Existing sessions/matches
-- remain on court one; existing one-court behavior stays the default.
alter table public.sessions
  add column court_count integer not null default 1
  check (court_count > 0);

alter table public.matches
  add column court_number integer not null default 1
  check (court_number > 0);

drop index if exists public.one_active_match_per_session;
create unique index one_active_match_per_court
  on public.matches(session_id, court_number)
  where status = 'IN_PROGRESS';

alter table public.sets drop constraint if exists sets_set_number_check;
alter table public.sets add constraint sets_set_number_check check (set_number between 1 and 3);

create or replace function public.validate_session_court_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.court_count < 1 then raise exception 'At least one court is required'; end if;
  if tg_op = 'UPDATE' and old.status = 'LIVE' and new.court_count <> old.court_count then
    raise exception 'Court count cannot change after a session has started';
  end if;
  return new;
end;
$$;
create trigger validate_session_court_count_before_write
  before insert or update of court_count on public.sessions
  for each row execute function public.validate_session_court_count();

create or replace function public.validate_match_court_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_court_count integer;
begin
  select court_count into v_court_count from public.sessions where id = new.session_id;
  if v_court_count is null or new.court_number < 1 or new.court_number > v_court_count then
    raise exception 'Court number must be between 1 and the session court count';
  end if;
  return new;
end;
$$;
create trigger validate_match_court_number_before_write
  before insert or update of session_id, court_number on public.matches
  for each row execute function public.validate_match_court_number();

-- Session creation captures the number of physical courts for this session.
drop function if exists public.start_session(uuid);
create function public.start_session(p_club_id uuid, p_court_count integer default 1)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session uuid;
begin
  if auth.uid() is null or not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if p_court_count is null or p_court_count < 1 then
    raise exception 'At least one court is required';
  end if;
  insert into public.sessions(club_id, created_by_user_id, court_count)
  values (p_club_id, auth.uid(), p_court_count)
  returning id into v_session;
  perform public.append_session_event(v_session, 'SESSION_STARTED', 'session', v_session, null,
    jsonb_build_object('court_count', p_court_count));
  return v_session;
end;
$$;
revoke execute on function public.start_session(uuid, integer) from public, anon;
grant execute on function public.start_session(uuid, integer) to authenticated;

-- The session row lock serializes starts across courts. Each later start sees
-- the updated READY pool and records its own actual opportunity snapshot.
drop function if exists public.start_match(uuid, uuid, uuid[], uuid[], uuid);
drop function if exists public.start_match(uuid, uuid, uuid[], uuid[]);
create function public.start_match(
  p_session_id uuid,
  p_lease_id uuid,
  p_team_a uuid[],
  p_team_b uuid[],
  p_rotation_recommendation_id uuid,
  p_court_number integer default 1
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_match uuid;
  v_sequence integer;
  v_ready_ids uuid[];
  v_selected_ids uuid[] := p_team_a || p_team_b;
  v_player uuid;
  v_court_count integer;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  select court_count into v_court_count from public.sessions
  where id = p_session_id and status = 'LIVE' for update;
  if v_court_count is null then raise exception 'Live session not found'; end if;
  if p_court_number is null or p_court_number < 1 or p_court_number > v_court_count then
    raise exception 'Court number must be between 1 and the session court count';
  end if;
  if cardinality(p_team_a) <> 2 or cardinality(p_team_b) <> 2
     or cardinality(array(select distinct unnest(v_selected_ids))) <> 4 then
    raise exception 'Choose exactly four distinct players in two teams';
  end if;
  if exists (select 1 from public.matches
    where session_id = p_session_id and court_number = p_court_number and status = 'IN_PROGRESS') then
    raise exception 'This court already has an active match';
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
  insert into public.matches(session_id, sequence_number, status, started_at,
    rotation_recommendation_id, court_number)
  values (p_session_id, v_sequence, 'IN_PROGRESS', now(), p_rotation_recommendation_id, p_court_number)
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

  perform public.append_session_event(p_session_id, 'ROTATION_STARTED', 'match', v_match, p_lease_id,
    jsonb_build_object('sequence', v_sequence, 'court_number', p_court_number,
      'ready_player_ids', to_jsonb(v_ready_ids), 'selected_player_ids', to_jsonb(v_selected_ids),
      'rotation_recommendation_id', p_rotation_recommendation_id));
  perform public.append_session_event(p_session_id, 'MATCH_STARTED', 'match', v_match, p_lease_id,
    jsonb_build_object('sequence', v_sequence, 'court_number', p_court_number));

  foreach v_player in array v_selected_ids loop
    update public.session_participants set status = 'PLAYING', ready_since = null, updated_at = now()
    where session_id = p_session_id and player_id = v_player;
    update public.participant_status_periods set ended_at = now()
    where session_participant_id = (select sp.id from public.session_participants sp
      where sp.session_id = p_session_id and sp.player_id = v_player) and ended_at is null;
    insert into public.participant_status_periods(session_participant_id, status)
    select sp.id, 'PLAYING' from public.session_participants sp
    where sp.session_id = p_session_id and sp.player_id = v_player;
  end loop;
  return v_match;
end;
$$;
revoke execute on function public.start_match(uuid, uuid, uuid[], uuid[], uuid, integer) from public, anon;
grant execute on function public.start_match(uuid, uuid, uuid[], uuid[], uuid, integer) to authenticated;

-- Existing callers may omit match_id only while exactly one match is active.
-- Multi-court clients always send it, so substitution cannot hit another court.
drop function if exists public.substitute_player(uuid, uuid, uuid, uuid, public.participant_status);
create function public.substitute_player(
  p_session_id uuid, p_lease_id uuid, p_outgoing_player_id uuid,
  p_replacement_player_id uuid,
  p_outgoing_status public.participant_status default 'RESTING',
  p_match_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_match uuid;
  v_set uuid;
  v_set_number smallint;
  v_active_count integer;
  v_out public.session_participants%rowtype;
  v_in public.session_participants%rowtype;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  if p_outgoing_status not in ('RESTING', 'OUT', 'LEFT') then
    raise exception 'Choose RESTING, OUT, or LEFT for the outgoing player';
  end if;
  if p_outgoing_player_id = p_replacement_player_id then
    raise exception 'Outgoing and replacement players must differ';
  end if;
  if p_match_id is null then
    select count(*) into v_active_count from public.matches
    where session_id = p_session_id and status = 'IN_PROGRESS';
    if v_active_count <> 1 then raise exception 'Match id is required when multiple courts are active'; end if;
    select id into v_match from public.matches
    where session_id = p_session_id and status = 'IN_PROGRESS' for update;
  else
    select id into v_match from public.matches
    where id = p_match_id and session_id = p_session_id and status = 'IN_PROGRESS' for update;
  end if;
  if v_match is null then raise exception 'Match is not in progress'; end if;
  select s.id, s.set_number into v_set, v_set_number from public.sets s
  where s.match_id = v_match and s.status = 'IN_PROGRESS'
    and s.set_number in (2, 3)
    and exists (select 1 from public.sets prior
      where prior.match_id = v_match and prior.set_number = s.set_number - 1 and prior.status = 'COMPLETED')
  for update;
  if v_set is null then raise exception 'Substitution is available only between completed sets'; end if;
  select * into v_out from public.session_participants
  where session_id = p_session_id and player_id = p_outgoing_player_id and status = 'PLAYING' for update;
  select * into v_in from public.session_participants
  where session_id = p_session_id and player_id = p_replacement_player_id and status = 'READY' for update;
  if v_out.id is null or v_in.id is null
     or not exists (select 1 from public.set_players where set_id = v_set and player_id = p_outgoing_player_id)
     or exists (select 1 from public.set_players where set_id = v_set and player_id = p_replacement_player_id) then
    raise exception 'Choose a playing player and a READY replacement';
  end if;
  update public.set_players set player_id = p_replacement_player_id
  where set_id = v_set and player_id = p_outgoing_player_id;
  update public.session_participants set status = p_outgoing_status, ready_since = null,
    left_at = case when p_outgoing_status = 'LEFT' then now() else left_at end, updated_at = now()
  where id = v_out.id;
  update public.session_participants set status = 'PLAYING', ready_since = null, updated_at = now()
  where id = v_in.id;
  update public.participant_status_periods set ended_at = now()
  where session_participant_id in (v_out.id, v_in.id) and ended_at is null;
  insert into public.participant_status_periods(session_participant_id, status)
  values (v_out.id, p_outgoing_status), (v_in.id, 'PLAYING');
  perform public.append_session_event(p_session_id, 'PLAYER_SUBSTITUTED', 'match', v_match, null,
    jsonb_build_object('outgoing', p_outgoing_player_id, 'replacement', p_replacement_player_id,
      'set_number', v_set_number));
end;
$$;
revoke execute on function public.substitute_player(uuid, uuid, uuid, uuid, public.participant_status, uuid) from public, anon;
grant execute on function public.substitute_player(uuid, uuid, uuid, uuid, public.participant_status, uuid) to authenticated;

create or replace function public.release_match_players(p_session_id uuid, p_match_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_player record;
begin
  for v_player in
    select distinct sp.id, sp.leave_after_match
    from public.session_participants sp
    join public.set_players lineup on lineup.player_id = sp.player_id
    join public.sets latest_set on latest_set.id = lineup.set_id and latest_set.match_id = p_match_id
    where sp.session_id = p_session_id and sp.status = 'PLAYING'
      and latest_set.set_number = (select max(last_set.set_number) from public.sets last_set where last_set.match_id = p_match_id)
  loop
    update public.session_participants set
      status = case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end,
      ready_since = case when v_player.leave_after_match then null else now() end,
      left_at = case when v_player.leave_after_match then now() else left_at end,
      updated_at = now()
    where id = v_player.id;
    update public.participant_status_periods set ended_at = now()
    where session_participant_id = v_player.id and ended_at is null;
    insert into public.participant_status_periods(session_participant_id, status)
    values (v_player.id, case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end);
  end loop;
end;
$$;
revoke execute on function public.release_match_players(uuid, uuid) from public, anon, authenticated;

drop function if exists public.abandon_match(uuid, uuid);
create function public.abandon_match(
  p_session_id uuid, p_lease_id uuid, p_match_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_match uuid; v_active_count integer;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  if p_match_id is null then
    select count(*) into v_active_count from public.matches where session_id = p_session_id and status = 'IN_PROGRESS';
    if v_active_count <> 1 then raise exception 'Match id is required when multiple courts are active'; end if;
    select id into v_match from public.matches where session_id = p_session_id and status = 'IN_PROGRESS' for update;
  else
    select id into v_match from public.matches where id = p_match_id and session_id = p_session_id and status = 'IN_PROGRESS' for update;
  end if;
  if v_match is null then raise exception 'Match is not in progress'; end if;
  update public.matches set status = 'ABANDONED', completed_at = now() where id = v_match;
  update public.sets set status = 'ABANDONED', completed_at = now()
  where match_id = v_match and status = 'IN_PROGRESS';
  perform public.release_match_players(p_session_id, v_match);
  perform public.append_session_event(p_session_id, 'MATCH_ABANDONED', 'match', v_match, p_lease_id);
end;
$$;
revoke execute on function public.abandon_match(uuid, uuid, uuid) from public, anon;
grant execute on function public.abandon_match(uuid, uuid, uuid) to authenticated;

create function public.start_decider_set(p_session_id uuid, p_match_id uuid, p_lease_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_next_set uuid; v_match public.matches%rowtype; v_set_count integer; v_a_wins integer; v_b_wins integer;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  select * into v_match from public.matches where id = p_match_id and session_id = p_session_id and status = 'IN_PROGRESS' for update;
  if v_match.id is null then raise exception 'Match is not awaiting a deciding set'; end if;
  select count(*), count(*) filter (where team_a_score > team_b_score), count(*) filter (where team_b_score > team_a_score)
  into v_set_count, v_a_wins, v_b_wins
  from public.sets where match_id = p_match_id and status = 'COMPLETED';
  if v_set_count <> 2 or v_a_wins <> 1 or v_b_wins <> 1
     or exists (select 1 from public.sets where match_id = p_match_id and set_number = 3) then
    raise exception 'A deciding set is available only after a 1–1 score';
  end if;
  insert into public.sets(match_id, set_number, status, started_at)
  values (p_match_id, 3, 'IN_PROGRESS', now()) returning id into v_next_set;
  insert into public.set_players(set_id, player_id, team)
  select v_next_set, player_id, team from public.set_players
  where set_id = (select id from public.sets where match_id = p_match_id and set_number = 2);
  perform public.append_session_event(p_session_id, 'DECIDER_SET_STARTED', 'match', p_match_id, p_lease_id,
    jsonb_build_object('set', 3, 'court_number', v_match.court_number));
  return v_next_set;
end;
$$;
revoke execute on function public.start_decider_set(uuid, uuid, uuid) from public, anon;
grant execute on function public.start_decider_set(uuid, uuid, uuid) to authenticated;

create function public.finish_tied_match(p_session_id uuid, p_match_id uuid, p_lease_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_set_count integer; v_a_wins integer; v_b_wins integer;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  select * into v_match from public.matches where id = p_match_id and session_id = p_session_id and status = 'IN_PROGRESS' for update;
  if v_match.id is null then raise exception 'Match is not awaiting a 1–1 decision'; end if;
  select count(*), count(*) filter (where team_a_score > team_b_score), count(*) filter (where team_b_score > team_a_score)
  into v_set_count, v_a_wins, v_b_wins
  from public.sets where match_id = p_match_id and status = 'COMPLETED';
  if v_set_count <> 2 or v_a_wins <> 1 or v_b_wins <> 1
     or exists (select 1 from public.sets where match_id = p_match_id and set_number = 3) then
    raise exception 'Only a match tied 1–1 can be ended without a deciding set';
  end if;
  update public.matches set status = 'COMPLETED', completed_at = now() where id = p_match_id;
  perform public.release_match_players(p_session_id, p_match_id);
  perform public.append_session_event(p_session_id, 'MATCH_COMPLETED', 'match', p_match_id, p_lease_id,
    jsonb_build_object('sets', 2, 'score', '1–1', 'court_number', v_match.court_number));
end;
$$;
revoke execute on function public.finish_tied_match(uuid, uuid, uuid) from public, anon;
grant execute on function public.finish_tied_match(uuid, uuid, uuid) to authenticated;

-- Score commits target the exact set selected by the caller. Multiple courts
-- can save independently, while ratings remain transactionally authoritative.
drop function if exists public.commit_algorithm_2_completed_set(uuid, smallint, smallint, jsonb, jsonb);
create function public.commit_algorithm_2_completed_set(
  p_session_id uuid,
  p_set_id uuid,
  p_team_a_score smallint,
  p_team_b_score smallint,
  p_expected jsonb,
  p_transitions jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_match uuid;
  v_set public.sets%rowtype;
  v_next_set uuid;
  v_expected_count integer;
  v_transition_count integer;
  v_set_count integer;
  v_a_wins integer;
  v_b_wins integer;
begin
  if p_team_a_score < 0 or p_team_b_score < 0 or p_team_a_score = p_team_b_score
     or greatest(p_team_a_score, p_team_b_score) > 99 then
    raise exception 'Enter valid, non-tied set scores';
  end if;
  select m.id into v_match
  from public.sets s join public.matches m on m.id = s.match_id
  where s.id = p_set_id and m.session_id = p_session_id
    and m.status = 'IN_PROGRESS' and s.status = 'IN_PROGRESS'
  for update of m, s;
  if v_match is not null then
    select * into v_set from public.sets where id = p_set_id for update;
  end if;
  if v_set.id is null then raise exception 'Selected set is no longer in progress'; end if;
  if (select count(*) from public.set_players where set_id = v_set.id) <> 4
     or (select count(*) from public.set_players where set_id = v_set.id and team = 'A') <> 2
     or (select count(*) from public.set_players where set_id = v_set.id and team = 'B') <> 2 then
    raise exception 'A rated completed set requires two actual players per team';
  end if;
  select count(*) into v_expected_count from jsonb_array_elements(p_expected);
  select count(*) into v_transition_count from jsonb_array_elements(p_transitions);
  if v_expected_count <> 4 or v_transition_count <> 4 then
    raise exception 'Exactly four expected states and transitions are required';
  end if;
  perform 1 from public.player_ratings pr
  join public.set_players sp on sp.player_id = pr.player_id
  where sp.set_id = v_set.id order by pr.player_id for update;
  if exists (
    select 1 from public.set_players sp
    left join lateral (
      select (item->>'player_id')::uuid as player_id,
        (item->>'revision')::bigint as revision,
        (item->>'rating')::numeric as rating,
        (item->>'uncertainty')::numeric as uncertainty
      from jsonb_array_elements(p_expected) item
      where (item->>'player_id')::uuid = sp.player_id
    ) expected on true
    join public.player_ratings pr on pr.player_id = sp.player_id
    where sp.set_id = v_set.id and (expected.player_id is null
      or pr.revision <> expected.revision or pr.rating <> expected.rating
      or pr.uncertainty <> expected.uncertainty
      or pr.algorithm_version <> 'trueskill-style-bounded-margin-v1')
  ) then raise exception 'Rating state changed; reload and recompute'; end if;
  if exists (
    select 1 from public.set_players sp
    left join lateral (
      select (item->>'player_id')::uuid as player_id,
        (item->>'rating_before')::numeric as rating_before,
        (item->>'rating_after')::numeric as rating_after,
        (item->>'uncertainty_before')::numeric as uncertainty_before,
        (item->>'uncertainty_after')::numeric as uncertainty_after
      from jsonb_array_elements(p_transitions) item
      where (item->>'player_id')::uuid = sp.player_id
    ) transition on true
    join public.player_ratings pr on pr.player_id = sp.player_id
    where sp.set_id = v_set.id and (transition.player_id is null
      or transition.rating_before <> pr.rating or transition.uncertainty_before <> pr.uncertainty
      or transition.uncertainty_after not between 45 and 350)
  ) then raise exception 'Transition does not match locked rating state'; end if;
  update public.sets set status = 'COMPLETED', team_a_score = p_team_a_score,
    team_b_score = p_team_b_score, completed_at = now(),
    rating_algorithm_version = 'trueskill-style-bounded-margin-v1'
  where id = v_set.id;
  insert into public.player_rating_history(
    player_id, set_id, source, rating_before, rating_after,
    uncertainty_before, uncertainty_after, algorithm_version
  ) select (item->>'player_id')::uuid, v_set.id, 'SET_RESULT',
    (item->>'rating_before')::numeric, (item->>'rating_after')::numeric,
    (item->>'uncertainty_before')::numeric, (item->>'uncertainty_after')::numeric,
    'trueskill-style-bounded-margin-v1'
  from jsonb_array_elements(p_transitions) item;
  update public.player_ratings pr set
    rating = (item->>'rating_after')::numeric,
    uncertainty = (item->>'uncertainty_after')::numeric,
    revision = pr.revision + 1, updated_at = now()
  from jsonb_array_elements(p_transitions) item
  where pr.player_id = (item->>'player_id')::uuid;

  perform public.append_session_event(p_session_id, 'SET_COMPLETED', 'set', v_set.id, null,
    jsonb_build_object('set', v_set.set_number, 'a', p_team_a_score, 'b', p_team_b_score));
  if v_set.set_number = 1 then
    insert into public.sets(match_id, set_number, status, started_at)
    values (v_match, 2, 'IN_PROGRESS', now()) returning id into v_next_set;
    insert into public.set_players(set_id, player_id, team)
    select v_next_set, player_id, team from public.set_players where set_id = v_set.id;
    return 'SET_2';
  end if;
  if v_set.set_number = 2 then
    select count(*), count(*) filter (where team_a_score > team_b_score),
      count(*) filter (where team_b_score > team_a_score)
    into v_set_count, v_a_wins, v_b_wins
    from public.sets where match_id = v_match and status = 'COMPLETED';
    if v_set_count = 2 and v_a_wins = 1 and v_b_wins = 1 then
      return 'DECIDER_REQUIRED';
    end if;
  end if;
  update public.matches set status = 'COMPLETED', completed_at = now() where id = v_match;
  perform public.release_match_players(p_session_id, v_match);
  perform public.append_session_event(p_session_id, 'MATCH_COMPLETED', 'match', v_match, null,
    jsonb_build_object('set', v_set.set_number, 'a', p_team_a_score, 'b', p_team_b_score));
  return 'MATCH_COMPLETED';
end;
$$;
revoke execute on function public.commit_algorithm_2_completed_set(uuid, uuid, smallint, smallint, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_algorithm_2_completed_set(uuid, uuid, smallint, smallint, jsonb, jsonb)
  to service_role;

create or replace view public.live_session as
select id, club_id, status, started_at, closed_at, court_count
from public.sessions where status = 'LIVE';

drop view public.live_active_match;
create view public.live_active_match as
select m.id, m.session_id, m.sequence_number, m.status, m.court_number,
  coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'setNumber', s.set_number, 'status', s.status,
    'teamAScore', s.team_a_score, 'teamBScore', s.team_b_score,
    'players', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'team', sp.team))
      from public.set_players sp join public.players p on p.id = sp.player_id where sp.set_id = s.id))
    order by s.set_number) filter (where s.id is not null), '[]'::jsonb) as sets
from public.matches m left join public.sets s on s.match_id = m.id
where m.status = 'IN_PROGRESS'
group by m.id;

grant select on public.live_active_match to anon, authenticated;

drop function if exists public.public_session_matches(uuid);
create function public.public_session_matches(p_session_id uuid)
returns table(
  id uuid, sequence_number integer, status public.match_status, team_a text[], team_b text[],
  set_one_a smallint, set_one_b smallint, set_two_a smallint, set_two_b smallint,
  court_number integer, sets jsonb
) language sql stable security definer set search_path = '' as $$
  select m.id, m.sequence_number, m.status,
    coalesce(teams.team_a, '{}'::text[]) as team_a,
    coalesce(teams.team_b, '{}'::text[]) as team_b,
    scores.set_one_a, scores.set_one_b, scores.set_two_a, scores.set_two_b,
    m.court_number, coalesce(set_data.sets, '[]'::jsonb) as sets
  from public.matches m
  left join lateral (
    select
      array_agg(distinct p.display_name order by p.display_name) filter (where sp.team = 'A') as team_a,
      array_agg(distinct p.display_name order by p.display_name) filter (where sp.team = 'B') as team_b
    from public.sets s
    join public.set_players sp on sp.set_id = s.id
    join public.players p on p.id = sp.player_id
    where s.match_id = m.id
  ) teams on true
  left join lateral (
    select
      max(team_a_score) filter (where set_number = 1) as set_one_a,
      max(team_b_score) filter (where set_number = 1) as set_one_b,
      max(team_a_score) filter (where set_number = 2) as set_two_a,
      max(team_b_score) filter (where set_number = 2) as set_two_b
    from public.sets where match_id = m.id
  ) scores on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('setNumber', s.set_number,
      'teamAScore', s.team_a_score, 'teamBScore', s.team_b_score,
      'players', (select jsonb_agg(jsonb_build_object('name', player.display_name, 'team', lineup.team)
        order by lineup.team, player.display_name)
        from public.set_players lineup join public.players player on player.id = lineup.player_id
        where lineup.set_id = s.id)) order by s.set_number) as sets
    from public.sets s where s.match_id = m.id
  ) set_data on true
  where m.session_id = p_session_id
    and exists(select 1 from public.sessions where id = p_session_id and status = 'CLOSED')
  order by m.sequence_number;
$$;
revoke all on function public.public_session_matches(uuid) from public;
grant execute on function public.public_session_matches(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
