-- Read-only public projections for the non-courtside app surfaces. These expose club
-- activity, never private obligations, payments by person, leases, or admin data.

create or replace function public.public_player_profile(p_player_id uuid)
returns table(
  id uuid,
  display_name text,
  membership_type public.membership_type,
  sessions integer,
  sets integer,
  wins integer,
  losses integer
)
language sql stable security definer set search_path = '' as $$
  with member as (
    select p.id, p.display_name, p.membership_type
    from public.players p
    where p.id = p_player_id and p.is_active and p.membership_type = 'MEMBER'
  ), completed_sets as (
    select st.id, st.team_a_score, st.team_b_score
    from public.sets st
    where st.status = 'COMPLETED'
  ), player_sets as (
    select cs.id, cs.team_a_score, cs.team_b_score, sp.team
    from completed_sets cs
    join public.set_players sp on sp.set_id = cs.id and sp.player_id = p_player_id
  )
  select m.id, m.display_name, m.membership_type,
    (select count(distinct participant.session_id)::int from public.session_participants participant where participant.player_id = m.id),
    (select count(*)::int from player_sets),
    (select count(*)::int from player_sets where (team = 'A' and team_a_score > team_b_score) or (team = 'B' and team_b_score > team_a_score)),
    (select count(*)::int from player_sets where (team = 'A' and team_a_score < team_b_score) or (team = 'B' and team_b_score < team_a_score))
  from member m;
$$;

create or replace function public.public_player_recent_sessions(p_player_id uuid)
returns table(id uuid, started_at timestamptz, closed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.started_at, s.closed_at
  from public.sessions s
  join public.session_participants sp on sp.session_id = s.id
  join public.players p on p.id = sp.player_id
  where p.id = p_player_id and p.is_active and p.membership_type = 'MEMBER'
  order by s.started_at desc
  limit 6;
$$;

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
    coalesce(array_agg(p.display_name order by p.display_name) filter (where sp.team = 'A'), '{}') as team_a,
    coalesce(array_agg(p.display_name order by p.display_name) filter (where sp.team = 'B'), '{}') as team_b,
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

create or replace function public.public_fund_activity()
returns table(id uuid, kind text, label text, amount bigint, occurred_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, 'INCOME', 'Dana masuk', p.amount::bigint, p.received_at
  from public.payments p
  union all
  select e.id, 'EXPENSE', coalesce(e.description, case e.category when 'COURT' then 'Sewa lapangan' when 'SHUTTLECOCK' then 'Kok' else 'Pengeluaran klub' end), (-e.amount)::bigint, e.occurred_at
  from public.expenses e
  order by occurred_at desc
  limit 20;
$$;

revoke all on function public.public_player_profile(uuid), public.public_player_recent_sessions(uuid), public.public_session_matches(uuid), public.public_fund_activity() from public;
grant execute on function public.public_player_profile(uuid), public.public_player_recent_sessions(uuid), public.public_session_matches(uuid), public.public_fund_activity() to anon, authenticated;
notify pgrst, 'reload schema';
