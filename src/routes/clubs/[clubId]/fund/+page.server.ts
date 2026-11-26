import { createRequestSupabase } from '$lib/server/supabase';
import type { FinanceSession } from '$lib/data/dashboard';
import type { PageServerLoad } from './$types';
import {
	loadPublicClub,
	loadPublicFund,
	loadPublicPaymentDestinations
} from '$lib/server/public-data';

export const load: PageServerLoad = async (event) => {
	const clubId = event.params.clubId;
	const [club, fund, paymentDestinations] = await Promise.all([
		loadPublicClub(event, clubId),
		loadPublicFund(event, clubId),
		loadPublicPaymentDestinations(event, clubId)
	]);
	const { clubAccess } = await event.parent();
	const supabase =
		clubAccess?.is_club_admin && event.params.clubId !== 'demo'
			? createRequestSupabase(event)
			: null;
	const adminRows = await supabase?.rpc('finance_sessions', { p_club_id: event.params.clubId });
	if (adminRows?.error) throw adminRows.error;

	return {
		initialFinanceSessions: adminRows?.data as FinanceSession[] | undefined,
		initialFund: { club, ...fund },
		initialPaymentDestinations: paymentDestinations,
		initialDataUpdatedAt: clubId === 'demo' ? 0 : Date.now()
	};
};
