-- Public product entry: each organizer owns a club; reads select an explicit club.
-- Existing PB NEWBIE data and domain commands remain in place.
create or replace function public.create_club(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('create_club:' || auth.uid()::text, 0));
  if exists (select 1 from public.club_roles where user_id = auth.uid()) then
    raise exception 'This account already has a club';
  end if;
  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 80 then
    raise exception 'Club name must contain 2 to 80 characters';
  end if;
  insert into public.clubs(name) values (trim(p_name)) returning id into v_club;
  insert into public.club_roles(club_id,user_id,role) values(v_club,auth.uid(),'CLUB_ADMIN');
  return v_club;
end;
$$;
revoke all on function public.create_club(text) from public, anon;
grant execute on function public.create_club(text) to authenticated;

-- Append the club identity to the existing projection without changing its columns.
create or replace view public.public_session_history as
select s.id,s.started_at,s.closed_at,s.fee_per_person,count(sp.id)::integer as attendance,s.club_id
from public.sessions s left join public.session_participants sp on sp.session_id=s.id group by s.id;

-- Preserve accounting semantics while separating every club's totals.
create or replace view public.public_fund_summary as
select income.received, costs.expenses, (income.received-costs.expenses)::bigint as balance,c.id as club_id
from public.clubs c
cross join lateral (
 select (coalesce((select sum(p.amount) from public.payments p where p.club_id=c.id),0)
 + coalesce((select sum(o.amount) from public.session_obligations o join public.sessions s on s.id=o.session_id
 where s.club_id=c.id and o.paid_at is not null
 and not exists(select 1 from public.payment_allocations a where a.obligation_id=o.id)),0))::bigint as received
) income
cross join lateral (select coalesce((select sum(e.amount) from public.expenses e where e.club_id=c.id),0)::bigint as expenses) costs;

create or replace function public.public_fund_activity(p_club_id uuid)
returns table(id uuid, kind text, label text, amount bigint, occurred_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select p.id, 'INCOME'::text, 'Dana masuk'::text, p.amount::bigint, p.received_at
    from public.payments p where p.club_id = p_club_id
    union all
    select e.id, 'EXPENSE'::text,
      coalesce(e.description, case e.category when 'COURT' then 'Sewa lapangan' when 'SHUTTLECOCK' then 'Kok' else 'Pengeluaran klub' end),
      (-e.amount)::bigint, e.occurred_at
    from public.expenses e where e.club_id = p_club_id
    union all
    select md5('session-paid:' || o.session_id::text)::uuid, 'INCOME'::text,
      'Iuran sesi'::text, sum(o.amount)::bigint, max(o.paid_at)
    from public.session_obligations o join public.sessions s on s.id = o.session_id
    where s.club_id = p_club_id and o.paid_at is not null
      and not exists (select 1 from public.payment_allocations a where a.obligation_id = o.id)
    group by o.session_id
  ) as activity(id, kind, label, amount, occurred_at)
  order by activity.occurred_at desc
  limit 20;
$$;
revoke all on function public.public_fund_activity() from public, anon, authenticated;
revoke all on function public.public_fund_activity(uuid) from public;
grant execute on function public.public_fund_activity(uuid) to anon, authenticated;
-- The bulk wrapper already verifies player membership. The retained single-player
-- command must enforce the same boundary now that independent clubs can coexist.
create or replace function public.check_in_player(p_session_id uuid, p_lease_id uuid, p_player_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_participant uuid;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  if not exists (
    select 1 from public.players p join public.sessions s on s.club_id=p.club_id
    where s.id=p_session_id and p.id=p_player_id and p.is_active
  ) then raise exception 'Player does not belong to this club or is inactive'; end if;
  insert into public.session_participants(session_id,player_id,status,ready_since)
  values(p_session_id,p_player_id,'READY',now())
  on conflict(session_id,player_id) do update set status='READY',ready_since=now(),updated_at=now()
  returning id into v_participant;
  update public.participant_status_periods set ended_at=now()
  where session_participant_id=v_participant and ended_at is null;
  insert into public.participant_status_periods(session_participant_id,status) values(v_participant,'READY');
  perform public.append_session_event(p_session_id,'PLAYER_CHECKED_IN','session_participant',v_participant,p_lease_id);
  return v_participant;
end;
$$;
revoke all on function public.check_in_player(uuid,uuid,uuid) from public, anon;
grant execute on function public.check_in_player(uuid,uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
