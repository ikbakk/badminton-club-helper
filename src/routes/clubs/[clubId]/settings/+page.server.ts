import type { PageServerLoad } from './$types';
import { loadClubSettingsPage } from '$lib/server/public-data';

export const load: PageServerLoad = async (event) => {
	const result = await loadClubSettingsPage(event, event.params.clubId);
	return {
		initialAccount: result.account,
		initialClubSettings: result.settings,
		initialDataUpdatedAt: Date.now()
	};
};
