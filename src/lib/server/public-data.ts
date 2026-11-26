import type {
	PublicClub,
	PublicFundActivity,
	PublicFundSummary,
	PublicPlayerProfile,
	PublicPlayerRating,
	PublicPlayerSessionSummary,
	PublicSessionAttendee,
	PublicSessionFinanceRecap,
	PublicSessionHistory,
	PublicSessionMatch
} from '$lib/data/dashboard';
import type { ClubSettings, PublicPaymentDestinations } from '$lib/data/club-settings';
import type { Club } from '$lib/data/dashboard';
import { createRequestSupabase } from './supabase';
import type { RequestEvent } from '@sveltejs/kit';
import {
	emptyLiveSessionSnapshot,
	type ActiveMatch,
	type LiveSession,
	type LiveSessionSnapshot
} from '$lib/data/live';
import type { Participant, Membership, ParticipantStatus } from '$lib/domain/types';
import { localDemoRoster } from '$lib/features/demo/local-store';

export async function loadPublicClub(event: RequestEvent, clubId: string) {
	const supabase = createRequestSupabase(event);
	if (!supabase || clubId === 'demo')
		return clubId === 'demo' ? { id: clubId, name: 'Klub Demo' } : null;
	const { data, error } = await supabase
		.from('public_club_profile')
		.select('id,name')
		.eq('id', clubId)
		.limit(1);
	if (error) throw error;
	return ((data ?? []) as PublicClub[]).find((club) => club.id === clubId) ?? null;
}

export async function loadPublicRoster(event: RequestEvent, clubId: string) {
	if (clubId === 'demo')
		return localDemoRoster().map(({ id, display_name, membership_type }) => ({
			id,
			display_name,
			membership_type
		}));
	const supabase = createRequestSupabase(event);
	if (!supabase) return [];
	const { data, error } = await supabase
		.from('public_member_roster')
		.select('id,display_name,membership_type')
		.eq('club_id', clubId)
		.order('display_name');
	if (error) throw error;
	return data ?? [];
}

export async function loadPublicHistory(event: RequestEvent, clubId: string) {
	if (clubId === 'demo') return [] as PublicSessionHistory[];
	const supabase = createRequestSupabase(event);
	if (!supabase) return [] as PublicSessionHistory[];
	const { data, error } = await supabase
		.from('public_session_history')
		.select(
			'id,started_at,closed_at,fee_per_person,attendance,count_kok,kok_price,court_rent,match_mode'
		)
		.eq('club_id', clubId)
		.order('started_at', { ascending: false });
	if (error) throw error;
	return ((data ?? []) as PublicSessionHistory[]).filter((session) => session.closed_at);
}

export async function loadPublicFund(event: RequestEvent, clubId: string) {
	if (clubId === 'demo')
		return { summary: null as PublicFundSummary | null, activity: [] as PublicFundActivity[] };
	const supabase = createRequestSupabase(event);
	if (!supabase) return { summary: null, activity: [] as PublicFundActivity[] };
	const [summaryResult, activityResult] = await Promise.all([
		supabase
			.from('public_fund_summary')
			.select('received,expenses,balance')
			.eq('club_id', clubId)
			.single(),
		supabase.rpc('public_fund_activity', { p_club_id: clubId })
	]);
	if (summaryResult.error) throw summaryResult.error;
	if (activityResult.error) throw activityResult.error;
	return {
		summary: summaryResult.data as PublicFundSummary,
		activity: (activityResult.data ?? []) as PublicFundActivity[]
	};
}

export async function loadPublicPaymentDestinations(event: RequestEvent, clubId: string) {
	if (clubId === 'demo') return null;
	const supabase = createRequestSupabase(event);
	if (!supabase) return null;
	const { data, error } = await supabase.rpc('public_payment_destinations', { p_club_id: clubId });
	if (error) throw error;
	return (data?.[0] ?? null) as PublicPaymentDestinations | null;
}

export async function loadLiveSnapshot(
	event: RequestEvent,
	clubId: string
): Promise<LiveSessionSnapshot> {
	if (clubId === 'demo') return emptyLiveSessionSnapshot;
	const supabase = createRequestSupabase(event);
	if (!supabase) return emptyLiveSessionSnapshot;
	const { data: sessionRows, error: sessionError } = await supabase
		.from('live_session')
		.select('*')
		.eq('club_id', clubId)
		.limit(1);
	if (sessionError) throw sessionError;
	const session = (sessionRows?.[0] ?? null) as LiveSession | null;
	if (!session) return emptyLiveSessionSnapshot;
	const [participantsResult, matchesResult, authResult] = await Promise.all([
		supabase.from('live_participants').select('*').eq('session_id', session.id),
		supabase
			.from('live_active_match')
			.select('*')
			.eq('session_id', session.id)
			.order('court_number', { ascending: true }),
		supabase.auth.getSession()
	]);
	if (participantsResult.error) throw participantsResult.error;
	if (matchesResult.error) throw matchesResult.error;
	let fairnessRows: {
		player_id: string;
		eligible_opportunities: number;
		missed_opportunities: number;
		current_opportunity_debt: number;
		rotations_played: number;
		sets_played: number;
		consecutive_rotations: number;
	}[] = [];
	if (authResult.data.session) {
		const { data: clubs, error } = await supabase.rpc('my_club');
		if (error) throw error;
		if (
			clubs?.some(
				(club: { id: string; is_club_admin: boolean }) => club.id === clubId && club.is_club_admin
			)
		) {
			const fairness = await supabase.rpc('get_rotation_fairness_state', {
				p_session_id: session.id
			});
			if (fairness.error) throw fairness.error;
			fairnessRows = fairness.data ?? [];
		}
	}
	const fairnessByPlayer = new Map(fairnessRows.map((row) => [row.player_id, row]));
	const participants = (participantsResult.data ?? []).map((raw): Participant => {
		const row = raw as {
			participant_id: string;
			player_id: string;
			display_name: string;
			membership_type: Membership;
			rating: string | number;
			uncertainty: string | number;
			status: ParticipantStatus;
			ready_since: string | null;
			leave_after_match: boolean;
		};
		const fairness = fairnessByPlayer.get(row.player_id);
		return {
			sessionParticipantId: row.participant_id,
			id: row.player_id,
			name: row.display_name,
			membership: row.membership_type,
			rating: Number(row.rating),
			uncertainty: Number(row.uncertainty),
			status: row.status,
			readySince: row.ready_since ? new Date(row.ready_since) : undefined,
			consecutiveMatches: fairness?.consecutive_rotations ?? 0,
			opportunities: fairness?.eligible_opportunities ?? 0,
			missedOpportunities: fairness?.missed_opportunities ?? 0,
			currentOpportunityDebt: fairness?.current_opportunity_debt ?? 0,
			rotationsPlayed: fairness?.rotations_played ?? 0,
			setsPlayed: fairness?.sets_played ?? 0,
			leaveAfterMatch: row.leave_after_match
		};
	});
	const activeMatches = (matchesResult.data ?? []) as ActiveMatch[];
	return { session, participants, activeMatches, activeMatch: activeMatches[0] ?? null };
}

export async function loadPublicPlayer(event: RequestEvent, clubId: string, playerId: string) {
	const [club, roster] = await Promise.all([
		loadPublicClub(event, clubId),
		loadPublicRoster(event, clubId)
	]);
	if (!club || !roster.some((player) => player.id === playerId))
		return { club, player: null, rating: null as PublicPlayerRating | null };
	if (clubId === 'demo') return { club, player: null, rating: null as PublicPlayerRating | null };
	const supabase = createRequestSupabase(event);
	if (!supabase) return { club, player: null, rating: null as PublicPlayerRating | null };
	const [profile, rating] = await Promise.all([
		supabase.rpc('public_player_profile', { p_player_id: playerId }),
		supabase.rpc('public_player_rating', { p_player_id: playerId })
	]);
	if (profile.error) throw profile.error;
	if (rating.error) throw rating.error;
	const ratingRow = (rating.data?.[0] ?? null) as PublicPlayerRating | null;
	return {
		club,
		player: (profile.data?.[0] ?? null) as PublicPlayerProfile | null,
		rating: ratingRow
			? {
					...ratingRow,
					rating: Number(ratingRow.rating),
					uncertainty: Number(ratingRow.uncertainty)
				}
			: null
	};
}

export async function loadPublicPlayerSummaries(
	event: RequestEvent,
	clubId: string,
	playerId: string
) {
	if (clubId === 'demo') return [] as PublicPlayerSessionSummary[];
	const roster = await loadPublicRoster(event, clubId);
	if (!roster.some((player) => player.id === playerId)) return [] as PublicPlayerSessionSummary[];
	const supabase = createRequestSupabase(event);
	if (!supabase) return [] as PublicPlayerSessionSummary[];
	const { data, error } = await supabase.rpc('public_player_session_summaries', {
		p_club_id: clubId,
		p_player_id: playerId
	});
	if (error) throw error;
	return ((data ?? []) as PublicPlayerSessionSummary[]).map((row) => ({
		...row,
		rating_change: row.rating_change === null ? null : Number(row.rating_change)
	}));
}

export async function loadPublicSessionDetail(
	event: RequestEvent,
	clubId: string,
	sessionId: string
) {
	const [publicClub, history] = await Promise.all([
		loadPublicClub(event, clubId),
		loadPublicHistory(event, clubId)
	]);
	const session = history.find((item) => item.id === sessionId) ?? null;
	if (!publicClub || !session || clubId === 'demo')
		return {
			publicClub,
			session,
			matches: [] as PublicSessionMatch[],
			attendees: [] as PublicSessionAttendee[],
			financeRecap: null as PublicSessionFinanceRecap | null
		};
	const supabase = createRequestSupabase(event);
	if (!supabase)
		return {
			publicClub,
			session,
			matches: [] as PublicSessionMatch[],
			attendees: [] as PublicSessionAttendee[],
			financeRecap: null as PublicSessionFinanceRecap | null
		};
	const [matches, attendees, finance] = await Promise.all([
		supabase.rpc('public_session_matches', { p_session_id: sessionId }),
		supabase.rpc('public_session_attendance', { p_session_id: sessionId }),
		supabase.rpc('public_session_finance_recap', { p_session_id: sessionId })
	]);
	if (matches.error) throw matches.error;
	if (attendees.error) throw attendees.error;
	if (finance.error) throw finance.error;
	const recap = (finance.data?.[0] ?? null) as PublicSessionFinanceRecap | null;
	return {
		publicClub,
		session,
		matches: (matches.data ?? []) as PublicSessionMatch[],
		attendees: (attendees.data ?? []) as PublicSessionAttendee[],
		financeRecap: recap
			? {
					...recap,
					expected_fees: Number(recap.expected_fees),
					court_expenses: Number(recap.court_expenses),
					shuttlecock_expenses: Number(recap.shuttlecock_expenses),
					other_expenses: Number(recap.other_expenses)
				}
			: null
	};
}

export async function loadClubSettingsPage(event: RequestEvent, clubId: string) {
	const publicClub = await loadPublicClub(event, clubId);
	if (clubId === 'demo') {
		const club = { id: clubId, name: 'Klub Demo', is_club_admin: true } as Club;
		const settings: ClubSettings = {
			club_id: clubId,
			name: club.name,
			bank_name: null,
			bank_account_name: null,
			bank_account_number: null,
			shopeepay_name: null,
			shopeepay_number: null,
			qris_image_url: null,
			publish_publicly: false
		};
		return { account: { club, publicClub, email: 'demo@courtside.local' }, settings };
	}
	const supabase = createRequestSupabase(event);
	if (!supabase) return { account: { club: null, publicClub, email: null }, settings: null };
	const claimsResult = await supabase.auth.getClaims();
	const claims = claimsResult.error ? null : claimsResult.data?.claims;
	const userId = typeof claims?.sub === 'string' ? claims.sub : null;
	const email = typeof claims?.email === 'string' ? claims.email : null;
	if (!userId) return { account: { club: null, publicClub, email }, settings: null };
	const { data: clubs, error: clubError } = await supabase.rpc('my_club');
	if (clubError) throw clubError;
	const club =
		((clubs ?? []) as Club[]).find(
			(candidate) => candidate.id === clubId && candidate.is_club_admin
		) ?? null;
	if (!club) return { account: { club: null, publicClub, email }, settings: null };
	const { data, error } = await supabase.rpc('club_settings', { p_club_id: club.id });
	if (error) throw error;
	return {
		account: { club, publicClub, email },
		settings: (data?.[0] ?? null) as ClubSettings | null
	};
}
