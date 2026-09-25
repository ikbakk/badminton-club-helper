-- Lock down previously created SECURITY DEFINER functions. Explicit grants below are the API surface.
revoke execute on all functions in schema public from public, anon, authenticated;

create or replace function public.bootstrap_first_club(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if exists(select 1 from public.clubs) then raise exception 'The club is already configured'; end if;
 if length(trim(p_name)) < 2 then raise exception 'Club name is required'; end if;
 insert into public.clubs(name) values(trim(p_name)) returning id into v_club;
 insert into public.club_roles(club_id,user_id,role) values(v_club,auth.uid(),'CLUB_ADMIN');
 return v_club;
end; $$;

create or replace function public.add_roster_player(p_club_id uuid, p_name text, p_membership public.membership_type default 'MEMBER')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
 if not public.is_club_admin(p_club_id) then raise exception 'Club Admin authority is required'; end if;
 if length(trim(p_name)) < 1 then raise exception 'Player name is required'; end if;
 insert into public.players(club_id,display_name,membership_type) values(p_club_id,trim(p_name),p_membership) returning id into v_player;
 insert into public.player_ratings(player_id) values(v_player,1200,0.7);
 return v_player;
end; $$;

grant execute on function public.bootstrap_first_club(text), public.add_roster_player(uuid,text,public.membership_type), public.start_session(uuid,text) to authenticated;
grant execute on function public.claim_operator_lease(uuid,text,text,boolean), public.check_in_player(uuid,uuid,uuid), public.change_participant_status(uuid,uuid,uuid,public.participant_status) to anon,authenticated;
