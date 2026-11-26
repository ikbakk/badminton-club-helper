import type { PageServerLoad } from './$types';
import type { Club, RosterPlayer } from '$lib/data/dashboard';
import { DEMO_CLUB_ID } from '$lib/features/demo/local-session';
import { localDemoClub, localDemoRoster } from '$lib/features/demo/local-store';
import { loadLiveSnapshot, loadPublicHistory, loadPublicRoster } from '$lib/server/public-data';
import { createRequestSupabase } from '$lib/server/supabase';

const emptyAccess = {
	userEmail: null,
	club: null,
	roster: [],
	authAccessState: 'idle' as const
};

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const [{ initialPublicClub }, initialLiveSnapshot, initialHistory, initialRoster] =
		await Promise.all([
			event.parent(),
			loadLiveSnapshot(event, params.clubId),
			loadPublicHistory(event, params.clubId),
			loadPublicRoster(event, params.clubId)
		]);
	const initialPublic = { initialPublicClub, initialHistory, initialRoster };
	if (params.clubId === DEMO_CLUB_ID)
		return {
			userEmail: 'demo@courtside.local',
			club: localDemoClub() as Club,
			roster: localDemoRoster() as RosterPlayer[],
			authAccessState: 'ready' as const,
			...initialPublic,
			initialLiveSnapshot,
			initialDataUpdatedAt: 0
		};

	const supabase = createRequestSupabase(event);
	if (!supabase)
		return {
			...emptyAccess,
			...initialPublic,
			initialLiveSnapshot,
			initialDataUpdatedAt: Date.now()
		};

	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	const claims = claimsError ? null : claimsData?.claims;
	const userId = typeof claims?.sub === 'string' ? claims.sub : null;
	if (!userId)
		return {
			...emptyAccess,
			...initialPublic,
			initialLiveSnapshot,
			initialDataUpdatedAt: Date.now()
		};

	const userEmail = typeof claims?.email === 'string' ? claims.email : null;
	const { data: clubRows, error: clubError } = await supabase.rpc('my_club');
	if (clubError) throw clubError;

	const club =
		((clubRows ?? []) as Club[]).find(
			(candidate) => candidate.id === params.clubId && candidate.is_club_admin
		) ?? null;
	if (!club) {
		return {
			userEmail,
			club: null,
			roster: [],
			authAccessState: 'denied' as const,
			...initialPublic,
			initialLiveSnapshot,
			initialDataUpdatedAt: Date.now()
		};
	}

	const { data: rosterRows, error: rosterError } = await supabase.rpc('club_roster', {
		p_club_id: club.id
	});
	if (rosterError) throw rosterError;

	return {
		userEmail,
		club,
		roster: (rosterRows ?? []) as RosterPlayer[],
		authAccessState: 'ready' as const,
		...initialPublic,
		initialLiveSnapshot,
		initialDataUpdatedAt: Date.now()
	};
};
