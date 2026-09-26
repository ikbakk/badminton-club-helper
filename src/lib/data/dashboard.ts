import { supabase } from '$lib/supabase';
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
	const { data, error } = await client().from('public_club_profile').select('id,name').limit(1);
	if (error) throw error;
	return (data?.[0] ?? null) as PublicClub | null;
}
export async function getPublicRoster(clubId: string) {
	const { data, error } = await client()
		.from('public_member_roster')
		.select('id,display_name,membership_type')
		.eq('club_id', clubId)
		.order('display_name');
	if (error) throw error;
	return data ?? [];
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
