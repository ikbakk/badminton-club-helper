import { createRequestSupabase } from '$lib/server/supabase';
import type { RosterPlayer } from '$lib/data/dashboard';
import type { PageServerLoad } from './$types';
import { loadPublicClub, loadPublicRoster } from '$lib/server/public-data';

export const load: PageServerLoad = async (event) => {
	const [publicClub, roster] = await Promise.all([
		loadPublicClub(event, event.params.clubId),
		loadPublicRoster(event, event.params.clubId)
	]);
	const { clubAccess } = await event.parent();
	const supabase =
		clubAccess?.is_club_admin && event.params.clubId !== 'demo'
			? createRequestSupabase(event)
			: null;
	const adminRows = await supabase?.rpc('club_roster', { p_club_id: event.params.clubId });
	if (adminRows?.error) throw adminRows.error;

	return {
		initialAdminRoster: adminRows?.data as RosterPlayer[] | undefined,
		initialRoster: { publicClub, roster },
		initialDataUpdatedAt: event.params.clubId === 'demo' ? 0 : Date.now()
	};
};
