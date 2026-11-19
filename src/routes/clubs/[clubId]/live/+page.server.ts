import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';
import type { Club, RosterPlayer } from '$lib/data/dashboard';
import { DEMO_CLUB_ID } from '$lib/features/demo/local-session';
import { localDemoClub, localDemoRoster } from '$lib/features/demo/local-store';

const emptyAccess = {
	userEmail: null,
	club: null,
	roster: [],
	authAccessState: 'idle' as const
};

export const load: PageServerLoad = async ({ cookies, params, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	if (params.clubId === DEMO_CLUB_ID)
		return {
			userEmail: 'demo@courtside.local',
			club: localDemoClub() as Club,
			roster: localDemoRoster() as RosterPlayer[],
			authAccessState: 'ready' as const
		};

	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key) return emptyAccess;

	const supabase = createServerClient(url, key, {
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					cookies.set(name, value, { ...options, path: '/' });
				});
				setHeaders(headers);
			}
		}
	});

	const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
	const claims = claimsError ? null : claimsData?.claims;
	const userId = typeof claims?.sub === 'string' ? claims.sub : null;
	if (!userId) return emptyAccess;

	const userEmail = typeof claims?.email === 'string' ? claims.email : null;
	const { data: clubRows, error: clubError } = await supabase.rpc('my_club');
	if (clubError) throw clubError;

	const club =
		((clubRows ?? []) as Club[]).find(
			(candidate) => candidate.id === params.clubId && candidate.is_club_admin
		) ?? null;
	if (!club) {
		return { userEmail, club: null, roster: [], authAccessState: 'denied' as const };
	}

	const { data: rosterRows, error: rosterError } = await supabase.rpc('club_roster', {
		p_club_id: club.id
	});
	if (rosterError) throw rosterError;

	return {
		userEmail,
		club,
		roster: (rosterRows ?? []) as RosterPlayer[],
		authAccessState: 'ready' as const
	};
};
