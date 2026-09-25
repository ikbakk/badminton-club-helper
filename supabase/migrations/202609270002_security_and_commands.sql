-- Public reads are deliberately restricted to safe projections. All command functions
-- execute state transitions atomically and validate the active operator lease.
create or replace function public.is_club_admin(p_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from club_roles where club_id=p_club_id and user_id=auth.uid() and role='CLUB_ADMIN');
$$;

create or replace function public.valid_operator_lease(p_session_id uuid, p_lease_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from session_operator_leases where id=p_lease_id and session_id=p_session_id and revoked_at is null)
 and exists(select 1 from sessions where id=p_session_id and status='LIVE');
$$;

create or replace function public.append_session_event(p_session_id uuid, p_type text, p_entity_type text default null, p_entity_id uuid default null, p_lease_id uuid default null, p_metadata jsonb default null)
returns void language sql security definer set search_path = public as $$
 insert into session_events(session_id,event_type,entity_type,entity_id,actor_user_id,actor_operator_lease_id,metadata)
 values(p_session_id,p_type,p_entity_type,p_entity_id,auth.uid(),p_lease_id,p_metadata);
$$;

create or replace function public.start_session(p_club_id uuid, p_pin text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_session uuid;
begin
 if not public.is_club_admin(p_club_id) then raise exception 'Club Admin authority is required'; end if;
 if length(p_pin) < 4 then raise exception 'PIN must contain at least 4 characters'; end if;
 insert into sessions(club_id,created_by_user_id) values(p_club_id,auth.uid()) returning id into v_session;
 insert into session_operator_credentials(session_id,pin_hash) values(v_session,crypt(p_pin,gen_salt('bf')));
 perform public.append_session_event(v_session,'SESSION_STARTED');
 return v_session;
end; $$;

create or replace function public.claim_operator_lease(p_session_id uuid, p_pin text, p_device_id text, p_takeover boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lease uuid; v_old uuid;
begin
 if not exists(select 1 from session_operator_credentials where session_id=p_session_id and pin_hash=crypt(p_pin,pin_hash)) then raise exception 'Invalid session PIN'; end if;
 select id into v_old from session_operator_leases where session_id=p_session_id and revoked_at is null for update;
 if v_old is not null and not p_takeover then raise exception 'Another device currently controls this session'; end if;
 if v_old is not null then update session_operator_leases set revoked_at=now() where id=v_old; end if;
 insert into session_operator_leases(session_id,device_id) values(p_session_id,p_device_id) returning id into v_lease;
 perform public.append_session_event(p_session_id,case when v_old is null then 'OPERATOR_LEASE_CLAIMED' else 'OPERATOR_LEASE_TAKEN_OVER' end,null,null,v_lease);
 return v_lease;
end; $$;

create or replace function public.check_in_player(p_session_id uuid, p_lease_id uuid, p_player_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_participant uuid;
begin
 if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
 insert into session_participants(session_id,player_id,status,ready_since) values(p_session_id,p_player_id,'READY',now())
 on conflict(session_id,player_id) do update set status='READY',ready_since=now(),updated_at=now() returning id into v_participant;
 update participant_status_periods set ended_at=now() where session_participant_id=v_participant and ended_at is null;
 insert into participant_status_periods(session_participant_id,status) values(v_participant,'READY');
 perform public.append_session_event(p_session_id,'PLAYER_CHECKED_IN','session_participant',v_participant,p_lease_id);
 return v_participant;
end; $$;

create or replace function public.change_participant_status(p_session_id uuid, p_lease_id uuid, p_participant_id uuid, p_status participant_status)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
 if p_status='PLAYING' then raise exception 'PLAYING is controlled only by match commands'; end if;
 update session_participants set status=p_status,ready_since=case when p_status='READY' then now() else null end,left_at=case when p_status='LEFT' then now() else left_at end,updated_at=now() where id=p_participant_id and session_id=p_session_id;
 if not found then raise exception 'Participant not found'; end if;
 update participant_status_periods set ended_at=now() where session_participant_id=p_participant_id and ended_at is null;
 insert into participant_status_periods(session_participant_id,status) values(p_participant_id,p_status);
 perform public.append_session_event(p_session_id,'PLAYER_STATUS_CHANGED','session_participant',p_participant_id,p_lease_id,jsonb_build_object('status',p_status));
end; $$;

-- Enable RLS broadly: direct browser access is denied. Views below are the sole public surface.
alter table clubs enable row level security; alter table club_roles enable row level security; alter table players enable row level security; alter table player_ratings enable row level security; alter table player_rating_history enable row level security; alter table sessions enable row level security; alter table session_participants enable row level security; alter table participant_status_periods enable row level security; alter table matches enable row level security; alter table sets enable row level security; alter table set_players enable row level security; alter table rotation_recommendations enable row level security; alter table rotation_candidate_scores enable row level security; alter table pairing_recommendations enable row level security; alter table pairing_recommendation_players enable row level security; alter table session_obligations enable row level security; alter table payments enable row level security; alter table payment_allocations enable row level security; alter table expenses enable row level security; alter table finance_submissions enable row level security; alter table session_operator_credentials enable row level security; alter table session_operator_leases enable row level security; alter table session_events enable row level security;

create or replace view public.live_session as select id,club_id,status,started_at,closed_at from sessions where status='LIVE';
create or replace view public.live_participants as select sp.id as participant_id,sp.session_id,p.id as player_id,p.display_name,p.membership_type,sp.status,sp.ready_since,sp.leave_after_match,pr.rating,pr.uncertainty from session_participants sp join sessions s on s.id=sp.session_id and s.status='LIVE' join players p on p.id=sp.player_id join player_ratings pr on pr.player_id=p.id;
create or replace view public.public_session_history as select s.id,s.started_at,s.closed_at,s.fee_per_person,count(sp.id)::int as attendance from sessions s left join session_participants sp on sp.session_id=s.id group by s.id;
create or replace view public.public_fund_summary as select coalesce(sum(p.amount),0)::bigint as received,coalesce((select sum(amount) from expenses),0)::bigint as expenses,coalesce(sum(p.amount),0)::bigint-coalesce((select sum(amount) from expenses),0)::bigint as balance from payments p;
grant select on public.live_session,public.live_participants,public.public_session_history,public.public_fund_summary to anon,authenticated;
grant execute on function public.start_session(uuid,text), public.claim_operator_lease(uuid,text,text,boolean), public.check_in_player(uuid,uuid,uuid), public.change_participant_status(uuid,uuid,uuid,participant_status) to anon,authenticated;
