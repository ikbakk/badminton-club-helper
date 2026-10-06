-- Trusted server commands read authoritative state using service_role before
-- submitting the guarded SECURITY DEFINER mutation RPCs.  Table access stays
-- unavailable to browser roles; service_role is never exposed client-side.
grant select on table public.club_roles, public.players, public.sessions,
  public.matches, public.sets, public.set_players, public.player_ratings,
  public.player_rating_history to service_role;
