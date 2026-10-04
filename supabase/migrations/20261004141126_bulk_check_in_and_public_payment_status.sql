create or replace function public.check_in_players(p_session_id uuid, p_player_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in with a Club Admin account to manage the live session';
  end if;
  perform public.valid_operator_lease(p_session_id, null);
  if p_player_ids is null or cardinality(p_player_ids) = 0 then
    raise exception 'Choose at least one player to check in';
  end if;
  if exists (
    select 1
    from (select distinct unnest(p_player_ids) as player_id) selected
    where selected.player_id is null
       or not exists (
         select 1
         from public.sessions s
         join public.players p on p.club_id = s.club_id
         where s.id = p_session_id and p.id = selected.player_id
       )
  ) then
    raise exception 'One or more selected players do not belong to this club';
  end if;
  for v_player_id in select distinct unnest(p_player_ids)
  loop
    perform public.check_in_player(p_session_id, null, v_player_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.check_in_players(uuid, uuid[]) from public, anon;
grant execute on function public.check_in_players(uuid, uuid[]) to authenticated;

drop function public.public_session_attendance(uuid);
create function public.public_session_attendance(p_session_id uuid)
returns table(
  player_id uuid,
  display_name text,
  membership_type public.membership_type,
  is_paid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.membership_type,
    case when s.fee_per_person is null then null else o.paid_at is not null end as is_paid
  from public.sessions s
  join public.session_participants sp on sp.session_id = s.id
  join public.players p on p.id = sp.player_id
  left join public.session_obligations o
    on o.session_id = s.id and o.player_id = p.id
  where s.id = p_session_id and s.status = 'CLOSED'
  order by p.membership_type, p.display_name;
$$;

revoke execute on function public.public_session_attendance(uuid) from public;
grant execute on function public.public_session_attendance(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
