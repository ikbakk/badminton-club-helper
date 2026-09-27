create or replace function public.add_guest_and_check_in(p_session_id uuid,p_lease_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_player uuid; v_participant uuid;
begin
 if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
 if length(trim(p_name))<1 then raise exception 'Guest name is required'; end if;
 select club_id into v_club from public.sessions where id=p_session_id;
 insert into public.players(club_id,display_name,membership_type) values(v_club,trim(p_name),'GUEST') returning id into v_player;
 insert into public.player_ratings(player_id) values(v_player,1200,0.7);
 insert into public.session_participants(session_id,player_id,status,ready_since) values(p_session_id,v_player,'READY',now()) returning id into v_participant;
 insert into public.participant_status_periods(session_participant_id,status) values(v_participant,'READY');
 perform public.append_session_event(p_session_id,'GUEST_CHECKED_IN','session_participant',v_participant,p_lease_id);
 return v_player;
end; $$;

create or replace function public.close_session(p_session_id uuid,p_lease_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attendance integer; v_sets integer; v_started timestamptz;
begin
 if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
 if exists(select 1 from public.matches where session_id=p_session_id and status='IN_PROGRESS') then raise exception 'Complete or abandon the active match before ending the session'; end if;
 select started_at into v_started from public.sessions where id=p_session_id for update;
 update public.sessions set status='CLOSED',closed_at=now() where id=p_session_id;
 update public.session_participants set status='LEFT',left_at=coalesce(left_at,now()),ready_since=null,updated_at=now() where session_id=p_session_id and status <> 'LEFT';
 update public.participant_status_periods p set ended_at=now() where p.ended_at is null and exists(select 1 from public.session_participants sp where sp.id=p.session_participant_id and sp.session_id=p_session_id);
 select count(*) into v_attendance from public.session_participants where session_id=p_session_id;
 select count(*) into v_sets from public.sets s join public.matches m on m.id=s.match_id where m.session_id=p_session_id and s.status='COMPLETED';
 perform public.append_session_event(p_session_id,'SESSION_CLOSED','session',p_session_id,p_lease_id);
 return jsonb_build_object('attendance',v_attendance,'sets',v_sets,'startedAt',v_started);
end; $$;

create or replace function public.confirm_session_fee(p_session_id uuid,p_lease_id uuid,p_fee integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
 if not exists(select 1 from public.session_operator_leases where id=p_lease_id and session_id=p_session_id and revoked_at is null) then raise exception 'Valid operator lease required'; end if;
 if p_fee <= 0 then raise exception 'Fee must be greater than zero'; end if;
 update public.sessions set fee_per_person=p_fee where id=p_session_id and status='CLOSED' and fee_per_person is null;
 if not found then raise exception 'Session fee is already confirmed or session is not closed'; end if;
 insert into public.session_obligations(session_id,player_id,amount) select p_session_id,player_id,p_fee from public.session_participants where session_id=p_session_id;
 get diagnostics v_count = row_count;
 perform public.append_session_event(p_session_id,'SESSION_FEE_CONFIRMED','session',p_session_id,p_lease_id,jsonb_build_object('fee',p_fee,'attendees',v_count));
 return v_count;
end; $$;

grant execute on function public.add_guest_and_check_in(uuid,uuid,text),public.close_session(uuid,uuid),public.confirm_session_fee(uuid,uuid,integer) to anon,authenticated;
notify pgrst,'reload schema';
