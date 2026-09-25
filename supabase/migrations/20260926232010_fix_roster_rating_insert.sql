create or replace function public.add_roster_player(p_club_id uuid, p_name text, p_membership public.membership_type default 'MEMBER')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
 if not public.is_club_admin(p_club_id) then raise exception 'Club Admin authority is required'; end if;
 if length(trim(p_name)) < 1 then raise exception 'Player name is required'; end if;
 insert into public.players(club_id,display_name,membership_type)
 values(p_club_id,trim(p_name),p_membership) returning id into v_player;
 insert into public.player_ratings(player_id,rating,uncertainty) values(v_player,1200,0.7);
 return v_player;
end; $$;
notify pgrst, 'reload schema';
