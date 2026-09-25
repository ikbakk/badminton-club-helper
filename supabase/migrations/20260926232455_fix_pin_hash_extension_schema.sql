create or replace function public.start_session(p_club_id uuid, p_pin text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session uuid;
begin
 if not public.is_club_admin(p_club_id) then raise exception 'Club Admin authority is required'; end if;
 if length(p_pin) < 4 then raise exception 'PIN must contain at least 4 characters'; end if;
 insert into public.sessions(club_id,created_by_user_id) values(p_club_id,auth.uid()) returning id into v_session;
 insert into public.session_operator_credentials(session_id,pin_hash) values(v_session,extensions.crypt(p_pin,extensions.gen_salt('bf')));
 perform public.append_session_event(v_session,'SESSION_STARTED');
 return v_session;
end; $$;
create or replace function public.claim_operator_lease(p_session_id uuid, p_pin text, p_device_id text, p_takeover boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lease uuid; v_old uuid;
begin
 if not exists(select 1 from public.session_operator_credentials where session_id=p_session_id and pin_hash=extensions.crypt(p_pin,pin_hash)) then raise exception 'Invalid session PIN'; end if;
 select id into v_old from public.session_operator_leases where session_id=p_session_id and revoked_at is null for update;
 if v_old is not null and not p_takeover then raise exception 'Another device currently controls this session'; end if;
 if v_old is not null then update public.session_operator_leases set revoked_at=now() where id=v_old; end if;
 insert into public.session_operator_leases(session_id,device_id) values(p_session_id,p_device_id) returning id into v_lease;
 perform public.append_session_event(p_session_id,case when v_old is null then 'OPERATOR_LEASE_CLAIMED' else 'OPERATOR_LEASE_TAKEN_OVER' end,null,null,v_lease);
 return v_lease;
end; $$;
notify pgrst, 'reload schema';
