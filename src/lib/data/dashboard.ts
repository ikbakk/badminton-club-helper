import { selectedClubId } from '$lib/club-context';
import { supabase } from '$lib/supabase';

import { browserQueryClient } from './query-client';
import {
	isDemoClub,
	localDemoClub,
	localDemoKokShares,
	localDemoRoster,
	localDemoStartSession,
	readLocalDemo,
	updateLocalDemo
} from '$lib/features/demo/local-store';

function cached<T>(key: string, loader: () => Promise<T>) {
	return browserQueryClient.fetchQuery({
		queryKey: ['public', key],
		queryFn: loader,
		retry: false
	});
}
export function invalidatePublicData() {
	void browserQueryClient.invalidateQueries({
		predicate: (query) => query.queryKey[0] === 'public' || query.queryKey[0] === 'public-surface'
	});
}
export type Club = { id: string; name: string; is_club_admin: boolean };
export type RosterPlayer = {
	id: string;
	display_name: string;
	membership_type: 'MEMBER' | 'GUEST';
	rating: number;
	uncertainty: number;
};
const client = () => {
	if (!supabase) throw new Error('Supabase is not configured.');
	return supabase;
};
export async function getClub(clubId = selectedClubId()) {
	if (isDemoClub(clubId)) return localDemoClub();
	if (!(await client().auth.getSession()).data.session) return null;
	const { data, error } = await client().rpc('my_club');
	if (error) throw error;
	return ((data ?? []) as Club[]).find((club) => club.id === clubId) ?? null;
}
export async function getRoster(clubId: string) {
	if (isDemoClub(clubId)) return localDemoRoster();
	const { data, error } = await client().rpc('club_roster', { p_club_id: clubId });
	if (error) throw error;
	return (data ?? []) as RosterPlayer[];
}
export async function bootstrapClub(name: string) {
	const { data, error } = await client().rpc('create_club', { p_name: name });
	if (error) throw error;
	return data as string;
}
export async function addPlayer(clubId: string, name: string) {
	if (isDemoClub(clubId)) {
		updateLocalDemo((state) =>
			state.participants.push({
				id: `demo-player-${Date.now()}`,
				name,
				membership: 'MEMBER',
				rating: 1200,
				uncertainty: 280,
				status: 'OUT',
				consecutiveMatches: 0,
				opportunities: 0,
				missedOpportunities: 0,
				currentOpportunityDebt: 0,
				rotationsPlayed: 0,
				setsPlayed: 0
			})
		);
		return;
	}
	const { error } = await client().rpc('add_roster_player', {
		p_club_id: clubId,
		p_name: name,
		p_membership: 'MEMBER'
	});
	if (error) throw error;
}
export async function promoteGuestToMember(clubId: string, playerId: string) {
	if (isDemoClub(clubId)) {
		updateLocalDemo((state) => {
			const player = state.participants.find((item) => item.id === playerId);
			if (player) player.membership = 'MEMBER';
		});
		return;
	}
	const { error } = await client().rpc('promote_guest_to_member', {
		p_club_id: clubId,
		p_player_id: playerId
	});
	if (error) throw error;
}
export async function startSession(
	clubId: string,
	courtCount = 1,
	matchMode: 'ASSISTED' | 'MANUAL' = 'ASSISTED',
	countKok = true
) {
	const localSession = localDemoStartSession(clubId, courtCount, matchMode, countKok);
	if (localSession) return localSession;
	if (!Number.isSafeInteger(courtCount) || courtCount < 1) {
		throw new Error('Jumlah court harus berupa bilangan bulat positif.');
	}
	const { data, error } = await client().rpc('start_session', {
		p_club_id: clubId,
		p_court_count: courtCount,
		p_match_mode: matchMode,
		p_count_kok: countKok
	});
	if (error) throw error;
	return data as string;
}
export type PublicClub = { id: string; name: string };
export async function getPublicClub(clubId = selectedClubId()) {
	if (!clubId) return null;
	if (isDemoClub(clubId)) return { id: clubId, name: 'Klub Demo' };
	return cached(`club:${clubId}`, async () => {
		const { data, error } = await client()
			.from('public_club_profile')
			.select('id,name')
			.eq('id', clubId)
			.limit(1);
		if (error) throw error;
		return ((data ?? []) as PublicClub[]).find((club) => club.id === clubId) ?? null;
	});
}
export async function getPublicRoster(clubId: string) {
	if (isDemoClub(clubId))
		return localDemoRoster().map(({ id, display_name, membership_type }) => ({
			id,
			display_name,
			membership_type
		}));
	return cached(`roster:${clubId}`, async () => {
		const { data, error } = await client()
			.from('public_member_roster')
			.select('id,display_name,membership_type')
			.eq('club_id', clubId)
			.order('display_name');
		if (error) throw error;
		return data ?? [];
	});
}
export type PublicSessionHistory = {
	id: string;
	started_at: string;
	closed_at: string | null;
	fee_per_person: number | null;
	attendance: number;
	count_kok?: boolean;
	kok_price?: number | null;
	court_rent?: number | null;
	match_mode?: 'ASSISTED' | 'MANUAL';
};

export type PublicFundSummary = { received: number; expenses: number; balance: number };
export type PublicPlayerProfile = {
	id: string;
	display_name: string;
	membership_type: 'MEMBER' | 'GUEST';
	sessions: number;
	sets: number;
	wins: number;
	losses: number;
};
export type PublicPlayerSession = { id: string; started_at: string; closed_at: string | null };
export type PublicPlayerRating = { rating: number; uncertainty: number; algorithm_version: string };

export async function getPublicPlayerRating(
	playerId: string,
	clubId = selectedClubId()
): Promise<PublicPlayerRating | null> {
	if (isDemoClub(clubId)) {
		const person = localDemoRoster().find((player) => player.id === playerId);
		return person
			? { rating: person.rating, uncertainty: person.uncertainty, algorithm_version: 'demo' }
			: null;
	}
	if (!(await getPublicRoster(clubId)).some((player) => player.id === playerId)) return null;
	const { data, error } = await client().rpc('public_player_rating', { p_player_id: playerId });
	if (error) throw error;
	const row = data?.[0] as PublicPlayerRating | undefined;
	return row ? { ...row, rating: Number(row.rating), uncertainty: Number(row.uncertainty) } : null;
}
export type PublicSessionMatch = {
	id: string;
	sequence_number: number;
	status: 'PREPARED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
	court_number?: number;
	team_a: string[];
	team_b: string[];
	set_one_a: number | null;
	set_one_b: number | null;
	set_two_a: number | null;
	set_two_b: number | null;
	sets?: {
		setNumber: number;
		teamAScore: number | null;
		teamBScore: number | null;
		players: { name: string; team: 'A' | 'B' }[] | null;
	}[];
};
export type PublicSessionAttendee = {
	player_id: string;
	display_name: string;
	membership_type: 'MEMBER' | 'GUEST';
	is_paid: boolean | null;
};
export type PublicSessionFinanceRecap = {
	fee_per_person: number | null;
	expected_fees: number;
	court_expenses: number;
	shuttlecock_expenses: number;
	other_expenses: number;
};
export type PublicFundActivity = {
	id: string;
	kind: 'INCOME' | 'EXPENSE';
	label: string;
	amount: number;
	occurred_at: string;
};

export type FinanceSession = {
	session_id: string;
	started_at: string;
	fee_per_person: number;
	attendance: number;
	paid_count: number;
	paid_amount: number;
};

export type FinanceSessionAttendee = {
	player_id: string;
	display_name: string;
	amount: number;
	paid_at: string | null;
	base_amount?: number | null;
	kok_amount?: number;
	adjustment_amount?: number;
	adjustment_reason?: string | null;
};

export async function getFinanceSessions(clubId: string) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return state.session && state.closedAt
			? ([
					{
						session_id: state.session.id,
						started_at: state.session.started_at,
						fee_per_person: state.pricing?.base ?? 0,
						attendance: state.attendeeIds.length,
						paid_count: state.paidIds.length,
						paid_amount: state.paidIds.length * (state.pricing?.base ?? 0)
					}
				] as FinanceSession[])
			: [];
	}
	if (!supabase) return [] as FinanceSession[];
	const { data, error } = await supabase.rpc('finance_sessions', { p_club_id: clubId });
	if (error) throw error;
	return (data ?? []) as FinanceSession[];
}

export async function getFinanceSessionAttendees(clubId: string, sessionId: string) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		if (state.session?.id !== sessionId) return [] as FinanceSessionAttendee[];
		const kokShares = new Map(
			localDemoKokShares(state.pricing?.kokPrice ?? 0).map((share) => [
				share.player_id,
				share.kok_amount
			])
		);
		return state.participants
			.filter((person) => state.attendeeIds.includes(person.id))
			.map((person) => ({
				player_id: person.id,
				display_name: person.name,
				amount: (state.pricing?.base ?? 0) + (kokShares.get(person.id) ?? 0),
				base_amount: state.pricing?.base ?? 0,
				kok_amount: kokShares.get(person.id) ?? 0,
				adjustment_amount: 0,
				paid_at: state.paidIds.includes(person.id) ? new Date().toISOString() : null
			}));
	}
	if (!supabase) return [] as FinanceSessionAttendee[];
	const { data, error } = await supabase.rpc('finance_session_attendees', {
		p_club_id: clubId,
		p_session_id: sessionId
	});
	if (error) throw error;
	return (data ?? []) as FinanceSessionAttendee[];
}

export async function setSessionAttendeePaid(
	clubId: string,
	sessionId: string,
	playerId: string,
	paid: boolean
) {
	if (isDemoClub(clubId)) {
		updateLocalDemo((state) => {
			state.paidIds = paid
				? [...new Set([...state.paidIds, playerId])]
				: state.paidIds.filter((id) => id !== playerId);
		});
		return;
	}
	if (!supabase) throw new Error('Supabase is not configured.');
	const { error } = await supabase.rpc('set_session_attendee_paid', {
		p_club_id: clubId,
		p_session_id: sessionId,
		p_player_id: playerId,
		p_paid: paid
	});
	if (error) throw error;
}

export type FinancePlayerBalance = {
	player_id: string;
	display_name: string;
	obligations: number;
	paid: number;
	allocated: number;
	debt: number;
	credit: number;
};

export type FinancePayment = {
	payment_id: string;
	player_id: string;
	display_name: string;
	remaining: number;
};

export type FinanceObligation = {
	obligation_id: string;
	player_id: string;
	display_name: string;
	session_started_at: string;
	remaining: number;
};

export async function getFinancePlayerBalances(clubId: string) {
	if (isDemoClub(clubId)) return [] as FinancePlayerBalance[];
	const { data, error } = await client().rpc('finance_player_balances', { p_club_id: clubId });
	if (error) throw error;
	const rows = (data ?? []) as (Omit<
		FinancePlayerBalance,
		'obligations' | 'paid' | 'allocated' | 'debt' | 'credit'
	> & {
		obligations: string | number;
		paid: string | number;
		allocated: string | number;
		debt: string | number;
		credit: string | number;
	})[];
	return rows.map((row) => ({
		...row,
		obligations: Number(row.obligations),
		paid: Number(row.paid),
		allocated: Number(row.allocated),
		debt: Number(row.debt),
		credit: Number(row.credit)
	}));
}

export async function recordPayment(
	clubId: string,
	playerId: string,
	amount: number,
	method: 'CASH' | 'BANK' | 'SHOPEEPAY'
) {
	if (isDemoClub(clubId)) {
		updateLocalDemo((state) => {
			if (!state.paidIds.includes(playerId)) state.paidIds.push(playerId);
		});
		return;
	}
	const { error } = await client().rpc('record_payment', {
		p_club_id: clubId,
		p_player_id: playerId,
		p_amount: amount,
		p_method: method
	});
	if (error) throw error;
}

export async function recordExpense(
	clubId: string,
	category: 'COURT' | 'SHUTTLECOCK' | 'OTHER',
	amount: number,
	description: string
) {
	if (isDemoClub(clubId)) {
		updateLocalDemo((state) => state.kasExpenses.push({ amount, label: description || category }));
		return;
	}
	const { error } = await client().rpc('record_expense', {
		p_club_id: clubId,
		p_category: category,
		p_amount: amount,
		p_description: description || null,
		p_session_id: null
	});
	if (error) throw error;
}

export async function getFinanceUnallocatedPayments(clubId: string) {
	if (isDemoClub(clubId)) return [] as FinancePayment[];
	const { data, error } = await client().rpc('finance_unallocated_payments', { p_club_id: clubId });
	if (error) throw error;
	return (
		(data ?? []) as (Omit<FinancePayment, 'remaining'> & { remaining: string | number })[]
	).map((row) => ({ ...row, remaining: Number(row.remaining) }));
}

export async function getFinanceOpenObligations(clubId: string) {
	if (isDemoClub(clubId)) return [] as FinanceObligation[];
	const { data, error } = await client().rpc('finance_open_obligations', { p_club_id: clubId });
	if (error) throw error;
	return (
		(data ?? []) as (Omit<FinanceObligation, 'remaining'> & {
			remaining: string | number;
		})[]
	).map((row) => ({ ...row, remaining: Number(row.remaining) }));
}

export async function allocatePayment(
	clubId: string,
	paymentId: string,
	obligationId: string,
	amount: number
) {
	if (isDemoClub(clubId)) return;
	const { error } = await client().rpc('allocate_payment', {
		p_club_id: clubId,
		p_payment_id: paymentId,
		p_obligation_id: obligationId,
		p_amount: amount
	});
	if (error) throw error;
}

export async function getPublicSessionHistory(clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return state.session && state.closedAt
			? ([
					{
						id: state.session.id,
						started_at: state.session.started_at,
						closed_at: state.closedAt,
						fee_per_person: state.pricing?.base ?? null,
						attendance: state.attendeeIds.length,
						count_kok: state.countKok,
						kok_price: state.pricing?.kokPrice ?? null,
						court_rent: state.pricing?.courtRent ?? null,
						match_mode: state.session.match_mode
					}
				] as PublicSessionHistory[])
			: [];
	}
	return cached(`history:${clubId}`, async () => {
		const { data, error } = await client()
			.from('public_session_history')
			.select(
				'id,started_at,closed_at,fee_per_person,attendance,count_kok,kok_price,court_rent,match_mode'
			)
			.eq('club_id', clubId)
			.order('started_at', { ascending: false });
		if (error) throw error;
		return (data ?? []) as PublicSessionHistory[];
	});
}

export async function getPublicFundSummary(clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		const received = (state.pricing?.base ?? 0) * state.paidIds.length;
		const expenses =
			(state.pricing?.courtRent ?? 0) +
			(state.pricing?.kokPrice ?? 0) * Object.values(state.kokByMatch).reduce((a, b) => a + b, 0) +
			state.kasExpenses.reduce((sum, expense) => sum + expense.amount, 0);
		return { received, expenses, balance: received - expenses };
	}
	return cached(`fund-summary:${clubId}`, async () => {
		const { data, error } = await client()
			.from('public_fund_summary')
			.select('received,expenses,balance')
			.eq('club_id', clubId)
			.single();
		if (error) throw error;
		return data as PublicFundSummary;
	});
}

export async function getPublicPlayerProfile(playerId: string, clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const person = localDemoRoster().find((player) => player.id === playerId);
		return person
			? ({
					id: person.id,
					display_name: person.display_name,
					membership_type: person.membership_type,
					sessions: readLocalDemo().closedAt ? 1 : 0,
					sets: 0,
					wins: 0,
					losses: 0
				} as PublicPlayerProfile)
			: null;
	}
	if (!(await getPublicRoster(clubId)).some((player) => player.id === playerId)) return null;
	return cached(`player:${playerId}`, async () => {
		const { data, error } = await client().rpc('public_player_profile', { p_player_id: playerId });
		if (error) throw error;
		return (data?.[0] ?? null) as PublicPlayerProfile | null;
	});
}

export async function getPublicPlayerRecentSessions(playerId: string, clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return state.session && state.closedAt && state.attendeeIds.includes(playerId)
			? ([
					{ id: state.session.id, started_at: state.session.started_at, closed_at: state.closedAt }
				] as PublicPlayerSession[])
			: [];
	}
	if (!(await getPublicRoster(clubId)).some((player) => player.id === playerId)) return [];
	return cached(`player-sessions:${playerId}`, async () => {
		const { data, error } = await client().rpc('public_player_recent_sessions', {
			p_player_id: playerId
		});
		if (error) throw error;
		return (data ?? []) as PublicPlayerSession[];
	});
}

export async function getPublicSessionMatches(sessionId: string, clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return [...state.completed, ...state.activeMatches]
			.filter((match) => match.session_id === sessionId)
			.map((match) => ({
				id: match.id,
				sequence_number: match.sequence_number,
				status: match.sets.some((set) => set.status === 'IN_PROGRESS')
					? ('IN_PROGRESS' as const)
					: ('COMPLETED' as const),
				court_number: match.court_number,
				team_a: match.sets[0]?.players.filter((p) => p.team === 'A').map((p) => p.name) ?? [],
				team_b: match.sets[0]?.players.filter((p) => p.team === 'B').map((p) => p.name) ?? [],
				set_one_a: match.sets.find((set) => set.setNumber === 1)?.teamAScore ?? null,
				set_one_b: match.sets.find((set) => set.setNumber === 1)?.teamBScore ?? null,
				set_two_a: match.sets.find((set) => set.setNumber === 2)?.teamAScore ?? null,
				set_two_b: match.sets.find((set) => set.setNumber === 2)?.teamBScore ?? null,
				sets: match.sets.map((set) => ({
					setNumber: set.setNumber,
					teamAScore: set.teamAScore,
					teamBScore: set.teamBScore,
					players: set.players.map(({ name, team }) => ({ name, team }))
				}))
			})) as PublicSessionMatch[];
	}
	if (!(await getPublicSessionHistory(clubId)).some((session) => session.id === sessionId))
		return [];
	return cached(`session-matches:${sessionId}`, async () => {
		const { data, error } = await client().rpc('public_session_matches', {
			p_session_id: sessionId
		});
		if (error) throw error;
		return (data ?? []) as PublicSessionMatch[];
	});
}

export async function getPublicSessionAttendance(sessionId: string, clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return state.session?.id === sessionId
			? state.participants
					.filter((person) => state.attendeeIds.includes(person.id))
					.map((person) => ({
						player_id: person.id,
						display_name: person.name,
						membership_type: person.membership,
						is_paid: state.paidIds.includes(person.id)
					}))
			: [];
	}
	if (!(await getPublicSessionHistory(clubId)).some((session) => session.id === sessionId))
		return [];
	return cached(`session-attendance:${sessionId}`, async () => {
		const { data, error } = await client().rpc('public_session_attendance', {
			p_session_id: sessionId
		});
		if (error) throw error;
		return (data ?? []) as PublicSessionAttendee[];
	});
}

export async function getPublicSessionFinanceRecap(sessionId: string, clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return state.session?.id === sessionId
			? {
					fee_per_person: state.pricing?.base ?? null,
					expected_fees: (state.pricing?.base ?? 0) * state.attendeeIds.length,
					court_expenses: state.pricing?.courtRent ?? 0,
					shuttlecock_expenses: 0,
					other_expenses: 0
				}
			: null;
	}
	if (!(await getPublicSessionHistory(clubId)).some((session) => session.id === sessionId))
		return null;
	return cached(`session-finance:${sessionId}`, async () => {
		const { data, error } = await client().rpc('public_session_finance_recap', {
			p_session_id: sessionId
		});
		if (error) throw error;
		const row = data?.[0] as PublicSessionFinanceRecap | undefined;
		return row
			? {
					...row,
					expected_fees: Number(row.expected_fees),
					court_expenses: Number(row.court_expenses),
					shuttlecock_expenses: Number(row.shuttlecock_expenses),
					other_expenses: Number(row.other_expenses)
				}
			: null;
	});
}

export async function getPublicFundActivity(clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return [
			...(state.pricing
				? [
						{
							id: `demo-fee-${state.session?.id}`,
							kind: 'INCOME' as const,
							label: 'Iuran sesi demo',
							amount: state.paidIds.length * state.pricing.base,
							occurred_at: state.closedAt ?? state.session?.started_at ?? new Date().toISOString()
						}
					]
				: []),
			...state.kasExpenses.map((expense, index) => ({
				id: `demo-expense-${index}`,
				kind: 'EXPENSE' as const,
				label: expense.label,
				amount: expense.amount,
				occurred_at: state.closedAt ?? new Date().toISOString()
			}))
		];
	}
	return cached(`fund-activity:${clubId}`, async () => {
		const { data, error } = await client().rpc('public_fund_activity', {
			p_club_id: clubId
		});
		if (error) throw error;
		return (data ?? []) as PublicFundActivity[];
	});
}

export async function prefetchPublicSurface(route: string) {
	const clubId = selectedClubId();
	const club = await getPublicClub(clubId);
	if (route === '/players' && club) await getPublicRoster(club.id);
	if (route === '/history') await getPublicSessionHistory(clubId);
	if (route === '/fund')
		await Promise.all([
			getPublicFundSummary(clubId),
			getPublicFundActivity(clubId).catch(() => [])
		]);
}

export async function prefetchPublicPlayer(playerId: string) {
	await Promise.all([
		getPublicPlayerProfile(playerId).catch(() => null),
		getPublicPlayerRecentSessions(playerId).catch(() => [])
	]);
}

export async function prefetchPublicSession(sessionId: string) {
	await getPublicSessionMatches(sessionId).catch(() => []);
}

export type PublicPlayerSessionSummary = {
	session_id: string;
	started_at: string;
	closed_at: string | null;
	sets: number;
	wins: number;
	losses: number;
	partners: string[];
	rating_change: number | null;
};
export async function getPublicPlayerSessionSummaries(playerId: string, clubId = selectedClubId()) {
	if (isDemoClub(clubId)) {
		const state = readLocalDemo();
		return state.session && state.closedAt && state.attendeeIds.includes(playerId)
			? ([
					{
						session_id: state.session.id,
						started_at: state.session.started_at,
						closed_at: state.closedAt,
						sets: state.completed.reduce(
							(sum, match) =>
								sum +
								match.sets.filter(
									(set) =>
										set.status === 'COMPLETED' &&
										set.players.some((player) => player.id === playerId)
								).length,
							0
						),
						wins: 0,
						losses: 0,
						partners: [],
						rating_change: null
					}
				] as PublicPlayerSessionSummary[])
			: [];
	}
	if (!(await getPublicRoster(clubId)).some((player) => player.id === playerId)) return [];
	return cached(`player-summary:${clubId}:${playerId}`, async () => {
		const { data, error } = await client().rpc('public_player_session_summaries', {
			p_club_id: clubId,
			p_player_id: playerId
		});
		if (error) throw error;
		return ((data ?? []) as PublicPlayerSessionSummary[]).map((row) => ({
			...row,
			rating_change: row.rating_change === null ? null : Number(row.rating_change)
		}));
	});
}
