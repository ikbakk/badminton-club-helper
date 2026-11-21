create function public.session_kok_match_lineups(p_session_id uuid)
returns table(match_id uuid, team_a text[], team_b text[])
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid;
begin
  select club_id into v_club from public.sessions where id = p_session_id;
  if v_club is null or auth.uid() is null or not public.is_club_admin(v_club) then
    raise exception 'Club Admin authority is required';
  end if;

  return query
    select m.id,
      coalesce(array_agg(distinct p.display_name order by p.display_name)
        filter (where sp.team = 'A'), '{}'::text[]) as team_a,
      coalesce(array_agg(distinct p.display_name order by p.display_name)
        filter (where sp.team = 'B'), '{}'::text[]) as team_b
    from public.matches m
    left join public.sets s on s.match_id = m.id
    left join public.set_players sp on sp.set_id = s.id
    left join public.players p on p.id = sp.player_id
    where m.session_id = p_session_id and m.status = 'COMPLETED'
    group by m.id, m.sequence_number
    order by m.sequence_number;
end;
$$;

revoke execute on function public.session_kok_match_lineups(uuid) from public, anon;
grant execute on function public.session_kok_match_lineups(uuid) to authenticated;
