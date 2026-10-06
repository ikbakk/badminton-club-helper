create or replace function public.save_pairing_recommendation(
  p_match_id uuid,
  p_recommended_team_a uuid[],
  p_recommended_team_b uuid[],
  p_diagnostics jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_club_id uuid;
  v_actual_ids uuid[];
  v_recommended_ids uuid[] := p_recommended_team_a || p_recommended_team_b;
  v_recommendation_id uuid;
begin
  select se.club_id into v_club_id
  from public.matches m join public.sessions se on se.id = m.session_id
  where m.id = p_match_id;
  if v_club_id is null or auth.uid() is null or not public.is_club_admin(v_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if cardinality(p_recommended_team_a) <> 2 or cardinality(p_recommended_team_b) <> 2
     or cardinality(array(select distinct unnest(v_recommended_ids))) <> 4
     or jsonb_typeof(p_diagnostics) <> 'object'
     or p_diagnostics->>'selected_algorithm' <> 'trueskill-style-bounded-margin-v1'
     or jsonb_typeof(p_diagnostics->'pairings') <> 'array'
     or jsonb_array_length(p_diagnostics->'pairings') <> 3 then
    raise exception 'Pairing recommendation must contain three legal options and diagnostics';
  end if;
  select array_agg(sp.player_id order by sp.player_id) into v_actual_ids
  from public.matches m join public.sets st on st.match_id=m.id and st.set_number=1
  join public.set_players sp on sp.set_id=st.id where m.id=p_match_id;
  if v_actual_ids is distinct from (select array_agg(id order by id) from unnest(v_recommended_ids) as chosen(id)) then
    raise exception 'Recommendation must use exactly the four actual match players';
  end if;
  insert into public.pairing_recommendations(match_id,algorithm_version,diagnostics)
  values(p_match_id,'trueskill-style-bounded-margin-v1',p_diagnostics)
  returning id into v_recommendation_id;
  insert into public.pairing_recommendation_players(
    recommendation_id,player_id,recommended_team,rating_snapshot,uncertainty_snapshot
  )
  select v_recommendation_id,pr.player_id,
    case when pr.player_id=any(p_recommended_team_a) then 'A' else 'B' end,
    pr.rating,pr.uncertainty
  from public.player_ratings pr where pr.player_id=any(v_recommended_ids);
  return v_recommendation_id;
end;
$$;
revoke execute on function public.save_pairing_recommendation(uuid,uuid[],uuid[],jsonb) from public, anon;
grant execute on function public.save_pairing_recommendation(uuid,uuid[],uuid[],jsonb) to authenticated;
