import type { PageServerLoad } from './$types';
import { loadPublicSessionDetail } from '$lib/server/public-data';

export const load: PageServerLoad = async (event) => {
	return {
		initialDetail: await loadPublicSessionDetail(event, event.params.clubId, event.params.id),
		initialDataUpdatedAt: event.params.clubId === 'demo' ? 0 : Date.now()
	};
};
