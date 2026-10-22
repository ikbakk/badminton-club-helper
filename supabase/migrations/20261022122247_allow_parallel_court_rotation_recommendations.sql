-- Recommendations for a free court may be prepared while other courts are active.
-- start_match validates the chosen READY players under the session lock.

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

