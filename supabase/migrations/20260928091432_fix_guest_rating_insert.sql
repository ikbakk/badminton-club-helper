create or replace function public.add_guest_and_check_in(p_session_id uuid,p_lease_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_player uuid; v_participant uuid;
begin
 if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
 if length(trim(p_name))<1 then raise exception 'Guest name is required'; end if;
 select club_id into v_club from public.sessions where id=p_session_id;
 insert into public.players(club_id,display_name,membership_type) values(v_club,trim(p_name),'GUEST') returning id into v_player;
 insert into public.player_ratings(player_id,rating,uncertainty) values(v_player,1200,0.7);
 insert into public.session_participants(session_id,player_id,status,ready_since) values(p_session_id,v_player,'READY',now()) returning id into v_participant;
 insert into public.participant_status_periods(session_participant_id,status) values(v_participant,'READY');
 perform public.append_session_event(p_session_id,'GUEST_CHECKED_IN','session_participant',v_participant,p_lease_id);
 return v_player;
end; $$;
notify pgrst, 'reload schema';
