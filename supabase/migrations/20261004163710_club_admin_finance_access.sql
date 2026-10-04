-- Finance administration is now owned only by authenticated Club Admin accounts.
-- Historical records and the legacy enum remain intact, but FINANCE_ADMIN is no longer assigned.

delete from public.club_roles where role = 'FINANCE_ADMIN';

create or replace function public.is_finance_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_club_admin(p_club_id);
$$;

create or replace function public.my_club()
returns table(id uuid, name text, is_club_admin boolean, is_finance_admin boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name,
    public.is_club_admin(c.id),
    false
  from public.clubs c
  where public.is_club_admin(c.id);
$$;

revoke execute on function public.submit_session_finance(uuid, uuid, integer, integer, text),
  public.finance_pending_submissions(uuid),
  public.review_finance_submission(uuid, uuid, boolean)
from public, anon, authenticated;

notify pgrst, 'reload schema';
