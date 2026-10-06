-- Algorithm 2 V1 rating era. Ratings remain existing skill priors, while the
-- legacy 0.35/0.7 confidence scale is explicitly replaced by V1 sigma units.
-- Rating calculations are deliberately NOT implemented here: trusted server
-- code uses src/lib/domain/rating, and this migration only guards/commits its
-- optimistic-concurrency checked transition atomically.

alter table public.player_ratings
  add column algorithm_version text,
  add column revision bigint not null default 0;

alter table public.sets
  add column rating_algorithm_version text;

update public.player_ratings
set uncertainty = 280,
    algorithm_version = 'trueskill-style-bounded-margin-v1',
    updated_at = now()
where algorithm_version is null;

alter table public.player_ratings
  alter column algorithm_version set not null,
  alter column algorithm_version set default 'trueskill-style-bounded-margin-v1',
  add constraint player_ratings_sigma_bounds check (uncertainty between 45 and 350),
  add constraint player_ratings_algorithm_version_check
    check (algorithm_version = 'trueskill-style-bounded-margin-v1');

insert into public.player_rating_history(
  player_id, source, rating_before, rating_after,
  uncertainty_before, uncertainty_after, algorithm_version
)
select player_id, 'INITIALIZATION', rating, rating, uncertainty, uncertainty, algorithm_version
from public.player_ratings pr
where not exists (
  select 1 from public.player_rating_history h
  where h.player_id = pr.player_id
    and h.source = 'INITIALIZATION'
    and h.algorithm_version = pr.algorithm_version
);

create unique index player_rating_one_set_result_per_version
on public.player_rating_history(player_id, set_id, algorithm_version)
where source = 'SET_RESULT';

create index player_rating_history_algorithm_set_idx
on public.player_rating_history(algorithm_version, set_id)
where source = 'SET_RESULT';

-- New player initialization is a single auditable operation, callable only by
-- other trusted SECURITY DEFINER commands.
create or replace function public.initialize_algorithm_2_rating(p_player_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.player_ratings(player_id, rating, uncertainty, algorithm_version)
  values (p_player_id, 1200, 280, 'trueskill-style-bounded-margin-v1');
  insert into public.player_rating_history(
    player_id, source, rating_before, rating_after,
    uncertainty_before, uncertainty_after, algorithm_version
  ) values (p_player_id, 'INITIALIZATION', 1200, 1200, 280, 280,
    'trueskill-style-bounded-margin-v1');
end;
$$;

-- Final current player creation definitions. Guest/member identity is retained;
-- both receive the same selected-model prior and initialization anchor.
create or replace function public.add_roster_player(
  p_club_id uuid, p_name text, p_membership public.membership_type default 'MEMBER'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
  if auth.uid() is null or not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if length(trim(p_name)) < 1 then raise exception 'Player name is required'; end if;
  insert into public.players(club_id, display_name, membership_type)
  values (p_club_id, trim(p_name), p_membership) returning id into v_player;
  perform public.initialize_algorithm_2_rating(v_player);
  return v_player;
end;
$$;

create or replace function public.add_guest_and_check_in(
  p_session_id uuid, p_lease_id uuid, p_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_player uuid; v_participant uuid;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  if length(trim(p_name)) < 1 then raise exception 'Guest name is required'; end if;
  select club_id into v_club from public.sessions where id = p_session_id;
  insert into public.players(club_id, display_name, membership_type)
  values (v_club, trim(p_name), 'GUEST') returning id into v_player;
  perform public.initialize_algorithm_2_rating(v_player);
  insert into public.session_participants(session_id, player_id, status, ready_since)
  values (p_session_id, v_player, 'READY', now()) returning id into v_participant;
  insert into public.participant_status_periods(session_participant_id, status)
  values (v_participant, 'READY');
  perform public.append_session_event(p_session_id, 'GUEST_CHECKED_IN', 'session_participant', v_participant, p_lease_id);
  return v_player;
end;
$$;

-- p_expected is an array of {player_id, revision, rating, uncertainty};
-- p_transitions is an array of {player_id, rating_before, rating_after,
-- uncertainty_before, uncertainty_after}. This function intentionally has no
-- browser grant: only the trusted server may submit a canonical TS transition.
create or replace function public.commit_algorithm_2_completed_set(
  p_session_id uuid,
  p_team_a_score smallint,
  p_team_b_score smallint,
  p_expected jsonb,
  p_transitions jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_match uuid; v_set public.sets%rowtype; v_next_set uuid; v_player record;
  v_expected_count integer; v_transition_count integer;
begin
  if p_team_a_score < 0 or p_team_b_score < 0 or p_team_a_score = p_team_b_score
     or greatest(p_team_a_score, p_team_b_score) > 99 then
    raise exception 'Enter valid, non-tied set scores';
  end if;
  select m.id into v_match from public.matches m
  where m.session_id = p_session_id and m.status = 'IN_PROGRESS' for update;
  if v_match is null then raise exception 'No match is in progress'; end if;
  select * into v_set from public.sets
  where match_id = v_match and status = 'IN_PROGRESS' for update;
  if v_set.id is null then raise exception 'No set is in progress'; end if;
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
  -- Lock rating rows in a stable order before checking the snapshot.
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
  if v_set.set_number = 1 then
    insert into public.sets(match_id, set_number, status, started_at)
    values(v_match, 2, 'IN_PROGRESS', now()) returning id into v_next_set;
    insert into public.set_players(set_id, player_id, team)
    select v_next_set, player_id, team from public.set_players where set_id = v_set.id;
    perform public.append_session_event(p_session_id, 'SET_COMPLETED', 'set', v_set.id, null,
      jsonb_build_object('set', 1, 'a', p_team_a_score, 'b', p_team_b_score));
    return 'SET_2';
  end if;
  update public.matches set status = 'COMPLETED', completed_at = now() where id = v_match;
  for v_player in select id, leave_after_match from public.session_participants
    where session_id = p_session_id and status = 'PLAYING' loop
    update public.session_participants set status = case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end,
      ready_since = case when v_player.leave_after_match then null else now() end,
      left_at = case when v_player.leave_after_match then now() else left_at end, updated_at = now()
    where id = v_player.id;
    update public.participant_status_periods set ended_at = now()
    where session_participant_id = v_player.id and ended_at is null;
    insert into public.participant_status_periods(session_participant_id, status)
    values(v_player.id, case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end);
  end loop;
  perform public.append_session_event(p_session_id, 'MATCH_COMPLETED', 'match', v_match, null,
    jsonb_build_object('set', 2, 'a', p_team_a_score, 'b', p_team_b_score));
  return 'MATCH_COMPLETED';
end;
$$;

-- Corrections replace the entire V1 result projection. The trusted server has
-- recomputed it from immutable initialization anchors and V1-marked sets.
create or replace function public.commit_algorithm_2_replay(
  p_club_id uuid, p_corrected_set_id uuid, p_team_a_score smallint, p_team_b_score smallint,
  p_expected_revisions jsonb, p_transitions jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare v_set record; v_expected_count integer;
begin
  if p_team_a_score < 0 or p_team_b_score < 0 or p_team_a_score = p_team_b_score
     or greatest(p_team_a_score, p_team_b_score) > 99 then raise exception 'Enter valid, non-tied set scores'; end if;
  perform pg_advisory_xact_lock(hashtextextended('algorithm-2-rating:' || p_club_id::text, 0));
  select s.id, m.session_id into v_set from public.sets s join public.matches m on m.id=s.match_id
  join public.sessions session_row on session_row.id=m.session_id
  where s.id=p_corrected_set_id and session_row.club_id=p_club_id
    and s.status='COMPLETED' and s.rating_algorithm_version='trueskill-style-bounded-margin-v1'
  for update of s;
  if v_set.id is null then raise exception 'Only a V1-rated completed set can be corrected'; end if;
  perform 1 from public.player_ratings pr join public.players p on p.id=pr.player_id
  where p.club_id=p_club_id order by pr.player_id for update;
  select count(*) into v_expected_count from jsonb_array_elements(p_expected_revisions);
  if v_expected_count <> (select count(*) from public.player_ratings pr join public.players p on p.id=pr.player_id where p.club_id=p_club_id)
    or exists (select 1 from public.player_ratings pr join public.players p on p.id=pr.player_id
      left join lateral (select (item->>'player_id')::uuid player_id,(item->>'revision')::bigint revision from jsonb_array_elements(p_expected_revisions) item where (item->>'player_id')::uuid=pr.player_id) e on true
      where p.club_id=p_club_id and (e.player_id is null or e.revision<>pr.revision)) then
    raise exception 'Rating timeline changed; reload and recompute';
  end if;
  update public.sets set team_a_score=p_team_a_score, team_b_score=p_team_b_score where id=p_corrected_set_id;
  delete from public.player_rating_history where source='SET_RESULT' and algorithm_version='trueskill-style-bounded-margin-v1'
    and set_id in (select s.id from public.sets s join public.matches m on m.id=s.match_id join public.sessions se on se.id=m.session_id where se.club_id=p_club_id and s.rating_algorithm_version='trueskill-style-bounded-margin-v1');
  insert into public.player_rating_history(player_id,set_id,source,rating_before,rating_after,uncertainty_before,uncertainty_after,algorithm_version)
  select (item->>'player_id')::uuid,(item->>'set_id')::uuid,'SET_RESULT',(item->>'rating_before')::numeric,(item->>'rating_after')::numeric,(item->>'uncertainty_before')::numeric,(item->>'uncertainty_after')::numeric,'trueskill-style-bounded-margin-v1'
  from jsonb_array_elements(p_transitions) item;
  update public.player_ratings pr set rating=(item->>'rating_after')::numeric, uncertainty=(item->>'uncertainty_after')::numeric, revision=pr.revision+1, updated_at=now()
  from jsonb_array_elements(p_transitions) item where pr.player_id=(item->>'player_id')::uuid and (item->>'is_current')::boolean;
  perform public.append_session_event(v_set.session_id,'SET_SCORE_CORRECTED','set',p_corrected_set_id,null,jsonb_build_object('a',p_team_a_score,'b',p_team_b_score,'ratingReplay',true));
end;
$$;

revoke execute on function public.initialize_algorithm_2_rating(uuid),
  public.commit_algorithm_2_completed_set(uuid,smallint,smallint,jsonb,jsonb),
  public.commit_algorithm_2_replay(uuid,uuid,smallint,smallint,jsonb,jsonb)
from public, anon, authenticated;
-- These legacy public commands would complete/correct a set without V1 rating
-- persistence, so remove their browser path when the trusted endpoint ships.
revoke execute on function public.complete_set(uuid,uuid,smallint,smallint),
  public.correct_completed_set(uuid,uuid,smallint,smallint,smallint)
from public, anon, authenticated;
grant execute on function public.commit_algorithm_2_completed_set(uuid,smallint,smallint,jsonb,jsonb),
  public.commit_algorithm_2_replay(uuid,uuid,smallint,smallint,jsonb,jsonb)
to service_role;

-- Expose a set identifier in the already-public active-match projection so the
-- browser can express correction intent. It is never a rating snapshot.
create or replace view public.live_active_match as
select m.id,m.session_id,m.sequence_number,m.status,
  coalesce(jsonb_agg(jsonb_build_object('id',s.id,'setNumber',s.set_number,'status',s.status,'teamAScore',s.team_a_score,'teamBScore',s.team_b_score,'players',(select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'team',sp.team)) from public.set_players sp join public.players p on p.id=sp.player_id where sp.set_id=s.id)) order by s.set_number) filter (where s.id is not null),'[]'::jsonb) as sets
from public.matches m left join public.sets s on s.match_id=m.id
where m.status='IN_PROGRESS' group by m.id;
grant select on public.live_active_match to anon, authenticated;
notify pgrst, 'reload schema';
