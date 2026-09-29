alter table public.session_obligations
  add column paid_at timestamptz,
  add column paid_by_user_id uuid references auth.users;

create index session_obligations_paid_by_session
  on public.session_obligations(session_id, paid_at)
  where paid_at is not null;

create or replace function public.finance_sessions(p_club_id uuid)
returns table(
  session_id uuid,
  started_at timestamptz,
  fee_per_person integer,
  attendance integer,
  paid_count integer,
  paid_amount bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.started_at, s.fee_per_person,
    count(sp.id)::integer,
    count(o.id) filter (where o.paid_at is not null)::integer,
    coalesce(sum(o.amount) filter (where o.paid_at is not null), 0)::bigint
  from public.sessions s
  left join public.session_participants sp on sp.session_id = s.id
  left join public.session_obligations o on o.session_id = s.id and o.player_id = sp.player_id
  where s.club_id = p_club_id
    and s.status = 'CLOSED'
    and public.is_finance_admin(p_club_id)
  group by s.id, s.started_at, s.fee_per_person
  order by s.started_at desc;
$$;

create or replace function public.finance_session_attendees(p_club_id uuid, p_session_id uuid)
returns table(
  player_id uuid,
  display_name text,
  amount integer,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, o.amount, o.paid_at
  from public.sessions s
  join public.session_participants sp on sp.session_id = s.id
  join public.players p on p.id = sp.player_id
  left join public.session_obligations o on o.session_id = s.id and o.player_id = p.id
  where s.id = p_session_id
    and s.club_id = p_club_id
    and s.status = 'CLOSED'
    and public.is_finance_admin(p_club_id)
  order by p.display_name;
$$;

create or replace function public.set_session_attendee_paid(
  p_club_id uuid,
  p_session_id uuid,
  p_player_id uuid,
  p_paid boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obligation_id uuid;
begin
  if not public.is_finance_admin(p_club_id) then
    raise exception 'Finance Admin authority is required';
  end if;

  update public.session_obligations o
  set paid_at = case when p_paid then coalesce(o.paid_at, now()) else null end,
      paid_by_user_id = case when p_paid then auth.uid() else null end
  from public.sessions s
  where o.session_id = p_session_id
    and o.player_id = p_player_id
    and s.id = o.session_id
    and s.club_id = p_club_id
    and s.status = 'CLOSED'
  returning o.id into v_obligation_id;

  if v_obligation_id is null then
    raise exception 'No fee obligation exists for this attendee. Confirm the session fee first.';
  end if;

  perform public.append_session_event(
    p_session_id,
    'ATTENDANCE_PAYMENT_STATUS_CHANGED',
    'session_obligation',
    v_obligation_id,
    null,
    jsonb_build_object('paid', p_paid, 'player_id', p_player_id)
  );
end;
$$;

revoke execute on function public.finance_sessions(uuid),
  public.finance_session_attendees(uuid, uuid),
  public.set_session_attendee_paid(uuid, uuid, uuid, boolean)
from public, anon;
grant execute on function public.finance_sessions(uuid),
  public.finance_session_attendees(uuid, uuid),
  public.set_session_attendee_paid(uuid, uuid, uuid, boolean)
to authenticated;

-- Preserve the old transaction records in-place. New attendee check-offs count
-- as session income, except where a legacy allocation already represents that money.
create or replace view public.public_fund_summary as
select
  (
    coalesce((select sum(p.amount) from public.payments p), 0)
    + coalesce((
      select sum(o.amount)
      from public.session_obligations o
      where o.paid_at is not null
        and not exists (select 1 from public.payment_allocations a where a.obligation_id = o.id)
    ), 0)
  )::bigint as received,
  coalesce((select sum(e.amount) from public.expenses e), 0)::bigint as expenses,
  (
    coalesce((select sum(p.amount) from public.payments p), 0)
    + coalesce((
      select sum(o.amount)
      from public.session_obligations o
      where o.paid_at is not null
        and not exists (select 1 from public.payment_allocations a where a.obligation_id = o.id)
    ), 0)
    - coalesce((select sum(e.amount) from public.expenses e), 0)
  )::bigint as balance;

create or replace function public.public_fund_activity()
returns table(id uuid, kind text, label text, amount bigint, occurred_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select p.id, 'INCOME'::text, 'Dana masuk'::text, p.amount::bigint, p.received_at
    from public.payments p
    union all
    select e.id, 'EXPENSE'::text,
      coalesce(e.description, case e.category when 'COURT' then 'Sewa lapangan' when 'SHUTTLECOCK' then 'Kok' else 'Pengeluaran klub' end),
      (-e.amount)::bigint, e.occurred_at
    from public.expenses e
    union all
    select md5('session-paid:' || o.session_id::text)::uuid, 'INCOME'::text,
      'Iuran sesi'::text, sum(o.amount)::bigint, max(o.paid_at)
    from public.session_obligations o
    where o.paid_at is not null
      and not exists (select 1 from public.payment_allocations a where a.obligation_id = o.id)
    group by o.session_id
  ) as activity(id, kind, label, amount, occurred_at)
  order by activity.occurred_at desc
  limit 20;
$$;

notify pgrst, 'reload schema';
