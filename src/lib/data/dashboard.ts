import { supabase } from '$lib/supabase';

const publicCache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, loader: () => Promise<T>) {
	const existing = publicCache.get(key) as Promise<T> | undefined;
	if (existing) return existing;
	const request = loader().catch((error) => {
		publicCache.delete(key);
		throw error;
	});
	publicCache.set(key, request);
	return request;
}
export function invalidatePublicData() {
	publicCache.clear();
}
export type Club = { id: string; name: string; is_club_admin: boolean; is_finance_admin: boolean };
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
export async function getClub() {
	const { data, error } = await client().rpc('my_club');
	if (error) throw error;
	return (data?.[0] ?? null) as Club | null;
}
export async function getRoster(clubId: string) {
	const { data, error } = await client().rpc('club_roster', { p_club_id: clubId });
	if (error) throw error;
	return (data ?? []) as RosterPlayer[];
}
export async function bootstrapClub(name: string) {
	const { data, error } = await client().rpc('bootstrap_first_club', { p_name: name });
	if (error) throw error;
	return data as string;
}
export async function addPlayer(clubId: string, name: string) {
	const { error } = await client().rpc('add_roster_player', {
		p_club_id: clubId,
		p_name: name,
		p_membership: 'MEMBER'
	});
	if (error) throw error;
}
export async function startSession(clubId: string, pin: string) {
	const { data, error } = await client().rpc('start_session', { p_club_id: clubId, p_pin: pin });
	if (error) throw error;
	return data as string;
}
export type PublicClub = { id: string; name: string };
export async function getPublicClub() {
	return cached('club', async () => {
		const { data, error } = await client().from('public_club_profile').select('id,name').limit(1);
		if (error) throw error;
		return (data?.[0] ?? null) as PublicClub | null;
	});
}
export async function getPublicRoster(clubId: string) {
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
export type LiveSession = { id: string; club_id: string; started_at: string };
export async function getLiveSession() {
	const { data, error } = await client()
		.from('live_session')
		.select('id,club_id,started_at')
		.limit(1);
	if (error) throw error;
	return (data?.[0] ?? null) as LiveSession | null;
}
export type LiveParticipant = {
	participant_id: string;
	player_id: string;
	display_name: string;
	status: 'READY' | 'PLAYING' | 'RESTING' | 'AWAY' | 'OUT' | 'LEFT';
	ready_since: string | null;
};
export async function getLiveParticipants(sessionId: string) {
	const { data, error } = await client()
		.from('live_participants')
		.select('participant_id,player_id,display_name,status,ready_since')
		.eq('session_id', sessionId)
		.order('display_name');
	if (error) throw error;
	return (data ?? []) as LiveParticipant[];
}
export async function claimOperator(
	sessionId: string,
	pin: string,
	deviceId: string,
	takeover = false
) {
	const { data, error } = await client().rpc('claim_operator_lease', {
		p_session_id: sessionId,
		p_pin: pin,
		p_device_id: deviceId,
		p_takeover: takeover
	});
	if (error) throw error;
	return data as string;
}
export async function checkInPlayer(sessionId: string, leaseId: string, playerId: string) {
	const { error } = await client().rpc('check_in_player', {
		p_session_id: sessionId,
		p_lease_id: leaseId,
		p_player_id: playerId
	});
	if (error) throw error;
}
export async function changeParticipantStatus(
	sessionId: string,
	leaseId: string,
	participantId: string,
	status: LiveParticipant['status']
) {
	const { error } = await client().rpc('change_participant_status', {
		p_session_id: sessionId,
		p_lease_id: leaseId,
		p_participant_id: participantId,
		p_status: status
	});
	if (error) throw error;
}

export type PublicSessionHistory = {
	id: string;
	started_at: string;
	closed_at: string | null;
	fee_per_person: number | null;
	attendance: number;
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
export type PublicSessionMatch = {
	id: string;
	sequence_number: number;
	status: 'PREPARED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
	team_a: string[];
	team_b: string[];
	set_one_a: number | null;
	set_one_b: number | null;
	set_two_a: number | null;
	set_two_b: number | null;
};
export type PublicFundActivity = {
	id: string;
	kind: 'INCOME' | 'EXPENSE';
	label: string;
	amount: number;
	occurred_at: string;
};

export async function getPublicSessionHistory() {
	return cached('history', async () => {
		const { data, error } = await client()
			.from('public_session_history')
			.select('id,started_at,closed_at,fee_per_person,attendance')
			.order('started_at', { ascending: false });
		if (error) throw error;
		return (data ?? []) as PublicSessionHistory[];
	});
}

export async function getPublicFundSummary() {
	return cached('fund-summary', async () => {
		const { data, error } = await client()
			.from('public_fund_summary')
			.select('received,expenses,balance')
			.single();
		if (error) throw error;
		return data as PublicFundSummary;
	});
}

export async function getPublicPlayerProfile(playerId: string) {
	return cached(`player:${playerId}`, async () => {
		const { data, error } = await client().rpc('public_player_profile', { p_player_id: playerId });
		if (error) throw error;
		return (data?.[0] ?? null) as PublicPlayerProfile | null;
	});
}

export async function getPublicPlayerRecentSessions(playerId: string) {
	return cached(`player-sessions:${playerId}`, async () => {
		const { data, error } = await client().rpc('public_player_recent_sessions', { p_player_id: playerId });
		if (error) throw error;
		return (data ?? []) as PublicPlayerSession[];
	});
}

export async function getPublicSessionMatches(sessionId: string) {
	return cached(`session-matches:${sessionId}`, async () => {
		const { data, error } = await client().rpc('public_session_matches', { p_session_id: sessionId });
		if (error) throw error;
		return (data ?? []) as PublicSessionMatch[];
	});
}

export async function getPublicFundActivity() {
	return cached('fund-activity', async () => {
		const { data, error } = await client().rpc('public_fund_activity');
		if (error) throw error;
		return (data ?? []) as PublicFundActivity[];
	});
}

export async function prefetchPublicSurface(route: string) {
	const club = await getPublicClub();
	if (route === '/players' && club) await getPublicRoster(club.id);
	if (route === '/history') await getPublicSessionHistory();
	if (route === '/fund') await Promise.all([getPublicFundSummary(), getPublicFundActivity().catch(() => [])]);
}

export async function prefetchPublicPlayer(playerId: string) {
	await Promise.all([getPublicPlayerProfile(playerId).catch(() => null), getPublicPlayerRecentSessions(playerId).catch(() => [])]);
}

export async function prefetchPublicSession(sessionId: string) {
	await getPublicSessionMatches(sessionId).catch(() => []);
}
