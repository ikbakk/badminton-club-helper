create or replace function public.promote_guest_to_member(p_club_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_club_admin(p_club_id) then
    raise exception 'Club Admin authority is required';
  end if;

  update public.players
  set membership_type = 'MEMBER', is_active = true
  where id = p_player_id
    and club_id = p_club_id
    and membership_type = 'GUEST';

  if not found then
    raise exception 'Guest not found in this club';
  end if;
end;
$$;

revoke execute on function public.promote_guest_to_member(uuid, uuid) from public, anon;
grant execute on function public.promote_guest_to_member(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
