import type { PageServerLoad } from './$types';
import { loadPublicSessionDetail } from '$lib/server/public-data';

export const load: PageServerLoad = async (event) => {
	const detail = await loadPublicSessionDetail(event, event.params.clubId, event.params.id);
	return {
		initialCloseInfo: {
			publicClub: detail.publicClub,
			session: detail.session,
			matchCount: detail.matches.length
		},
		initialDataUpdatedAt: event.params.clubId === 'demo' ? 0 : Date.now()
	};
};
