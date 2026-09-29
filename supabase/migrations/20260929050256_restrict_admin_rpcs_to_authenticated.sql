-- These functions are only useful to signed-in Club Admins and must not retain
-- a legacy anon grant from an earlier broad command grant.
revoke execute on function public.bootstrap_first_club(text),
  public.add_roster_player(uuid, text, public.membership_type),
  public.start_session(uuid, text),
  public.my_club(),
  public.club_roster(uuid)
from anon;

notify pgrst, 'reload schema';
