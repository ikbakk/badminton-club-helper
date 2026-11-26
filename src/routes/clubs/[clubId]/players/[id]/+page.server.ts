import type { PageServerLoad } from './$types';
import { loadPublicPlayer, loadPublicPlayerSummaries } from '$lib/server/public-data';

export const load: PageServerLoad = async (event) => {
	const clubId = event.params.clubId;
	const playerId = event.params.id;
	const [profile, summaries] = await Promise.all([
		loadPublicPlayer(event, clubId, playerId),
		loadPublicPlayerSummaries(event, clubId, playerId)
	]);
	return {
		initialPlayer: profile,
		initialSummaries: summaries,
		initialDataUpdatedAt: clubId === 'demo' ? 0 : Date.now()
	};
};
