-- Keep public rating read-only and narrowly scoped to one active club player.
create or replace function public.public_player_rating(p_player_id uuid)
returns table(rating numeric, uncertainty numeric, algorithm_version text)
language sql stable security definer set search_path = '' as $$
  select pr.rating, pr.uncertainty, pr.algorithm_version
  from public.player_ratings pr
  join public.players p on p.id = pr.player_id
  where p.id = p_player_id and p.is_active and p.membership_type = 'MEMBER';
$$;
revoke all on function public.public_player_rating(uuid) from public;
grant execute on function public.public_player_rating(uuid) to anon, authenticated;

-- Persist the pairing as advisory audit after start_match has created its match
-- id. Actual set_players remain owned by start_match and are never modified here.
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
     or jsonb_typeof(p_diagnostics) <> 'object' then
    raise exception 'Pairing recommendation must contain two legal teams and diagnostics';
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
notify pgrst, 'reload schema';
