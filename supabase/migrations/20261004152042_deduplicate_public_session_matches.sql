create or replace function public.public_session_matches(p_session_id uuid)
returns table(
  id uuid,
  sequence_number integer,
  status public.match_status,
  team_a text[],
  team_b text[],
  set_one_a smallint,
  set_one_b smallint,
  set_two_a smallint,
  set_two_b smallint
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.sequence_number, m.status,
    coalesce(array_agg(distinct p.display_name order by p.display_name) filter (where sp.team = 'A'), '{}') as team_a,
    coalesce(array_agg(distinct p.display_name order by p.display_name) filter (where sp.team = 'B'), '{}') as team_b,
    max(s.team_a_score) filter (where s.set_number = 1) as set_one_a,
    max(s.team_b_score) filter (where s.set_number = 1) as set_one_b,
    max(s.team_a_score) filter (where s.set_number = 2) as set_two_a,
    max(s.team_b_score) filter (where s.set_number = 2) as set_two_b
  from public.matches m
  left join public.sets s on s.match_id = m.id
  left join public.set_players sp on sp.set_id = s.id
  left join public.players p on p.id = sp.player_id
  where m.session_id = p_session_id
    and exists(select 1 from public.sessions where id = p_session_id and status = 'CLOSED')
  group by m.id
  order by m.sequence_number;
$$;

notify pgrst, 'reload schema';
