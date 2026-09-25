create or replace function public.my_club()
returns table(id uuid, name text, is_club_admin boolean, is_finance_admin boolean)
language sql stable security definer set search_path = '' as $$
 select c.id,c.name,
   exists(select 1 from public.club_roles r where r.club_id=c.id and r.user_id=auth.uid() and r.role='CLUB_ADMIN'),
   exists(select 1 from public.club_roles r where r.club_id=c.id and r.user_id=auth.uid() and r.role='FINANCE_ADMIN')
 from public.clubs c
 where exists(select 1 from public.club_roles r where r.club_id=c.id and r.user_id=auth.uid());
$$;
create or replace function public.club_roster(p_club_id uuid)
returns table(id uuid, display_name text, membership_type public.membership_type, rating numeric, uncertainty numeric)
language sql stable security definer set search_path = '' as $$
 select p.id,p.display_name,p.membership_type,pr.rating,pr.uncertainty
 from public.players p join public.player_ratings pr on pr.player_id=p.id
 where p.club_id=p_club_id and p.is_active and public.is_club_admin(p_club_id)
 order by p.membership_type,p.display_name;
$$;
grant execute on function public.my_club(),public.club_roster(uuid) to authenticated;
