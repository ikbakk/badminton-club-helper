-- New sessions can bypass recommendations while retaining authoritative matches.
alter table public.sessions
  add column match_mode text not null default 'ASSISTED'
    check (match_mode in ('ASSISTED', 'MANUAL')),
  add column count_kok boolean not null default true,
  add column kok_price integer check (kok_price is null or kok_price >= 0),
  add column court_rent integer check (court_rent is null or court_rent >= 0);
-- Existing nights did not collect counts; do not require invented historical values.
update public.sessions set count_kok = false;
alter table public.matches add column kok_count integer check (kok_count is null or kok_count >= 0);
alter table public.session_obligations
  add column base_amount integer,
  add column kok_amount integer not null default 0,
  add column adjustment_amount integer not null default 0,
  add column adjustment_reason text;

create or replace view public.live_session as
select id, club_id, status, started_at, closed_at, court_count, match_mode, count_kok
from public.sessions where status = 'LIVE';
create or replace view public.public_session_history as
select s.id,s.started_at,s.closed_at,s.fee_per_person,count(sp.id)::integer as attendance,s.club_id,
  s.count_kok,s.kok_price,s.court_rent,s.match_mode
from public.sessions s left join public.session_participants sp on sp.session_id=s.id group by s.id;

drop function public.start_session(uuid, integer);
create function public.start_session(
  p_club_id uuid, p_court_count integer default 1,
  p_match_mode text default 'ASSISTED', p_count_kok boolean default true
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session uuid;
begin
  if auth.uid() is null or not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if p_court_count is null or p_court_count < 1 then
    raise exception 'At least one court is required';
  end if;
  if p_match_mode not in ('ASSISTED','MANUAL') or p_match_mode is null or p_count_kok is null then
    raise exception 'Invalid session options';
  end if;
  insert into public.sessions(club_id, created_by_user_id, court_count, match_mode, count_kok)
  values (p_club_id, auth.uid(), p_court_count, p_match_mode, p_count_kok)
  returning id into v_session;
  perform public.append_session_event(v_session, 'SESSION_STARTED', 'session', v_session, null,
    jsonb_build_object('court_count', p_court_count, 'match_mode', p_match_mode, 'count_kok', p_count_kok));
  return v_session;
end;
$$;
revoke execute on function public.start_session(uuid,integer,text,boolean) from public, anon;
grant execute on function public.start_session(uuid,integer,text,boolean) to authenticated;

create function public.record_match_kok(p_match_id uuid, p_count integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_session public.sessions%rowtype;
begin
  select s.* into v_session from public.sessions s
    join public.matches m on m.session_id = s.id where m.id = p_match_id for update of s;
  if v_session.id is null or auth.uid() is null or not public.is_club_admin(v_session.club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if not v_session.count_kok then raise exception 'Kok counting is off for this session'; end if;
  if v_session.status not in ('LIVE','CLOSED') or v_session.fee_per_person is not null then
    raise exception 'Kok count is locked after charges are confirmed';
  end if;
  if p_count is null or p_count < 0 then raise exception 'Enter zero or a positive kok count'; end if;
  update public.matches set kok_count = p_count where id = p_match_id and status = 'COMPLETED';
  if not found then raise exception 'Complete the match before counting kok'; end if;
  perform public.append_session_event(v_session.id,'MATCH_KOK_RECORDED','match',p_match_id,null,
    jsonb_build_object('count',p_count));
end;
$$;
revoke execute on function public.record_match_kok(uuid,integer) from public, anon;
grant execute on function public.record_match_kok(uuid,integer) to authenticated;

create function public.session_kok_matches(p_session_id uuid)
returns table(match_id uuid, sequence_number integer, kok_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid;
begin
  select club_id into v_club from public.sessions where id = p_session_id;
  if v_club is null or auth.uid() is null or not public.is_club_admin(v_club) then
    raise exception 'Club Admin authority is required';
  end if;
  return query select m.id,m.sequence_number,m.kok_count from public.matches m
    where m.session_id = p_session_id and m.status = 'COMPLETED' order by m.sequence_number;
end;
$$;
revoke execute on function public.session_kok_matches(uuid) from public, anon;
grant execute on function public.session_kok_matches(uuid) to authenticated;

-- Allocate each match's cost by actual completed set appearances. The stable
-- player-id tie break assigns any remaining whole rupiah one at a time.
create function public.session_kok_shares(p_session_id uuid, p_price integer)
returns table(player_id uuid, kok_amount integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid;
begin
  select club_id into v_club from public.sessions where id = p_session_id;
  if v_club is null or auth.uid() is null or not public.is_club_admin(v_club) then
    raise exception 'Club Admin authority is required';
  end if;
  if p_price is null or p_price < 0 then raise exception 'Kok price must be zero or positive'; end if;
  return query
  with appearances as (
    select m.id match_id, sp.player_id, count(*)::bigint slots,
      (m.kok_count::bigint * p_price)::bigint cost
    from public.matches m
    join public.sets st on st.match_id = m.id and st.status = 'COMPLETED'
    join public.set_players sp on sp.set_id = st.id
    where m.session_id = p_session_id and m.status = 'COMPLETED' and m.kok_count is not null
    group by m.id, sp.player_id, m.kok_count
  ), raw as (
    select a.*, sum(a.slots) over(partition by a.match_id) total_slots
    from appearances a
  ), ranked as (
    select r.*,
      ((r.cost * r.slots) / r.total_slots)::integer whole,
      row_number() over(partition by r.match_id order by r.player_id) position
    from raw r
  ), portions as (
    select q.*, (q.cost - sum(q.whole) over(partition by q.match_id))::integer leftover
    from ranked q
  )
  select portions.player_id, sum(portions.whole + case when portions.position <= portions.leftover then 1 else 0 end)::integer
  from portions group by portions.player_id;
end;
$$;
revoke execute on function public.session_kok_shares(uuid,integer) from public, anon;
grant execute on function public.session_kok_shares(uuid,integer) to authenticated;

create function public.confirm_session_charges(
  p_session_id uuid, p_base integer, p_kok_price integer, p_court_rent integer,
  p_adjustments jsonb default '{}'::jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_session public.sessions%rowtype;
  v_player record;
  v_kok integer;
  v_adjustment integer;
  v_reason text;
  v_count integer := 0;
begin
  select * into v_session from public.sessions where id = p_session_id for update;
  if v_session.id is null or auth.uid() is null or not public.is_club_admin(v_session.club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if v_session.status <> 'CLOSED' or v_session.fee_per_person is not null then
    raise exception 'Session charges are already confirmed or session is not closed';
  end if;
  if p_base is null or p_base <= 0 or p_kok_price is null or p_kok_price < 0
     or p_court_rent is null or p_court_rent < 0
     or p_adjustments is null or jsonb_typeof(p_adjustments) <> 'object' then
    raise exception 'Invalid session pricing';
  end if;
  if v_session.count_kok and exists (
    select 1 from public.matches where session_id = p_session_id
      and status = 'COMPLETED' and kok_count is null
  ) then raise exception 'Record kok count for every completed match before confirming charges'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_adjustments) k
    where not exists (select 1 from public.session_participants sp
      where sp.session_id = p_session_id and sp.player_id::text = k)
  ) then raise exception 'An adjustment refers to a player outside this session'; end if;

  for v_player in select sp.player_id from public.session_participants sp
    where sp.session_id = p_session_id order by sp.player_id loop
    select coalesce(sum(kok_amount),0)::integer into v_kok
      from public.session_kok_shares(p_session_id,p_kok_price) where player_id = v_player.player_id;
    v_adjustment := coalesce((p_adjustments -> v_player.player_id::text ->> 'amount')::integer,0);
    v_reason := nullif(trim(p_adjustments -> v_player.player_id::text ->> 'reason'),'');
    if v_adjustment <> 0 and v_reason is null then
      raise exception 'Explain every individual adjustment';
    end if;
    if p_base + v_kok + v_adjustment <= 0 then
      raise exception 'Each player charge must be positive';
    end if;
    insert into public.session_obligations(
      session_id,player_id,amount,base_amount,kok_amount,adjustment_amount,adjustment_reason
    ) values (p_session_id,v_player.player_id,p_base+v_kok+v_adjustment,
      p_base,v_kok,v_adjustment,v_reason);
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'At least one attendee is required'; end if;
  update public.sessions set fee_per_person=p_base,kok_price=p_kok_price,court_rent=p_court_rent
    where id=p_session_id;
  if p_court_rent > 0 then
    insert into public.expenses(club_id,session_id,category,amount,description,recorded_by_user_id)
    values(v_session.club_id,p_session_id,'COURT',p_court_rent,'Sewa lapangan',auth.uid());
  end if;
  perform public.append_session_event(p_session_id,'SESSION_CHARGES_CONFIRMED','session',p_session_id,null,
    jsonb_build_object('base',p_base,'kok_price',p_kok_price,'court_rent',p_court_rent,'attendees',v_count));
  return v_count;
end;
$$;
revoke execute on function public.confirm_session_charges(uuid,integer,integer,integer,jsonb) from public, anon;
grant execute on function public.confirm_session_charges(uuid,integer,integer,integer,jsonb) to authenticated;
-- The legacy fee-only path would skip kok allocation and the paid court expense.
revoke execute on function public.confirm_session_fee(uuid,uuid,integer) from public, anon, authenticated;

drop function public.finance_session_attendees(uuid,uuid);
create function public.finance_session_attendees(p_club_id uuid, p_session_id uuid)
returns table(player_id uuid, display_name text, amount integer, paid_at timestamptz,
  base_amount integer, kok_amount integer, adjustment_amount integer, adjustment_reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  return query select p.id,p.display_name,o.amount,o.paid_at,
    o.base_amount,o.kok_amount,o.adjustment_amount,o.adjustment_reason
  from public.sessions s join public.session_participants sp on sp.session_id=s.id
  join public.players p on p.id=sp.player_id
  left join public.session_obligations o on o.session_id=s.id and o.player_id=p.id
  where s.id=p_session_id and s.club_id=p_club_id and s.status='CLOSED'
  order by p.display_name;
end;
$$;
revoke execute on function public.finance_session_attendees(uuid,uuid) from public, anon;
grant execute on function public.finance_session_attendees(uuid,uuid) to authenticated;

create or replace function public.public_session_finance_recap(p_session_id uuid)
returns table(fee_per_person integer, expected_fees bigint, court_expenses bigint,
  shuttlecock_expenses bigint, other_expenses bigint)
language sql stable security definer set search_path = '' as $$
  select s.fee_per_person,
    coalesce((select sum(o.amount) from public.session_obligations o where o.session_id=s.id),0)::bigint,
    coalesce((select sum(e.amount) from public.expenses e where e.session_id=s.id and e.category='COURT'),0)::bigint,
    coalesce((select sum(e.amount) from public.expenses e where e.session_id=s.id and e.category='SHUTTLECOCK'),0)::bigint,
    coalesce((select sum(e.amount) from public.expenses e where e.session_id=s.id and e.category='OTHER'),0)::bigint
  from public.sessions s where s.id=p_session_id and s.status='CLOSED';
$$;
revoke execute on function public.public_session_finance_recap(uuid) from public;
grant execute on function public.public_session_finance_recap(uuid) to anon,authenticated;

notify pgrst,'reload schema';
