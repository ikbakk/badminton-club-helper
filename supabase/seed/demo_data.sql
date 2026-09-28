-- Idempotent, non-destructive demo data for PB NEWBIE.
-- It preserves an existing LIVE session and its operator PIN. Run with:
-- npx supabase db query --linked --file supabase/seed/demo_data.sql

with club as (
  select id from public.clubs where name = 'PB NEWBIE' order by created_at limit 1
), names(display_name) as (
  values ('Iqbal'), ('Rafi'), ('Dimas'), ('Arya'), ('Bima'), ('Yoga'), ('Fajar'), ('Nanda')
)
insert into public.players(club_id, display_name, membership_type)
select club.id, names.display_name, 'MEMBER'
from club cross join names
where not exists (
  select 1 from public.players p where p.club_id = club.id and p.display_name = names.display_name
);

insert into public.player_ratings(player_id, rating, uncertainty)
select p.id,
  case p.display_name
    when 'Iqbal' then 1280 when 'Rafi' then 1250 when 'Dimas' then 1220 when 'Arya' then 1200
    when 'Bima' then 1180 when 'Yoga' then 1160 when 'Fajar' then 1140 else 1120 end,
  0.35
from public.players p
join public.clubs c on c.id = p.club_id and c.name = 'PB NEWBIE'
where p.display_name in ('Iqbal', 'Rafi', 'Dimas', 'Arya', 'Bima', 'Yoga', 'Fajar', 'Nanda')
on conflict (player_id) do nothing;

with club as (
  select id from public.clubs where name = 'PB NEWBIE' order by created_at limit 1
), demos(started_at, closed_at, fee) as (
  values
    ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-05 14:00:00+00'::timestamptz, 15000),
    ('2026-09-12 12:00:00+00'::timestamptz, '2026-09-12 14:10:00+00'::timestamptz, 15000),
    ('2026-09-19 12:00:00+00'::timestamptz, '2026-09-19 14:05:00+00'::timestamptz, 20000)
)
insert into public.sessions(club_id, status, fee_per_person, started_at, closed_at)
select club.id, 'CLOSED', demos.fee, demos.started_at, demos.closed_at
from club cross join demos
where not exists (
  select 1 from public.sessions s where s.club_id = club.id and s.started_at = demos.started_at
);

with historical_sessions as (
  select s.id, s.started_at, s.closed_at, s.fee_per_person
  from public.sessions s join public.clubs c on c.id = s.club_id
  where c.name = 'PB NEWBIE' and s.started_at in (
    '2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz
  )
), demo_players as (
  select p.id from public.players p join public.clubs c on c.id = p.club_id
  where c.name = 'PB NEWBIE' and p.display_name in ('Iqbal', 'Rafi', 'Dimas', 'Arya', 'Bima', 'Yoga', 'Fajar', 'Nanda')
)
insert into public.session_participants(session_id, player_id, status, checked_in_at, left_at)
select hs.id, dp.id, 'LEFT', hs.started_at + interval '5 minutes', hs.closed_at
from historical_sessions hs cross join demo_players dp
on conflict (session_id, player_id) do nothing;

insert into public.participant_status_periods(session_participant_id, status, started_at, ended_at)
select sp.id, 'LEFT', sp.checked_in_at, sp.left_at
from public.session_participants sp
join public.sessions s on s.id = sp.session_id
join public.clubs c on c.id = s.club_id
where c.name = 'PB NEWBIE'
  and s.status = 'CLOSED'
  and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
  and not exists (select 1 from public.participant_status_periods p where p.session_participant_id = sp.id);

with historical_sessions as (
  select s.id, s.started_at, s.closed_at from public.sessions s join public.clubs c on c.id = s.club_id
  where c.name = 'PB NEWBIE' and s.status = 'CLOSED'
    and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
)
insert into public.matches(session_id, sequence_number, status, started_at, completed_at)
select hs.id, sequence_number, 'COMPLETED', hs.started_at + (sequence_number * interval '30 minutes'), hs.started_at + (sequence_number * interval '30 minutes') + interval '25 minutes'
from historical_sessions hs cross join generate_series(1, 2) sequence_number
on conflict (session_id, sequence_number) do nothing;

insert into public.sets(match_id, set_number, status, team_a_score, team_b_score, started_at, completed_at)
select m.id, set_number, 'COMPLETED',
  case when set_number = 1 then 21 else 21 end,
  case when m.sequence_number = 1 and set_number = 1 then 17 when m.sequence_number = 1 then 19 when set_number = 1 then 18 else 16 end,
  m.started_at + ((set_number - 1) * interval '12 minutes'), m.started_at + (set_number * interval '12 minutes')
from public.matches m join public.sessions s on s.id = m.session_id join public.clubs c on c.id = s.club_id
cross join generate_series(1, 2) set_number
where c.name = 'PB NEWBIE' and s.status = 'CLOSED'
  and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
on conflict (match_id, set_number) do nothing;

with lineup as (
  select p.id, row_number() over (order by p.display_name) as position
  from public.players p join public.clubs c on c.id = p.club_id
  where c.name = 'PB NEWBIE' and p.display_name in ('Iqbal', 'Rafi', 'Dimas', 'Arya')
)
insert into public.set_players(set_id, player_id, team)
select st.id, lineup.id, case when lineup.position <= 2 then 'A' else 'B' end
from public.sets st
join public.matches m on m.id = st.match_id
join public.sessions s on s.id = m.session_id
join public.clubs c on c.id = s.club_id
cross join lineup
where c.name = 'PB NEWBIE' and s.status = 'CLOSED'
  and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
on conflict (set_id, player_id) do nothing;

insert into public.session_obligations(session_id, player_id, amount)
select sp.session_id, sp.player_id, s.fee_per_person
from public.session_participants sp join public.sessions s on s.id = sp.session_id join public.clubs c on c.id = s.club_id
where c.name = 'PB NEWBIE' and s.status = 'CLOSED'
  and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
on conflict (session_id, player_id) do nothing;

insert into public.payments(club_id, player_id, amount, method, received_at)
select s.club_id, sp.player_id, s.fee_per_person, 'CASH', s.closed_at
from public.session_participants sp join public.sessions s on s.id = sp.session_id join public.clubs c on c.id = s.club_id
where c.name = 'PB NEWBIE' and s.status = 'CLOSED'
  and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
  and not exists (select 1 from public.payments p where p.player_id = sp.player_id and p.received_at = s.closed_at);

insert into public.expenses(club_id, session_id, category, description, amount, occurred_at)
select s.club_id, s.id, 'COURT', 'Demo court hire', 80000, s.closed_at
from public.sessions s join public.clubs c on c.id = s.club_id
where c.name = 'PB NEWBIE' and s.status = 'CLOSED'
  and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
  and not exists (select 1 from public.expenses e where e.session_id = s.id and e.description = 'Demo court hire');

insert into public.session_events(session_id, event_type, entity_type, entity_id, metadata, created_at)
select s.id, 'SESSION_CLOSED', 'session', s.id, jsonb_build_object('seeded', true), s.closed_at
from public.sessions s join public.clubs c on c.id = s.club_id
where c.name = 'PB NEWBIE' and s.status = 'CLOSED'
  and s.started_at in ('2026-09-05 12:00:00+00'::timestamptz, '2026-09-12 12:00:00+00'::timestamptz, '2026-09-19 12:00:00+00'::timestamptz)
  and not exists (select 1 from public.session_events e where e.session_id = s.id and e.event_type = 'SESSION_CLOSED');

-- Populate the current LIVE session only where no participant already exists, then show a Set 2 court.
with live as (
  select s.id from public.sessions s join public.clubs c on c.id = s.club_id
  where c.name = 'PB NEWBIE' and s.status = 'LIVE' order by s.started_at desc limit 1
), demo_players as (
  select p.id, p.display_name from public.players p join public.clubs c on c.id = p.club_id
  where c.name = 'PB NEWBIE' and p.display_name in ('Iqbal', 'Rafi', 'Dimas', 'Arya', 'Bima', 'Yoga', 'Fajar', 'Nanda')
)
insert into public.session_participants(session_id, player_id, status, ready_since)
select live.id, demo_players.id,
  case when demo_players.display_name in ('Arya', 'Dimas', 'Iqbal', 'Rafi') then 'PLAYING'::public.participant_status else 'READY'::public.participant_status end,
  case when demo_players.display_name in ('Arya', 'Dimas', 'Iqbal', 'Rafi') then null else now() - interval '10 minutes' end
from live cross join demo_players
on conflict (session_id, player_id) do nothing;

with live as (
  select s.id from public.sessions s join public.clubs c on c.id = s.club_id
  where c.name = 'PB NEWBIE' and s.status = 'LIVE' order by s.started_at desc limit 1
)
insert into public.participant_status_periods(session_participant_id, status)
select sp.id, sp.status
from public.session_participants sp join live on live.id = sp.session_id
where not exists (select 1 from public.participant_status_periods p where p.session_participant_id = sp.id and p.ended_at is null);

with live as (
  select s.id from public.sessions s join public.clubs c on c.id = s.club_id
  where c.name = 'PB NEWBIE' and s.status = 'LIVE' order by s.started_at desc limit 1
), new_match as (
  insert into public.matches(session_id, sequence_number, status, started_at)
  select live.id, coalesce((select max(sequence_number) + 1 from public.matches where session_id = live.id), 1), 'IN_PROGRESS', now() - interval '20 minutes'
  from live
  where not exists (select 1 from public.matches m where m.session_id = live.id and m.status = 'IN_PROGRESS')
  returning id
), new_sets as (
  insert into public.sets(match_id, set_number, status, team_a_score, team_b_score, started_at, completed_at)
  select id, 1, 'COMPLETED'::public.set_status, 21, 18, now() - interval '20 minutes', now() - interval '10 minutes' from new_match
  union all
  select id, 2, 'IN_PROGRESS'::public.set_status, null, null, now() - interval '9 minutes', null from new_match
  returning id, set_number
), lineup as (
  select p.id, row_number() over (order by p.display_name) as position
  from public.players p join public.clubs c on c.id = p.club_id
  where c.name = 'PB NEWBIE' and p.display_name in ('Arya', 'Dimas', 'Iqbal', 'Rafi')
)
insert into public.set_players(set_id, player_id, team)
select new_sets.id, lineup.id, case when lineup.position <= 2 then 'A' else 'B' end
from new_sets cross join lineup;
