-- Public report projections are scoped to closed sessions and expose no
-- participant balances, payment records, finance submissions, or rating data.
create or replace function public.public_session_attendance(p_session_id uuid)
returns table(player_id uuid, display_name text, membership_type public.membership_type)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.membership_type
  from public.session_participants sp
  join public.players p on p.id = sp.player_id
  where sp.session_id = p_session_id
    and exists (
      select 1 from public.sessions s
      where s.id = p_session_id and s.status = 'CLOSED'
    )
  order by p.membership_type, p.display_name;
$$;

create or replace function public.public_session_finance_recap(p_session_id uuid)
returns table(
  fee_per_person integer,
  expected_fees bigint,
  court_expenses bigint,
  shuttlecock_expenses bigint,
  other_expenses bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.fee_per_person,
    (coalesce(s.fee_per_person, 0)::bigint * (
      select count(*)::bigint from public.session_participants sp where sp.session_id = s.id
    )),
    coalesce((select sum(e.amount) from public.expenses e where e.session_id = s.id and e.category = 'COURT'), 0)::bigint,
    coalesce((select sum(e.amount) from public.expenses e where e.session_id = s.id and e.category = 'SHUTTLECOCK'), 0)::bigint,
    coalesce((select sum(e.amount) from public.expenses e where e.session_id = s.id and e.category = 'OTHER'), 0)::bigint
  from public.sessions s
  where s.id = p_session_id and s.status = 'CLOSED'
  group by s.id, s.fee_per_person;
$$;

revoke execute on function public.public_session_attendance(uuid),
  public.public_session_finance_recap(uuid) from public;
grant execute on function public.public_session_attendance(uuid),
  public.public_session_finance_recap(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
