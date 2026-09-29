create or replace function public.submit_session_finance(
  p_session_id uuid,
  p_lease_id uuid,
  p_reported_court_cost integer default null,
  p_reported_shuttlecock_cost integer default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_submission_id uuid;
begin
  if not exists (
    select 1 from public.session_operator_leases
    where id = p_lease_id and session_id = p_session_id and revoked_at is null
  ) then
    raise exception 'Valid operator lease required';
  end if;
  if p_reported_court_cost is not null and p_reported_court_cost <= 0 then
    raise exception 'Court cost must be greater than zero';
  end if;
  if p_reported_shuttlecock_cost is not null and p_reported_shuttlecock_cost <= 0 then
    raise exception 'Shuttlecock cost must be greater than zero';
  end if;
  if p_reported_court_cost is null and p_reported_shuttlecock_cost is null and nullif(trim(p_notes), '') is null then
    raise exception 'Enter a reported cost or a note';
  end if;

  select club_id into v_club_id from public.sessions where id = p_session_id and status = 'CLOSED';
  if v_club_id is null then
    raise exception 'Close the session before submitting finance details';
  end if;

  insert into public.finance_submissions(
    session_id, reported_court_cost, reported_shuttlecock_cost, notes, submitted_by_operator_lease_id
  ) values (
    p_session_id, p_reported_court_cost, p_reported_shuttlecock_cost, nullif(trim(p_notes), ''), p_lease_id
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$$;

create or replace function public.finance_pending_submissions(p_club_id uuid)
returns table(
  submission_id uuid,
  session_id uuid,
  submitted_at timestamptz,
  session_started_at timestamptz,
  reported_court_cost integer,
  reported_shuttlecock_cost integer,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select fs.id, fs.session_id, fs.submitted_at, s.started_at,
    fs.reported_court_cost, fs.reported_shuttlecock_cost, fs.notes
  from public.finance_submissions fs
  join public.sessions s on s.id = fs.session_id
  where s.club_id = p_club_id
    and fs.status = 'PENDING'
    and public.is_finance_admin(p_club_id)
  order by fs.submitted_at;
$$;

create or replace function public.review_finance_submission(
  p_club_id uuid,
  p_submission_id uuid,
  p_confirm boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.finance_submissions%rowtype;
begin
  if not public.is_finance_admin(p_club_id) then
    raise exception 'Finance Admin authority is required';
  end if;

  select fs.* into v_submission
  from public.finance_submissions fs
  join public.sessions s on s.id = fs.session_id
  where fs.id = p_submission_id and s.club_id = p_club_id
  for update of fs;
  if v_submission.id is null or v_submission.status <> 'PENDING' then
    raise exception 'Pending finance submission not found';
  end if;

  update public.finance_submissions
  set status = case when p_confirm then 'CONFIRMED' else 'REJECTED' end,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now()
  where id = p_submission_id;

  if p_confirm then
    if v_submission.reported_court_cost is not null then
      insert into public.expenses(club_id, session_id, category, amount, description, recorded_by_user_id)
      values (p_club_id, v_submission.session_id, 'COURT', v_submission.reported_court_cost,
        'Confirmed from operator finance submission', auth.uid());
    end if;
    if v_submission.reported_shuttlecock_cost is not null then
      insert into public.expenses(club_id, session_id, category, amount, description, recorded_by_user_id)
      values (p_club_id, v_submission.session_id, 'SHUTTLECOCK', v_submission.reported_shuttlecock_cost,
        'Confirmed from operator finance submission', auth.uid());
    end if;
  end if;
end;
$$;

revoke execute on function public.submit_session_finance(uuid, uuid, integer, integer, text),
  public.finance_pending_submissions(uuid),
  public.review_finance_submission(uuid, uuid, boolean)
from public, anon;
grant execute on function public.submit_session_finance(uuid, uuid, integer, integer, text),
  public.finance_pending_submissions(uuid),
  public.review_finance_submission(uuid, uuid, boolean)
to authenticated;

-- Courtside operation uses the public lease credential rather than an Auth account.
grant execute on function public.submit_session_finance(uuid, uuid, integer, integer, text) to anon;

notify pgrst, 'reload schema';
