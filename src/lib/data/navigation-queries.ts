import { browserQueryClient, publicSurfaceKey } from './query-client';
import {
	getPublicClub,
	getPublicRoster,
	getPublicSessionHistory,
	getPublicFundSummary,
	getPublicFundActivity
} from './dashboard';
import { liveSessionQueryKey, loadClubLiveSession } from './live';

export function rosterOptions(clubId: string) {
	return {
		queryKey: publicSurfaceKey(clubId, 'roster'),
		meta: { navigationCritical: true },
		retry: false as const,
		queryFn: async () => {
			const publicClub = await getPublicClub(clubId);
			return { publicClub, roster: publicClub ? await getPublicRoster(clubId) : [] };
		}
	};
}
export function historyOptions(clubId: string) {
	return {
		queryKey: publicSurfaceKey(clubId, 'history'),
		meta: { navigationCritical: true },
		retry: false as const,
		queryFn: async () => {
			const [club, history] = await Promise.all([
				getPublicClub(clubId),
				getPublicSessionHistory(clubId)
			]);
			return { club, history: history.filter((session) => session.closed_at) };
		}
	};
}
export function fundOptions(clubId: string) {
	return {
		queryKey: publicSurfaceKey(clubId, 'fund'),
		meta: { navigationCritical: true },
		retry: false as const,
		queryFn: async () => {
			const [club, summary, activity] = await Promise.all([
				getPublicClub(clubId),
				getPublicFundSummary(clubId),
				getPublicFundActivity(clubId)
			]);
			return { club, summary, activity };
		}
	};
}
export function liveOptions(clubId: string) {
	return {
		queryKey: [...liveSessionQueryKey, clubId],
		meta: { navigationCritical: true },
		queryFn: () => loadClubLiveSession(clubId),
		staleTime: 15_000
	};
}
export function prefetchNavigation(url: URL) {
	const match = url.pathname.match(/\/clubs\/([^/]+)\/(live|players|history|fund)\/?$/);
	if (!match) return Promise.resolve();
	const [, clubId, route] = match;
	const options =
		route === 'live'
			? liveOptions(clubId)
			: route === 'players'
				? rosterOptions(clubId)
				: route === 'history'
					? historyOptions(clubId)
					: fundOptions(clubId);
	// The key and function match the observer; fetchQuery deduplicates in-flight work.
	return browserQueryClient.prefetchQuery(
		options as Parameters<typeof browserQueryClient.prefetchQuery>[0]
	);
}
