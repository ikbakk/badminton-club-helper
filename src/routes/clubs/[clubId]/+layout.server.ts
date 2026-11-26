import { createRequestSupabase } from '$lib/server/supabase';
import { isDemoClub, localDemoClub } from '$lib/features/demo/local-store';
import type { Club } from '$lib/data/dashboard';
import type { LayoutServerLoad } from './$types';
import { loadPublicClub } from '$lib/server/public-data';

export const load: LayoutServerLoad = async (event) => {
	event.setHeaders({ 'cache-control': 'private, no-store' });
	const clubId = event.params.clubId;
	const [initialPublicClub, clubAccess] = await Promise.all([
		loadPublicClub(event, clubId),
		(async (): Promise<Club | null> => {
			if (isDemoClub(clubId)) return localDemoClub();
			const supabase = createRequestSupabase(event);
			if (!supabase) return null;
			const { data, error } = await supabase.auth.getClaims();
			if (error || !data?.claims?.sub) return null;
			const clubs = await supabase.rpc('my_club');
			if (clubs.error) throw clubs.error;
			return (clubs.data as Club[] | null)?.find((club) => club.id === clubId) ?? null;
		})()
	]);
	return { initialPublicClub, clubAccess, initialDataUpdatedAt: Date.now() };
};
