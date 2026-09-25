create or replace view public.public_club_profile as
select id,name,logo_path from public.clubs;
create or replace view public.public_member_roster as
select p.id,p.club_id,p.display_name,p.membership_type
from public.players p where p.is_active and p.membership_type='MEMBER';
grant select on public.public_club_profile,public.public_member_roster to anon,authenticated;
