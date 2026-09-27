-- Courtside commands are the only mutation surface for anonymous session operators.
-- They validate the opaque lease on every transition and keep status periods/events atomic.

create or replace function public.start_match(
  p_session_id uuid, p_lease_id uuid, p_team_a uuid[], p_team_b uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_match uuid; v_sequence integer; v_player uuid;
begin
  if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
  if cardinality(p_team_a) <> 2 or cardinality(p_team_b) <> 2
     or cardinality(array(select distinct unnest(p_team_a || p_team_b))) <> 4 then
    raise exception 'Choose exactly four distinct players in two teams';
  end if;
  if exists(select 1 from public.matches where session_id=p_session_id and status='IN_PROGRESS') then
    raise exception 'A match is already in progress';
  end if;
  if exists(
    select 1 from unnest(p_team_a || p_team_b) id
    where not exists(select 1 from public.session_participants sp where sp.session_id=p_session_id and sp.player_id=id and sp.status='READY')
  ) then raise exception 'Every selected player must be READY'; end if;
  select coalesce(max(sequence_number),0)+1 into v_sequence from public.matches where session_id=p_session_id;
  insert into public.matches(session_id,sequence_number,status,started_at) values(p_session_id,v_sequence,'IN_PROGRESS',now()) returning id into v_match;
  insert into public.sets(match_id,set_number,status,started_at) values(v_match,1,'IN_PROGRESS',now());
  insert into public.set_players(set_id,player_id,team)
  select s.id, id, 'A' from public.sets s cross join unnest(p_team_a) id where s.match_id=v_match and s.set_number=1
  union all
  select s.id, id, 'B' from public.sets s cross join unnest(p_team_b) id where s.match_id=v_match and s.set_number=1;
  foreach v_player in array p_team_a || p_team_b loop
    update public.session_participants set status='PLAYING',ready_since=null,updated_at=now() where session_id=p_session_id and player_id=v_player;
    update public.participant_status_periods set ended_at=now() where session_participant_id=(select id from public.session_participants where session_id=p_session_id and player_id=v_player) and ended_at is null;
    insert into public.participant_status_periods(session_participant_id,status) select id,'PLAYING' from public.session_participants where session_id=p_session_id and player_id=v_player;
  end loop;
  perform public.append_session_event(p_session_id,'MATCH_STARTED','match',v_match,p_lease_id,jsonb_build_object('sequence',v_sequence));
  return v_match;
end; $$;

create or replace function public.complete_set(
  p_session_id uuid, p_lease_id uuid, p_team_a_score smallint, p_team_b_score smallint
) returns text language plpgsql security definer set search_path = '' as $$
declare v_match uuid; v_set public.sets%rowtype; v_player record; v_next_set uuid;
begin
  if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
  if p_team_a_score < 0 or p_team_b_score < 0 or p_team_a_score = p_team_b_score or greatest(p_team_a_score,p_team_b_score) > 99 then raise exception 'Enter valid, non-tied set scores'; end if;
  select m.id into v_match from public.matches m where m.session_id=p_session_id and m.status='IN_PROGRESS' for update;
  if v_match is null then raise exception 'No match is in progress'; end if;
  select * into v_set from public.sets where match_id=v_match and status='IN_PROGRESS' for update;
  update public.sets set status='COMPLETED',team_a_score=p_team_a_score,team_b_score=p_team_b_score,completed_at=now() where id=v_set.id;
  if v_set.set_number=1 then
    insert into public.sets(match_id,set_number,status,started_at) values(v_match,2,'IN_PROGRESS',now()) returning id into v_next_set;
    insert into public.set_players(set_id,player_id,team) select v_next_set,player_id,team from public.set_players where set_id=v_set.id;
    perform public.append_session_event(p_session_id,'SET_COMPLETED','set',v_set.id,p_lease_id,jsonb_build_object('set',1,'a',p_team_a_score,'b',p_team_b_score));
    return 'SET_2';
  end if;
  update public.matches set status='COMPLETED',completed_at=now() where id=v_match;
  for v_player in select sp.id,sp.player_id,sp.leave_after_match from public.session_participants sp where sp.session_id=p_session_id and sp.status='PLAYING' loop
    update public.session_participants set status=case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end, ready_since=case when v_player.leave_after_match then null else now() end,left_at=case when v_player.leave_after_match then now() else left_at end,updated_at=now() where id=v_player.id;
    update public.participant_status_periods set ended_at=now() where session_participant_id=v_player.id and ended_at is null;
    insert into public.participant_status_periods(session_participant_id,status) values(v_player.id,case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end);
  end loop;
  perform public.append_session_event(p_session_id,'MATCH_COMPLETED','match',v_match,p_lease_id,jsonb_build_object('set',2,'a',p_team_a_score,'b',p_team_b_score));
  return 'MATCH_COMPLETED';
end; $$;

create or replace function public.substitute_player(
  p_session_id uuid, p_lease_id uuid, p_outgoing_player_id uuid, p_replacement_player_id uuid, p_outgoing_status public.participant_status default 'RESTING'
) returns void language plpgsql security definer set search_path = '' as $$
declare v_match uuid; v_set uuid; v_out public.session_participants%rowtype; v_in public.session_participants%rowtype;
begin
  if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
  if p_outgoing_status not in ('RESTING','OUT','LEFT') then raise exception 'Choose RESTING, OUT, or LEFT for the outgoing player'; end if;
  select m.id into v_match from public.matches m join public.sets s on s.match_id=m.id where m.session_id=p_session_id and m.status='IN_PROGRESS' and s.set_number=1 and s.status='COMPLETED';
  if v_match is null then raise exception 'Substitution is available only between Set 1 and Set 2'; end if;
  select s.id into v_set from public.sets s where s.match_id=v_match and s.set_number=2 and s.status='IN_PROGRESS';
  select * into v_out from public.session_participants where session_id=p_session_id and player_id=p_outgoing_player_id and status='PLAYING' for update;
  select * into v_in from public.session_participants where session_id=p_session_id and player_id=p_replacement_player_id and status='READY' for update;
  if v_out.id is null or v_in.id is null or not exists(select 1 from public.set_players where set_id=v_set and player_id=p_outgoing_player_id) then raise exception 'Choose a playing player and a READY replacement'; end if;
  update public.set_players set player_id=p_replacement_player_id where set_id=v_set and player_id=p_outgoing_player_id;
  update public.session_participants set status=p_outgoing_status,ready_since=null,left_at=case when p_outgoing_status='LEFT' then now() else left_at end,updated_at=now() where id=v_out.id;
  update public.session_participants set status='PLAYING',ready_since=null,updated_at=now() where id=v_in.id;
  update public.participant_status_periods set ended_at=now() where session_participant_id in (v_out.id,v_in.id) and ended_at is null;
  insert into public.participant_status_periods(session_participant_id,status) values(v_out.id,p_outgoing_status),(v_in.id,'PLAYING');
  perform public.append_session_event(p_session_id,'PLAYER_SUBSTITUTED','match',v_match,p_lease_id,jsonb_build_object('outgoing',p_outgoing_player_id,'replacement',p_replacement_player_id));
end; $$;

create or replace function public.abandon_match(p_session_id uuid,p_lease_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_match uuid; v_player record;
begin
  if not public.valid_operator_lease(p_session_id,p_lease_id) then raise exception 'Valid operator lease required'; end if;
  select id into v_match from public.matches where session_id=p_session_id and status='IN_PROGRESS' for update;
  if v_match is null then raise exception 'No match is in progress'; end if;
  update public.matches set status='ABANDONED',completed_at=now() where id=v_match;
  update public.sets set status='ABANDONED',completed_at=now() where match_id=v_match and status='IN_PROGRESS';
  for v_player in select id,leave_after_match from public.session_participants where session_id=p_session_id and status='PLAYING' loop
    update public.session_participants set status=case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end,ready_since=case when v_player.leave_after_match then null else now() end,updated_at=now() where id=v_player.id;
    update public.participant_status_periods set ended_at=now() where session_participant_id=v_player.id and ended_at is null;
    insert into public.participant_status_periods(session_participant_id,status) values(v_player.id,case when v_player.leave_after_match then 'LEFT'::public.participant_status else 'READY'::public.participant_status end);
  end loop;
  perform public.append_session_event(p_session_id,'MATCH_ABANDONED','match',v_match,p_lease_id);
end; $$;

-- Deliberately public-safe projection, matching the existing live_session views.
create or replace view public.live_active_match as
select m.id,m.session_id,m.sequence_number,m.status,
  coalesce(jsonb_agg(jsonb_build_object('setNumber',s.set_number,'status',s.status,'teamAScore',s.team_a_score,'teamBScore',s.team_b_score,'players',(select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'team',sp.team)) from public.set_players sp join public.players p on p.id=sp.player_id where sp.set_id=s.id)) order by s.set_number) filter (where s.id is not null),'[]'::jsonb) as sets
from public.matches m left join public.sets s on s.match_id=m.id
where m.status='IN_PROGRESS' group by m.id;

grant select on public.live_active_match to anon,authenticated;
grant execute on function public.start_match(uuid,uuid,uuid[],uuid[]),public.complete_set(uuid,uuid,smallint,smallint),public.substitute_player(uuid,uuid,uuid,uuid,public.participant_status),public.abandon_match(uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
