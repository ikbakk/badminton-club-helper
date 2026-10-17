-- Empty disposable PostgreSQL only. No production data; every fixture rolls back.
begin;
create role anon;
create role authenticated;
create table public.players(id uuid primary key, club_id uuid, display_name text, membership_type text, is_active boolean default true);
create table public.sessions(id uuid primary key, club_id uuid, started_at timestamptz, closed_at timestamptz);
create table public.session_participants(session_id uuid, player_id uuid);
create table public.matches(id uuid primary key, session_id uuid);
create table public.sets(id uuid primary key, match_id uuid, status text, team_a_score integer, team_b_score integer);
create table public.set_players(set_id uuid, player_id uuid, team text);
create table public.player_rating_history(player_id uuid, set_id uuid, source text, algorithm_version text, rating_before numeric, rating_after numeric);
\ir ../migrations/20261017100000_player_session_summaries.sql
insert into public.players(id,club_id,display_name,membership_type) values
 ('00000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','P1','MEMBER'),
 ('00000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','P2','MEMBER'),
 ('00000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','P3','MEMBER'),
 ('00000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','P4','MEMBER'),
 ('00000000-0000-0000-0000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Fill-in','GUEST');
insert into public.sessions values
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','2026-10-17T10:00Z','2026-10-17T13:00Z'),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','2026-10-18T10:00Z',null);
insert into public.session_participants values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000001'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000002'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000005'),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-000000000001');
insert into public.matches values('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111');
insert into public.sets values
 ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','COMPLETED',21,18),
 ('55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','COMPLETED',10,21),
 ('66666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-333333333333','ABANDONED',null,null);
insert into public.set_players values
 ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000001','A'),
 ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000002','A'),
 ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000003','B'),
 ('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-000000000004','B'),
 ('55555555-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000005','A'),
 ('55555555-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000002','A'),
 ('55555555-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000003','B'),
 ('55555555-5555-5555-5555-555555555555','00000000-0000-0000-0000-000000000004','B'),
 ('66666666-6666-6666-6666-666666666666','00000000-0000-0000-0000-000000000001','A');
insert into public.player_rating_history values('00000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','SET_RESULT','trueskill-style-bounded-margin-v1',1200,1210);
set local role anon;
do $$ declare r record; begin
 select * into strict r from public.public_player_session_summaries('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000001');
 if r.sets <> 1 or r.wins <> 1 or r.losses <> 0 or r.rating_change <> 10 or r.partners <> array['P2'] then raise exception 'Incorrect actual-lineup summary'; end if;
 if exists(select 1 from public.public_player_session_summaries('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000001')) then raise exception 'Cross-club summary leaked'; end if;
 if exists(select 1 from public.public_player_session_summaries('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000005')) then raise exception 'Guest profile leaked'; end if;
 select * into strict r from public.public_player_session_summaries('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000002');
 if r.sets <> 2 or r.wins <> 1 or r.losses <> 1 or r.rating_change is not null then raise exception 'Missing rating coverage must be unknown'; end if;
 begin perform * from public.player_rating_history; raise exception 'Direct private read accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Corrected scores are reflected without a stale derived statistics table.
update public.sets set team_a_score=18,team_b_score=21 where id='44444444-4444-4444-4444-444444444444';
update public.players set membership_type='MEMBER' where id='00000000-0000-0000-0000-000000000005';
set local role anon;
do $$ declare r record; begin
 select * into strict r from public.public_player_session_summaries('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000001');
 if r.wins <> 0 or r.losses <> 1 then raise exception 'Corrected score ignored'; end if;
 select * into strict r from public.public_player_session_summaries('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000005');
 if r.sets <> 1 or r.losses <> 1 then raise exception 'Substitute lineup ignored'; end if;
end $$;
reset role;
rollback;
