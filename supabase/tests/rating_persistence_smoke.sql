-- Execute with: set -a; source .env; set +a; npx supabase db query --linked --file supabase/tests/rating_persistence_smoke.sql
-- Fixtures and every assertion are rolled back.
begin;
do $smoke$
declare
  c uuid := gen_random_uuid(); s uuid := gen_random_uuid(); m uuid := gen_random_uuid(); set1 uuid := gen_random_uuid();
  p uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  set2 uuid; before_b numeric; history_count integer;
begin
  insert into public.clubs(id,name) values(c,'RATING-SMOKE');
  insert into public.players(id,club_id,display_name,membership_type)
  select id,c,'RATING-SMOKE-'||n,'MEMBER' from unnest(p) with ordinality x(id,n);
  foreach set2 in array p loop perform public.initialize_algorithm_2_rating(set2); end loop;
  insert into public.sessions(id,club_id,status,started_at) values(s,c,'LIVE',now());
  insert into public.session_participants(session_id,player_id,status) select s,id,'PLAYING' from unnest(p) id;
  insert into public.matches(id,session_id,sequence_number,status,started_at) values(m,s,1,'IN_PROGRESS',now());
  insert into public.sets(id,match_id,set_number,status,started_at) values(set1,m,1,'IN_PROGRESS',now());
  insert into public.set_players(set_id,player_id,team) values(set1,p[1],'A'),(set1,p[2],'A'),(set1,p[3],'B'),(set1,p[4],'B');
  perform public.commit_algorithm_2_completed_set(s,21::smallint,17::smallint,
    jsonb_build_array(jsonb_build_object('player_id',p[1],'revision',0,'rating',1200,'uncertainty',280),jsonb_build_object('player_id',p[2],'revision',0,'rating',1200,'uncertainty',280),jsonb_build_object('player_id',p[3],'revision',0,'rating',1200,'uncertainty',280),jsonb_build_object('player_id',p[4],'revision',0,'rating',1200,'uncertainty',280)),
    jsonb_build_array(jsonb_build_object('player_id',p[1],'rating_before',1200,'rating_after',1209.9,'uncertainty_before',280,'uncertainty_after',263.2),jsonb_build_object('player_id',p[2],'rating_before',1200,'rating_after',1209.9,'uncertainty_before',280,'uncertainty_after',263.2),jsonb_build_object('player_id',p[3],'rating_before',1200,'rating_after',1190.1,'uncertainty_before',280,'uncertainty_after',263.2),jsonb_build_object('player_id',p[4],'rating_before',1200,'rating_after',1190.1,'uncertainty_before',280,'uncertainty_after',263.2)));
  select count(*) into history_count from public.player_rating_history where set_id=set1 and source='SET_RESULT';
  if history_count<>4 or not exists(select 1 from public.sets where id=set1 and rating_algorithm_version='trueskill-style-bounded-margin-v1') then raise exception 'first set persistence failed'; end if;
  -- Set 2 substitution is authoritative: B never receives this result; E does.
  select id into set2 from public.sets where match_id=m and set_number=2;
  update public.set_players set player_id=p[5] where set_id=set2 and player_id=p[2];
  select rating into before_b from public.player_ratings where player_id=p[2];
  perform public.commit_algorithm_2_completed_set(s,21::smallint,18::smallint,
    jsonb_build_array(jsonb_build_object('player_id',p[1],'revision',1,'rating',1209.9,'uncertainty',263.2),jsonb_build_object('player_id',p[5],'revision',0,'rating',1200,'uncertainty',280),jsonb_build_object('player_id',p[3],'revision',1,'rating',1190.1,'uncertainty',263.2),jsonb_build_object('player_id',p[4],'revision',1,'rating',1190.1,'uncertainty',263.2)),
    jsonb_build_array(jsonb_build_object('player_id',p[1],'rating_before',1209.9,'rating_after',1210.9,'uncertainty_before',263.2,'uncertainty_after',247.408),jsonb_build_object('player_id',p[5],'rating_before',1200,'rating_after',1201,'uncertainty_before',280,'uncertainty_after',263.2),jsonb_build_object('player_id',p[3],'rating_before',1190.1,'rating_after',1189.1,'uncertainty_before',263.2,'uncertainty_after',247.408),jsonb_build_object('player_id',p[4],'rating_before',1190.1,'rating_after',1189.1,'uncertainty_before',263.2,'uncertainty_after',247.408)));
  if exists(select 1 from public.player_rating_history where set_id=set2 and player_id=p[2]) or not exists(select 1 from public.player_rating_history where set_id=set2 and player_id=p[5]) or (select rating from public.player_ratings where player_id=p[2])<>before_b then raise exception 'substitution authority failed'; end if;
  -- A completed set cannot be rated a second time because it is no longer IN_PROGRESS.
  begin
    perform public.commit_algorithm_2_completed_set(s,21::smallint,17::smallint,'[]','[]');
    raise exception 'retry unexpectedly accepted';
  exception when others then
    if sqlerrm='retry unexpectedly accepted' then raise; end if;
  end;
  if (select count(*) from public.player_rating_history where source='SET_RESULT' and set_id in(set1,set2))<>8 then raise exception 'retry duplicated rating effect'; end if;
  -- Replay replaces, rather than inversely patches, the full explicit V1 timeline.
  perform public.commit_algorithm_2_replay(c,set1,21::smallint,16::smallint,
    (select jsonb_agg(jsonb_build_object('player_id',player_id,'revision',revision)) from public.player_ratings where player_id=any(p)),
    (select jsonb_agg(jsonb_build_object('player_id',player_id,'set_id',set_id,'rating_before',rating_before,'rating_after',rating_after,'uncertainty_before',uncertainty_before,'uncertainty_after',uncertainty_after,'is_current',(set_id=set2 or (set_id=set1 and player_id=p[2])))) from public.player_rating_history where source='SET_RESULT' and set_id in(set1,set2)));
  if (select team_b_score from public.sets where id=set1)<>16 or (select count(*) from public.player_rating_history where source='SET_RESULT' and set_id in(set1,set2))<>8 then raise exception 'replay replacement failed'; end if;
  if has_function_privilege('authenticated','public.commit_algorithm_2_completed_set(uuid,smallint,smallint,jsonb,jsonb)','EXECUTE') then raise exception 'browser can call trusted rating commit'; end if;
end $smoke$;
rollback;

-- Separate transaction-scoped late-failure proof: the temporary trigger fires
-- when the command updates current ratings, after its SET_RESULT insert.
begin;
do $rollback$
declare c uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); st uuid:=gen_random_uuid(); p uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()]; x uuid; before_state jsonb; after_state jsonb;
begin
 insert into public.clubs(id,name) values(c,'RATING-ROLLBACK-SMOKE');
 insert into public.players(id,club_id,display_name,membership_type) select player_id,c,'RATING-ROLLBACK-'||n,'GUEST' from unnest(p) with ordinality as q(player_id,n);
 foreach x in array p loop perform public.initialize_algorithm_2_rating(x); end loop;
 insert into public.sessions(id,club_id,status) values(s,c,'LIVE'); insert into public.matches(id,session_id,sequence_number,status) values(m,s,1,'IN_PROGRESS'); insert into public.sets(id,match_id,set_number,status) values(st,m,1,'IN_PROGRESS');
 insert into public.set_players values(st,p[1],'A'),(st,p[2],'A'),(st,p[3],'B'),(st,p[4],'B');
 select jsonb_build_object('set',(select to_jsonb(z) from (select status,team_a_score,team_b_score from public.sets where id=st) z),'ratings',(select jsonb_agg(to_jsonb(r) order by player_id) from (select player_id,rating,uncertainty,revision from public.player_ratings where player_id=any(p)) r),'history',(select count(*) from public.player_rating_history where player_id=any(p))) into before_state;
 create function public.rating_rollback_smoke_trigger() returns trigger language plpgsql as $$begin raise exception 'forced rating rollback'; end$$;
 create trigger rating_rollback_smoke before update on public.player_ratings for each row execute function public.rating_rollback_smoke_trigger();
 begin
  perform public.commit_algorithm_2_completed_set(s,21::smallint,17::smallint,jsonb_build_array(jsonb_build_object('player_id',p[1],'revision',0,'rating',1200,'uncertainty',280),jsonb_build_object('player_id',p[2],'revision',0,'rating',1200,'uncertainty',280),jsonb_build_object('player_id',p[3],'revision',0,'rating',1200,'uncertainty',280),jsonb_build_object('player_id',p[4],'revision',0,'rating',1200,'uncertainty',280)),jsonb_build_array(jsonb_build_object('player_id',p[1],'rating_before',1200,'rating_after',1209.9,'uncertainty_before',280,'uncertainty_after',263.2),jsonb_build_object('player_id',p[2],'rating_before',1200,'rating_after',1209.9,'uncertainty_before',280,'uncertainty_after',263.2),jsonb_build_object('player_id',p[3],'rating_before',1200,'rating_after',1190.1,'uncertainty_before',280,'uncertainty_after',263.2),jsonb_build_object('player_id',p[4],'rating_before',1200,'rating_after',1190.1,'uncertainty_before',280,'uncertainty_after',263.2)));
  raise exception 'forced rollback did not fire';
 exception when others then if sqlerrm='forced rollback did not fire' then raise; end if; end;
 drop trigger rating_rollback_smoke on public.player_ratings; drop function public.rating_rollback_smoke_trigger();
 select jsonb_build_object('set',(select to_jsonb(z) from (select status,team_a_score,team_b_score from public.sets where id=st) z),'ratings',(select jsonb_agg(to_jsonb(r) order by player_id) from (select player_id,rating,uncertainty,revision from public.player_ratings where player_id=any(p)) r),'history',(select count(*) from public.player_rating_history where player_id=any(p))) into after_state;
 if before_state<>after_state then raise exception 'partial rating transaction survived forced failure'; end if;
end $rollback$;
rollback;
