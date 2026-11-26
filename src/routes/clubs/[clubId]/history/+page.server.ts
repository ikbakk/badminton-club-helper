import type { PageServerLoad } from './$types';
import { loadPublicClub, loadPublicHistory } from '$lib/server/public-data';

export const load: PageServerLoad = async (event) => {
	const [club, history] = await Promise.all([
		loadPublicClub(event, event.params.clubId),
		loadPublicHistory(event, event.params.clubId)
	]);
	return {
		initialHistory: { club, history },
		initialDataUpdatedAt: event.params.clubId === 'demo' ? 0 : Date.now()
	};
};
