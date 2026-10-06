-- Final authority model: authenticated Club Admins mutate domain state only
-- through guarded commands. No browser role receives direct table DML.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

create or replace function public.is_club_admin(p_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.club_roles r
    where r.club_id = p_club_id and r.user_id = auth.uid() and r.role = 'CLUB_ADMIN'
  );
$$;
revoke execute on function public.is_club_admin(uuid) from public, anon;
grant execute on function public.is_club_admin(uuid) to authenticated;

-- Serialize the first-club bootstrap so concurrent callers cannot both win.
create or replace function public.bootstrap_first_club(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bootstrap_first_club', 0));
  if exists (select 1 from public.clubs) then raise exception 'The club is already configured'; end if;
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'Club name is required'; end if;
  insert into public.clubs(name) values (trim(p_name)) returning id into v_club;
  insert into public.club_roles(club_id, user_id, role) values (v_club, auth.uid(), 'CLUB_ADMIN');
  return v_club;
end;
$$;
revoke execute on function public.bootstrap_first_club(text) from public, anon;
grant execute on function public.bootstrap_first_club(text) to authenticated;

-- Defense in depth for set results. Existing command validation remains useful
-- for clear errors; this constraint also protects any future write path.
alter table public.sets
  add constraint completed_set_score_is_decisive
  check (status <> 'COMPLETED' or team_a_score <> team_b_score);

create or replace function public.substitute_player(
  p_session_id uuid, p_lease_id uuid, p_outgoing_player_id uuid,
  p_replacement_player_id uuid,
  p_outgoing_status public.participant_status default 'RESTING'
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_match uuid;
  v_set uuid;
  v_out public.session_participants%rowtype;
  v_in public.session_participants%rowtype;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  if p_outgoing_status not in ('RESTING','OUT','LEFT') then
    raise exception 'Choose RESTING, OUT, or LEFT for the outgoing player';
  end if;
  if p_outgoing_player_id = p_replacement_player_id then
    raise exception 'Outgoing and replacement players must differ';
  end if;

  select m.id into v_match
  from public.matches m
  join public.sets s on s.match_id = m.id and s.set_number = 1 and s.status = 'COMPLETED'
  where m.session_id = p_session_id and m.status = 'IN_PROGRESS'
  for update of m;
  if v_match is null then
    raise exception 'Substitution is available only between Set 1 and Set 2';
  end if;
  select s.id into v_set from public.sets s
  where s.match_id = v_match and s.set_number = 2 and s.status = 'IN_PROGRESS'
  for update;
  if v_set is null then raise exception 'Set 2 is not active'; end if;

  select * into v_out from public.session_participants
  where session_id = p_session_id and player_id = p_outgoing_player_id and status = 'PLAYING'
  for update;
  select * into v_in from public.session_participants
  where session_id = p_session_id and player_id = p_replacement_player_id and status = 'READY'
  for update;
  if v_out.id is null or v_in.id is null
    or not exists (select 1 from public.set_players where set_id = v_set and player_id = p_outgoing_player_id)
    or exists (select 1 from public.set_players where set_id = v_set and player_id = p_replacement_player_id) then
    raise exception 'Choose a playing player and a READY replacement';
  end if;

  update public.set_players set player_id = p_replacement_player_id
  where set_id = v_set and player_id = p_outgoing_player_id;
  update public.session_participants
  set status = p_outgoing_status, ready_since = null,
      left_at = case when p_outgoing_status = 'LEFT' then now() else left_at end, updated_at = now()
  where id = v_out.id;
  update public.session_participants
  set status = 'PLAYING', ready_since = null, updated_at = now() where id = v_in.id;
  update public.participant_status_periods set ended_at = now()
  where session_participant_id in (v_out.id, v_in.id) and ended_at is null;
  insert into public.participant_status_periods(session_participant_id, status)
  values (v_out.id, p_outgoing_status), (v_in.id, 'PLAYING');
  perform public.append_session_event(p_session_id, 'PLAYER_SUBSTITUTED', 'match', v_match,
    null, jsonb_build_object('outgoing', p_outgoing_player_id, 'replacement', p_replacement_player_id));
end;
$$;

create or replace function public.close_session(p_session_id uuid, p_lease_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attendance integer; v_sets integer; v_started timestamptz;
begin
  perform public.valid_operator_lease(p_session_id, p_lease_id);
  select started_at into v_started from public.sessions
  where id = p_session_id and status = 'LIVE' for update;
  if v_started is null then raise exception 'Live session not found'; end if;
  if exists (select 1 from public.matches where session_id = p_session_id and status = 'IN_PROGRESS') then
    raise exception 'Complete or abandon the active match before ending the session';
  end if;
  update public.sessions set status = 'CLOSED', closed_at = now() where id = p_session_id;
  update public.session_participants
  set status = 'LEFT', left_at = coalesce(left_at, now()), ready_since = null, updated_at = now()
  where session_id = p_session_id and status <> 'LEFT';
  update public.participant_status_periods p set ended_at = now()
  where p.ended_at is null and exists (
    select 1 from public.session_participants sp where sp.id = p.session_participant_id and sp.session_id = p_session_id
  );
  select count(*) into v_attendance from public.session_participants where session_id = p_session_id;
  select count(*) into v_sets from public.sets s join public.matches m on m.id = s.match_id
  where m.session_id = p_session_id and s.status = 'COMPLETED';
  perform public.append_session_event(p_session_id, 'SESSION_CLOSED', 'session', p_session_id, p_lease_id);
  return jsonb_build_object('attendance', v_attendance, 'sets', v_sets, 'startedAt', v_started);
end;
$$;

-- Serialize allocations on both parent rows. This prevents concurrent calls
-- from overspending a payment or overpaying an obligation.
create or replace function public.allocate_payment(
  p_club_id uuid, p_payment_id uuid, p_obligation_id uuid, p_amount integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.payments%rowtype;
  v_obligation public.session_obligations%rowtype;
  v_allocated integer;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Allocation must be greater than zero'; end if;
  select * into v_payment from public.payments
  where id = p_payment_id and club_id = p_club_id for update;
  if v_payment.id is null then raise exception 'Payment not found'; end if;
  select o.* into v_obligation from public.session_obligations o
  join public.sessions s on s.id = o.session_id
  where o.id = p_obligation_id and s.club_id = p_club_id for update of o;
  if v_obligation.id is null then raise exception 'Obligation not found'; end if;
  if v_payment.player_id <> v_obligation.player_id then
    raise exception 'A payment can only be allocated to the same player';
  end if;
  select coalesce(sum(amount), 0)::integer into v_allocated
  from public.payment_allocations where payment_id = p_payment_id;
  if v_allocated + p_amount > v_payment.amount then raise exception 'Allocation exceeds the unallocated payment amount'; end if;
  select coalesce(sum(amount), 0)::integer into v_allocated
  from public.payment_allocations where obligation_id = p_obligation_id;
  if v_allocated + p_amount > v_obligation.amount then raise exception 'Allocation exceeds the remaining obligation amount'; end if;
  insert into public.payment_allocations(payment_id, obligation_id, amount)
  values (p_payment_id, p_obligation_id, p_amount) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.substitute_player(uuid, uuid, uuid, uuid, public.participant_status),
  public.close_session(uuid, uuid), public.allocate_payment(uuid, uuid, uuid, integer)
from public, anon;
grant execute on function public.substitute_player(uuid, uuid, uuid, uuid, public.participant_status),
  public.close_session(uuid, uuid), public.allocate_payment(uuid, uuid, uuid, integer)
to authenticated;

notify pgrst, 'reload schema';
