import type { PageLoad } from './$types';
import { loadLiveSession } from '$lib/data/live';

export const load: PageLoad = async () => {
	try {
		return { live: await loadLiveSession() };
	} catch (error) {
		return {
			live: { session: null, participants: [] },
			loadError: error instanceof Error ? error.message : 'Could not load the live session.'
		};
	}
};
