-- The ledger remains private. Finance Admins and Club Admins use these commands;
-- public fund projections continue to expose aggregate amounts only.

create or replace function public.is_finance_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_roles
    where club_id = p_club_id
      and user_id = auth.uid()
      and role in ('CLUB_ADMIN', 'FINANCE_ADMIN')
  );
$$;

create or replace function public.record_payment(
  p_club_id uuid,
  p_player_id uuid,
  p_amount integer,
  p_method public.payment_method
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
begin
  if not public.is_finance_admin(p_club_id) then
    raise exception 'Finance Admin authority is required';
  end if;
  if p_amount <= 0 then
    raise exception 'Payment must be greater than zero';
  end if;
  if not exists (select 1 from public.players where id = p_player_id and club_id = p_club_id) then
    raise exception 'Player does not belong to this club';
  end if;

  insert into public.payments(club_id, player_id, amount, method, recorded_by_user_id)
  values (p_club_id, p_player_id, p_amount, p_method, auth.uid())
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function public.record_expense(
  p_club_id uuid,
  p_category public.expense_category,
  p_amount integer,
  p_description text default null,
  p_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense_id uuid;
begin
  if not public.is_finance_admin(p_club_id) then
    raise exception 'Finance Admin authority is required';
  end if;
  if p_amount <= 0 then
    raise exception 'Expense must be greater than zero';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.sessions where id = p_session_id and club_id = p_club_id
  ) then
    raise exception 'Session does not belong to this club';
  end if;

  insert into public.expenses(club_id, session_id, category, amount, description, recorded_by_user_id)
  values (p_club_id, p_session_id, p_category, p_amount, nullif(trim(p_description), ''), auth.uid())
  returning id into v_expense_id;

  return v_expense_id;
end;
$$;

create or replace function public.allocate_payment(
  p_club_id uuid,
  p_payment_id uuid,
  p_obligation_id uuid,
  p_amount integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_obligation public.session_obligations%rowtype;
  v_payment_allocated integer;
  v_obligation_allocated integer;
  v_allocation_id uuid;
begin
  if not public.is_finance_admin(p_club_id) then
    raise exception 'Finance Admin authority is required';
  end if;
  if p_amount <= 0 then
    raise exception 'Allocation must be greater than zero';
  end if;

  select * into v_payment from public.payments
  where id = p_payment_id and club_id = p_club_id
  for update;
  if v_payment.id is null then
    raise exception 'Payment not found';
  end if;

  select session_obligations.* into v_obligation
  from public.session_obligations
  join public.sessions on sessions.id = session_obligations.session_id
  where session_obligations.id = p_obligation_id and sessions.club_id = p_club_id
  for update of session_obligations;
  if v_obligation.id is null then
    raise exception 'Obligation not found';
  end if;
  if v_payment.player_id <> v_obligation.player_id then
    raise exception 'A payment can only be allocated to the same player';
  end if;

  select coalesce(sum(amount), 0) into v_payment_allocated
  from public.payment_allocations where payment_id = p_payment_id;
  select coalesce(sum(amount), 0) into v_obligation_allocated
  from public.payment_allocations where obligation_id = p_obligation_id;

  if v_payment_allocated + p_amount > v_payment.amount then
    raise exception 'Allocation exceeds the unallocated payment amount';
  end if;
  if v_obligation_allocated + p_amount > v_obligation.amount then
    raise exception 'Allocation exceeds the remaining obligation amount';
  end if;

  insert into public.payment_allocations(payment_id, obligation_id, amount)
  values (p_payment_id, p_obligation_id, p_amount)
  returning id into v_allocation_id;

  return v_allocation_id;
end;
$$;

create or replace function public.finance_unallocated_payments(p_club_id uuid)
returns table(payment_id uuid, player_id uuid, display_name text, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    payments.id,
    payments.player_id,
    players.display_name,
    (payments.amount - coalesce(allocations.amount, 0))::integer
  from public.payments
  join public.players on players.id = payments.player_id
  left join lateral (
    select sum(amount)::integer as amount
    from public.payment_allocations
    where payment_id = payments.id
  ) allocations on true
  where payments.club_id = p_club_id
    and public.is_finance_admin(p_club_id)
    and payments.amount > coalesce(allocations.amount, 0)
  order by payments.received_at, payments.created_at;
$$;

create or replace function public.finance_open_obligations(p_club_id uuid)
returns table(obligation_id uuid, player_id uuid, display_name text, session_started_at timestamptz, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session_obligations.id,
    session_obligations.player_id,
    players.display_name,
    sessions.started_at,
    (session_obligations.amount - coalesce(allocations.amount, 0))::integer
  from public.session_obligations
  join public.sessions on sessions.id = session_obligations.session_id
  join public.players on players.id = session_obligations.player_id
  left join lateral (
    select sum(amount)::integer as amount
    from public.payment_allocations
    where obligation_id = session_obligations.id
  ) allocations on true
  where sessions.club_id = p_club_id
    and public.is_finance_admin(p_club_id)
    and session_obligations.amount > coalesce(allocations.amount, 0)
  order by sessions.started_at, players.display_name;
$$;

create or replace function public.finance_player_balances(p_club_id uuid)
returns table(
  player_id uuid,
  display_name text,
  obligations bigint,
  paid bigint,
  allocated bigint,
  debt bigint,
  credit bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    players.id,
    players.display_name,
    coalesce(obligation_totals.amount, 0)::bigint,
    coalesce(payment_totals.amount, 0)::bigint,
    coalesce(allocation_totals.amount, 0)::bigint,
    greatest(coalesce(obligation_totals.amount, 0) - coalesce(allocation_totals.amount, 0), 0)::bigint,
    greatest(coalesce(payment_totals.amount, 0) - coalesce(allocation_totals.amount, 0), 0)::bigint
  from public.players
  left join lateral (
    select sum(amount)::bigint as amount
    from public.session_obligations
    where player_id = players.id
  ) obligation_totals on true
  left join lateral (
    select sum(amount)::bigint as amount
    from public.payments
    where player_id = players.id
  ) payment_totals on true
  left join lateral (
    select sum(payment_allocations.amount)::bigint as amount
    from public.payment_allocations
    join public.session_obligations on session_obligations.id = payment_allocations.obligation_id
    where session_obligations.player_id = players.id
  ) allocation_totals on true
  where players.club_id = p_club_id
    and public.is_finance_admin(p_club_id)
  order by players.display_name;
$$;

revoke execute on function public.record_payment(uuid, uuid, integer, public.payment_method),
  public.record_expense(uuid, public.expense_category, integer, text, uuid),
  public.allocate_payment(uuid, uuid, uuid, integer),
  public.finance_player_balances(uuid),
  public.finance_unallocated_payments(uuid),
  public.finance_open_obligations(uuid)
from public, anon;

grant execute on function public.record_payment(uuid, uuid, integer, public.payment_method),
  public.record_expense(uuid, public.expense_category, integer, text, uuid),
  public.allocate_payment(uuid, uuid, uuid, integer),
  public.finance_player_balances(uuid),
  public.finance_unallocated_payments(uuid),
  public.finance_open_obligations(uuid)
to authenticated;

notify pgrst, 'reload schema';
