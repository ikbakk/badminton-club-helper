-- Run ONLY in an empty disposable Postgres database. All fixture objects roll back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/public_product_entry.sql
begin;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.clubs(id uuid primary key default gen_random_uuid(), name text not null);
create table public.club_roles(club_id uuid references public.clubs, user_id uuid, role text);
create table public.sessions(id uuid primary key default gen_random_uuid(),club_id uuid references public.clubs, started_at timestamptz default now(),closed_at timestamptz,fee_per_person integer,status text default 'LIVE');
create table public.players(id uuid primary key,club_id uuid references public.clubs,is_active boolean default true);
create table public.session_participants(id uuid primary key default gen_random_uuid(),session_id uuid references public.sessions,player_id uuid references public.players,status text,ready_since timestamptz,updated_at timestamptz,unique(session_id,player_id));
create table public.participant_status_periods(session_participant_id uuid references public.session_participants,status text,ended_at timestamptz);
create table public.session_events(session_id uuid,event_type text);
create function public.append_session_event(p_session_id uuid,p_type text,p_entity text,p_id uuid,p_lease uuid) returns void language sql as $$ insert into public.session_events values(p_session_id,p_type) $$;
create function public.is_club_admin(p_club_id uuid) returns boolean language sql security definer set search_path='' as $$ select exists(select 1 from public.club_roles where club_id=p_club_id and user_id=auth.uid() and role='CLUB_ADMIN') $$;
create table public.payments(id uuid primary key default gen_random_uuid(),club_id uuid references public.clubs,amount integer,received_at timestamptz default now());
create table public.expenses(id uuid primary key default gen_random_uuid(),club_id uuid references public.clubs,amount integer,category text,description text,occurred_at timestamptz default now());
create table public.session_obligations(id uuid primary key default gen_random_uuid(),session_id uuid references public.sessions,amount integer,paid_at timestamptz);
create table public.payment_allocations(id uuid primary key default gen_random_uuid(),obligation_id uuid references public.session_obligations);
create function public.public_fund_activity() returns void language sql as $$ select $$;
create or replace function public.valid_operator_lease(p_session_id uuid, p_lease_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in with a Club Admin account to manage the live session';
  end if;
  if not exists (
    select 1 from public.sessions s
    where s.id = p_session_id and s.status = 'LIVE'
      and public.is_club_admin(s.club_id)
  ) then
    raise exception 'Club Admin authority is required for this live session';
  end if;
  return true;
end;
$$;
\ir ../migrations/20261014110000_public_product_club_entry.sql

set local role anon;
do $$ begin
 begin perform public.create_club('Anonymous club'); raise exception 'Anonymous creation accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('test.uid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
set local role authenticated;
select set_config('test.a', public.create_club('Alfa')::text, true);
do $$ begin
 begin perform public.create_club('Second club'); raise exception 'Duplicate creation accepted';
 exception when raise_exception then if sqlerrm <> 'This account already has a club' then raise; end if; end;
 begin insert into public.clubs(name) values('Direct write'); raise exception 'Direct write accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('test.uid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
set local role authenticated;
select set_config('test.b', public.create_club('Beta')::text, true);
reset role;
insert into public.sessions(id,club_id) values('11111111-1111-4111-8111-111111111111',current_setting('test.a')::uuid),('22222222-2222-4222-8222-222222222222',current_setting('test.b')::uuid);
insert into public.payments(club_id,amount) values(current_setting('test.a')::uuid,100),(current_setting('test.b')::uuid,900);
insert into public.expenses(club_id,amount,category) values(current_setting('test.a')::uuid,50,'COURT'),(current_setting('test.b')::uuid,100,'COURT');
insert into public.session_obligations(session_id,amount,paid_at) values('11111111-1111-4111-8111-111111111111',200,now());
insert into public.players(id,club_id) values('aaaaaaaa-0000-4000-8000-000000000001',current_setting('test.a')::uuid),('bbbbbbbb-0000-4000-8000-000000000002',current_setting('test.b')::uuid);
select set_config('test.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
select public.check_in_player('11111111-1111-4111-8111-111111111111',null,'aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
 begin perform public.check_in_player('11111111-1111-4111-8111-111111111111',null,'bbbbbbbb-0000-4000-8000-000000000002'); raise exception 'Foreign player check-in accepted';
 exception when raise_exception then if sqlerrm <> 'Player does not belong to this club or is inactive' then raise; end if; end;
 begin perform public.check_in_player('22222222-2222-4222-8222-222222222222',null,'bbbbbbbb-0000-4000-8000-000000000002'); raise exception 'Foreign session write accepted';
 exception when raise_exception then if sqlerrm <> 'Club Admin authority is required for this live session' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.session_participants) <> 1 then raise exception 'Unauthorized participant created'; end if;
 if (select count(*) from public.participant_status_periods) <> 1 then raise exception 'Unauthorized status period created'; end if;
 if (select count(*) from public.session_events) <> 1 then raise exception 'Unauthorized event created'; end if;
end $$;
do $$ begin
 if (select received from public.public_fund_summary where club_id=current_setting('test.a')::uuid) is distinct from 300 then raise exception 'Alfa income wrong'; end if;
 if (select balance from public.public_fund_summary where club_id=current_setting('test.a')::uuid) is distinct from 250 then raise exception 'Alfa balance wrong'; end if;
 if (select balance from public.public_fund_summary where club_id=current_setting('test.b')::uuid) is distinct from 800 then raise exception 'Beta balance wrong'; end if;
 if (select sum(amount) from public.public_fund_activity(current_setting('test.a')::uuid)) is distinct from 250 then raise exception 'Cross-club activity leak'; end if;
 if (select count(*) from public.public_session_history where club_id=current_setting('test.a')::uuid) <> 1 then raise exception 'Cross-club history leak'; end if;
 if (select count(*) from public.club_roles where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role='CLUB_ADMIN') <> 1 then raise exception 'Ownership wrong'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.public_fund_activity(); raise exception 'Global activity still accessible';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
