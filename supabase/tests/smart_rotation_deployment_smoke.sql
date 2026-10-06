-- Run against an explicitly selected Supabase project with:
--   npx supabase db query --linked --file supabase/tests/smart_rotation_deployment_smoke.sql
-- Every fixture row is created inside a transaction and rolled back at the end.
-- Requires one existing Club Admin and no existing LIVE session for that club.

begin;

create temporary table smart_rotation_smoke_result(session_id uuid) on commit drop;

do $smoke$
declare
  v_club_id uuid;
  v_admin_id uuid;
  v_session_id uuid := gen_random_uuid();
  v_players uuid[];
  v_ready uuid[];
  v_recommended uuid[];
  v_ranked jsonb;
  v_recommendation_id uuid;
  v_state jsonb;
  v_participant_id uuid;
  v_count integer;
  v_round integer;
  v_started_at timestamptz;
begin
  select c.id, r.user_id into v_club_id, v_admin_id
  from public.clubs c
  join public.club_roles r on r.club_id = c.id and r.role = 'CLUB_ADMIN'
  order by c.created_at
  limit 1;
  if v_club_id is null or v_admin_id is null then
    raise exception 'Smoke test requires an existing club and Club Admin';
  end if;
  if exists (select 1 from public.sessions where club_id = v_club_id and status = 'LIVE') then
    raise exception 'Smoke test refuses to overlap a LIVE session';
  end if;

  select array_agg(gen_random_uuid() order by n) into v_players
  from generate_series(1, 6) n;
  insert into public.players(id, club_id, display_name, membership_type)
  select player_id, v_club_id, 'ROTATION-SMOKE-' || ordinal::text, 'MEMBER'
  from unnest(v_players) with ordinality as p(player_id, ordinal);
  insert into public.sessions(id, club_id, status, started_at, created_by_user_id)
  values (v_session_id, v_club_id, 'LIVE', now() - interval '60 minutes', v_admin_id);
  insert into public.session_participants(session_id, player_id, status, ready_since)
  select v_session_id, player_id, 'READY', now() - interval '60 minutes'
  from unnest(v_players) as p(player_id);
  insert into public.participant_status_periods(session_participant_id, status, started_at)
  select sp.id, 'READY', now() - interval '60 minutes'
  from public.session_participants sp
  where sp.session_id = v_session_id;

  -- RPC authorization derives from the authenticated JWT subject, not fixture IDs.
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_id, 'role', 'authenticated')::text,
    true
  );

  if has_table_privilege('anon', 'public.session_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.session_events', 'INSERT') then
    raise exception 'Direct browser INSERT into session_events must remain revoked';
  end if;
  if has_function_privilege('anon', 'public.save_rotation_recommendation(uuid,uuid[],jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.start_match(uuid,uuid,uuid[],uuid[],uuid)', 'EXECUTE') then
    raise exception 'Anonymous role must not execute protected rotation commands';
  end if;

  -- A non-admin can read no fairness state and cannot persist a recommendation.
  v_admin_id := gen_random_uuid();
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_id, 'role', 'authenticated')::text,
    true
  );
  v_state := public.get_rotation_fairness_state(v_session_id);
  if v_state <> '[]'::jsonb then raise exception 'Non-admin unexpectedly read fairness state'; end if;
  begin
    perform public.save_rotation_recommendation(v_session_id, v_players[1:4], '[]'::jsonb);
    raise exception 'NON_ADMIN_RECOMMENDATION_WRITE_ALLOWED';
  exception when others then
    if sqlerrm = 'NON_ADMIN_RECOMMENDATION_WRITE_ALLOWED' then raise; end if;
  end;
  select r.user_id into v_admin_id from public.club_roles r
  where r.club_id=v_club_id and r.role='CLUB_ADMIN' order by r.user_id limit 1;
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_id, 'role', 'authenticated')::text,
    true
  );

  -- Round 1: six READY, accept A-D, and verify E/F get one missed opportunity.
  v_recommended := v_players[1:4];
  select jsonb_agg(jsonb_build_object(
    'player_id', p.player_id,
    'rank', p.ordinality,
    'priority_score', 100 - p.ordinality,
    'recommended', p.player_id = any(v_recommended),
    'diagnostics', jsonb_build_object('tier', case when p.ordinality > 4 then 'NORMAL' else 'SHOULD_PLAY' end,
      'reasons', jsonb_build_array('database smoke fixture'),
      'metrics', jsonb_build_object('currentOpportunityDebt', 999))
  ) order by p.ordinality)
  into v_ranked
  from unnest(v_players) with ordinality as p(player_id, ordinality);
  v_recommendation_id := public.save_rotation_recommendation(v_session_id, v_recommended, v_ranked);
  v_state := public.get_rotation_fairness_state(v_session_id);
  if exists (
    select 1 from jsonb_array_elements(v_state) candidate
    where candidate->>'player_id' = v_players[5]::text
      and (candidate->>'current_opportunity_debt')::integer <> 0
  ) then raise exception 'Browser-supplied diagnostics became authoritative'; end if;

  -- Force a late status-transition failure after match rows and ROTATION_STARTED
  -- have been written inside the RPC. The failed call must leave none of them.
  execute format($ddl$
    create function pg_temp.fail_rotation_smoke_transition()
    returns trigger language plpgsql as $fn$
    begin
      if new.session_id = %L::uuid and new.player_id = %L::uuid then
        raise exception 'SMOKE_FORCED_STATUS_FAILURE';
      end if;
      return new;
    end
    $fn$
  $ddl$, v_session_id, v_players[1]);
  execute 'create trigger fail_rotation_smoke_transition before update on public.session_participants '
       || 'for each row execute function pg_temp.fail_rotation_smoke_transition()';
  begin
    perform public.start_match(v_session_id, null, v_players[1:2], v_players[3:4], v_recommendation_id);
    raise exception 'FAILED_MATCH_START_WAS_NOT_ROLLED_BACK';
  exception when others then
    if sqlerrm = 'FAILED_MATCH_START_WAS_NOT_ROLLED_BACK' then raise; end if;
    if sqlerrm <> 'SMOKE_FORCED_STATUS_FAILURE' then raise; end if;
  end;
  execute 'drop trigger fail_rotation_smoke_transition on public.session_participants';
  if exists (select 1 from public.matches where session_id=v_session_id)
     or exists (select 1 from public.sets s join public.matches m on m.id=s.match_id where m.session_id=v_session_id)
     or exists (select 1 from public.session_events where session_id=v_session_id and event_type='ROTATION_STARTED')
     or exists (select 1 from public.session_participants where session_id=v_session_id and status<>'READY') then
    raise exception 'Failed match start left partial match, event, or participant state';
  end if;

  perform public.start_match(v_session_id, null, v_players[1:2], v_players[3:4], v_recommendation_id);
  select count(*) into v_count from public.session_events e
  where e.session_id = v_session_id and e.event_type = 'ROTATION_STARTED'
    and e.metadata->'ready_player_ids' @> jsonb_build_array(v_players[6]::text)
    and e.metadata->'selected_player_ids' @> jsonb_build_array(v_players[4]::text)
    and not (e.metadata->'selected_player_ids' @> jsonb_build_array(v_players[6]::text));
  if v_count <> 1 then raise exception 'First ROTATION_STARTED snapshot is missing or incorrect'; end if;
  if (select status from public.session_participants where session_id=v_session_id and player_id=v_players[6]) <> 'READY'
     or (select count(*) from public.session_participants where session_id=v_session_id and status='PLAYING') <> 4 then
    raise exception 'First selected/status transition is inconsistent';
  end if;
  v_state := public.get_rotation_fairness_state(v_session_id);
  if (select (candidate->>'current_opportunity_debt')::integer from jsonb_array_elements(v_state) candidate
      where candidate->>'player_id'=v_players[6]::text) <> 1 then
    raise exception 'Skipped READY player did not receive debt 1';
  end if;

  -- Complete both sets through the existing transaction-safe command.
  perform public.complete_set(v_session_id, null::uuid, 21::smallint, 17::smallint);
  perform public.complete_set(v_session_id, null::uuid, 21::smallint, 18::smallint);
  if (select count(*) from public.matches where session_id=v_session_id and status='COMPLETED') <> 1 then
    raise exception 'Normal match completion did not persist';
  end if;

  -- Round 2 recommendation still sees the previous facts. Override D with E.
  select array_agg(player_id order by player_id) into v_ready
  from public.session_participants where session_id=v_session_id and status='READY';
  v_recommended := v_players[1:4];
  select jsonb_agg(jsonb_build_object('player_id', p.player_id, 'rank', p.ordinality,
    'priority_score', 100-p.ordinality, 'recommended', p.player_id=any(v_recommended),
    'diagnostics', jsonb_build_object('tier','NORMAL','reasons',jsonb_build_array('smoke')))
    order by p.ordinality) into v_ranked
  from unnest(v_ready) with ordinality as p(player_id, ordinality);
  v_recommendation_id := public.save_rotation_recommendation(v_session_id, v_recommended, v_ranked);
  v_state := public.get_rotation_fairness_state(v_session_id);
  if (select (candidate->>'current_opportunity_debt')::integer from jsonb_array_elements(v_state) candidate
      where candidate->>'player_id'=v_players[6]::text) <> 1 then
    raise exception 'Refresh/reconstruction lost previous missed opportunity';
  end if;
  perform public.start_match(v_session_id, null, v_players[1:2], array[v_players[3],v_players[5]], v_recommendation_id);
  select count(*) into v_count from public.session_events e
  where e.session_id=v_session_id and e.event_type='ROTATION_STARTED'
    and e.metadata->'selected_player_ids' @> jsonb_build_array(v_players[5]::text)
    and not (e.metadata->'selected_player_ids' @> jsonb_build_array(v_players[4]::text));
  if v_count <> 1 then raise exception 'Admin override actual four was not persisted'; end if;
  perform public.complete_set(v_session_id, null::uuid, 21::smallint, 16::smallint);
  perform public.complete_set(v_session_id, null::uuid, 21::smallint, 19::smallint);
  v_state := public.get_rotation_fairness_state(v_session_id);
  if (select (candidate->>'current_opportunity_debt')::integer from jsonb_array_elements(v_state) candidate
      where candidate->>'player_id'=v_players[6]::text) <> 2 then
    raise exception 'Second skipped opportunity did not advance debt to 2';
  end if;

  -- E rests for rounds 3-4: excluded from eligible opportunity snapshots.
  select id into v_participant_id from public.session_participants
  where session_id=v_session_id and player_id=v_players[5];
  perform public.change_participant_status(v_session_id, null, v_participant_id, 'RESTING');
  v_started_at := now();
  for v_round in 3..4 loop
    select array_agg(player_id order by player_id) into v_ready
    from public.session_participants where session_id=v_session_id and status='READY';
    v_recommended := v_players[1:4];
    select jsonb_agg(jsonb_build_object('player_id', p.player_id, 'rank', p.ordinality,
      'priority_score', 100-p.ordinality, 'recommended', p.player_id=any(v_recommended),
      'diagnostics', jsonb_build_object('tier','NORMAL','reasons',jsonb_build_array('smoke')))
      order by p.ordinality) into v_ranked
    from unnest(v_ready) with ordinality as p(player_id, ordinality);
    v_recommendation_id := public.save_rotation_recommendation(v_session_id, v_recommended, v_ranked);
    perform public.start_match(v_session_id, null, v_players[1:2], v_players[3:4], v_recommendation_id);
    v_state := public.get_rotation_fairness_state(v_session_id);
    if (select (candidate->>'eligible_opportunities')::integer from jsonb_array_elements(v_state) candidate
        where candidate->>'player_id'=v_players[5]::text) <> 2 then
      raise exception 'RESTING player accrued a fake eligible opportunity';
    end if;
    perform public.complete_set(v_session_id, null::uuid, 21::smallint, 15::smallint);
    perform public.complete_set(v_session_id, null::uuid, 21::smallint, 14::smallint);
    v_state := public.get_rotation_fairness_state(v_session_id);
    if (select (candidate->>'current_opportunity_debt')::integer from jsonb_array_elements(v_state) candidate
        where candidate->>'player_id'=v_players[6]::text) <> v_round then
      raise exception 'Repeated skipped opportunities did not increment debt to %', v_round;
    end if;
  end loop;
  select id into v_participant_id from public.session_participants
  where session_id=v_session_id and player_id=v_players[5];
  perform public.change_participant_status(v_session_id, null, v_participant_id, 'READY');
  if (select ready_since from public.session_participants where id=v_participant_id) < v_started_at then
    raise exception 'READY re-entry did not restart the READY clock';
  end if;

  -- After four consecutive skips, F has debt 4; selecting F clears only current debt.
  v_state := public.get_rotation_fairness_state(v_session_id);
  if (select (candidate->>'current_opportunity_debt')::integer from jsonb_array_elements(v_state) candidate
      where candidate->>'player_id'=v_players[6]::text) <> 4 then
    raise exception 'Repeated skipped player did not reach current debt 4';
  end if;
  select array_agg(player_id order by player_id) into v_ready
  from public.session_participants where session_id=v_session_id and status='READY';
  v_recommended := array[v_players[1],v_players[2],v_players[3],v_players[6]];
  select jsonb_agg(jsonb_build_object('player_id', p.player_id, 'rank', p.ordinality,
    'priority_score', 100-p.ordinality, 'recommended', p.player_id=any(v_recommended),
    'diagnostics', jsonb_build_object('tier', case when p.player_id=v_players[6] then 'SHOULD_PLAY' else 'NORMAL' end,
      'reasons', jsonb_build_array('debt threshold reached')))
    order by p.ordinality) into v_ranked
  from unnest(v_ready) with ordinality as p(player_id, ordinality);
  v_recommendation_id := public.save_rotation_recommendation(v_session_id, v_recommended, v_ranked);
  perform public.start_match(v_session_id, null, v_players[1:2], array[v_players[3],v_players[6]], v_recommendation_id);
  v_state := public.get_rotation_fairness_state(v_session_id);
  if (select (candidate->>'current_opportunity_debt')::integer from jsonb_array_elements(v_state) candidate
      where candidate->>'player_id'=v_players[6]::text) <> 0
     or (select (candidate->>'missed_opportunities')::integer from jsonb_array_elements(v_state) candidate
      where candidate->>'player_id'=v_players[6]::text) <> 4 then
    raise exception 'Selection must reset current debt but preserve historical missed facts';
  end if;

  -- Candidate snapshot survives reconstruction and points to actual match selections.
  if (select count(*) from public.rotation_recommendations where session_id=v_session_id) <> 5
     or (select count(*) from public.rotation_candidate_scores cs join public.rotation_recommendations rr
         on rr.id=cs.recommendation_id where rr.session_id=v_session_id) <> 28
     or (select count(*) from public.matches m join public.rotation_recommendations rr
         on rr.id=m.rotation_recommendation_id where m.session_id=v_session_id) <> 5
     or (select count(*) from public.session_events where session_id=v_session_id and event_type='ROTATION_STARTED') <> 5 then
    raise exception 'Recommendation, match-link, or event history did not reconstruct';
  end if;

  insert into smart_rotation_smoke_result(session_id) values (v_session_id);

  raise notice 'SMART_ROTATION_SMOKE_PASS session=% rounds=5 actual_override=true debt4_reset=true resting_excluded=true', v_session_id;
end;
$smoke$;

-- This evidence is emitted before rollback. It includes the actual DB rows and the
-- fairness state reconstructed from trusted event history, without retaining fixtures.
select
  s.id as smoke_session_id,
  (select count(*) from public.matches m where m.session_id=s.id) as matches,
  (select count(*) from public.rotation_recommendations r where r.session_id=s.id) as recommendations,
  (select count(*) from public.session_events e where e.session_id=s.id and e.event_type='ROTATION_STARTED') as rotation_snapshots,
  public.get_rotation_fairness_state(s.id) as reconstructed_fairness_state
from public.sessions s
join smart_rotation_smoke_result smoke on smoke.session_id=s.id;

rollback;
