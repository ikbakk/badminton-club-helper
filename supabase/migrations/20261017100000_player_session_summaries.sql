-- Public-safe results from actual completed-set lineups. No rating policy change.
create or replace function public.public_player_session_summaries(p_club_id uuid, p_player_id uuid)
returns table(session_id uuid, started_at timestamptz, closed_at timestamptz,
 sets integer, wins integer, losses integer, partners text[], rating_change numeric)
language sql stable security definer set search_path = '' as $$
 with member as (
  select p.id from public.players p
  where p.id=p_player_id and p.club_id=p_club_id and p.is_active and p.membership_type='MEMBER'
 ), recent as (
  select distinct s.id,s.started_at,s.closed_at
  from public.sessions s join public.session_participants attendance on attendance.session_id=s.id
  join member on member.id=attendance.player_id
  where s.club_id=p_club_id order by s.started_at desc,s.id limit 6
 ), player_sets as (
  select r.id as session_id, st.id, st.team_a_score,st.team_b_score,lineup.team
  from recent r join public.matches m on m.session_id=r.id
  join public.sets st on st.match_id=m.id and st.status='COMPLETED'
  join public.set_players lineup on lineup.set_id=st.id and lineup.player_id=p_player_id
 )
 select r.id,r.started_at,r.closed_at,count(ps.id)::integer,
  count(ps.id) filter(where (ps.team='A' and ps.team_a_score>ps.team_b_score) or (ps.team='B' and ps.team_b_score>ps.team_a_score))::integer,
  count(ps.id) filter(where (ps.team='A' and ps.team_a_score<ps.team_b_score) or (ps.team='B' and ps.team_b_score<ps.team_a_score))::integer,
  array(select distinct partner.display_name from player_sets played
   join public.set_players teammate on teammate.set_id=played.id and teammate.team=played.team and teammate.player_id<>p_player_id
   join public.players partner on partner.id=teammate.player_id and partner.club_id=p_club_id
   where played.session_id=r.id order by partner.display_name),
  case when count(ps.id)>0 and count(h.set_id)=count(ps.id)
   then sum(h.rating_after-h.rating_before) else null end
 from recent r left join player_sets ps on ps.session_id=r.id
 left join public.player_rating_history h on h.set_id=ps.id and h.player_id=p_player_id
  and h.source='SET_RESULT' and h.algorithm_version='trueskill-style-bounded-margin-v1'
 group by r.id,r.started_at,r.closed_at order by r.started_at desc,r.id;
$$;
revoke all on function public.public_player_session_summaries(uuid,uuid) from public;
grant execute on function public.public_player_session_summaries(uuid,uuid) to anon,authenticated;
notify pgrst, 'reload schema';
