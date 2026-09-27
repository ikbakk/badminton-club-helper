import { supabase } from '$lib/supabase';
import type { Participant, Membership, ParticipantStatus } from '$lib/domain/types';

type LiveParticipantRow = {
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

export type LiveSession = { id: string; club_id: string; started_at: string };
export type MatchSet = {
	setNumber: number;
	status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
	teamAScore: number | null;
	teamBScore: number | null;
	players: { id: string; name: string; team: 'A' | 'B' }[];
};
export type ActiveMatch = {
	id: string;
	session_id: string;
	sequence_number: number;
	sets: MatchSet[];
};
export async function loadLiveSession(): Promise<{
	session: LiveSession | null;
	participants: Participant[];
	activeMatch: ActiveMatch | null;
}> {
	if (!supabase) return { session: null, participants: [], activeMatch: null };
	const { data: sessions, error: sessionError } = await supabase
		.from('live_session')
		.select('*')
		.limit(1);
	if (sessionError) throw sessionError;
	const session = sessions?.[0] as LiveSession | undefined;
	if (!session) return { session: null, participants: [], activeMatch: null };
	const { data, error } = await supabase
		.from('live_participants')
		.select('*')
		.eq('session_id', session.id);
	if (error) throw error;
	const { data: matches, error: matchError } = await supabase
		.from('live_active_match')
		.select('*')
		.eq('session_id', session.id)
		.limit(1);
	if (matchError) throw matchError;
	return {
		session,
		participants: (data ?? []).map((row) => {
			const participant = row as LiveParticipantRow;
			return {
				sessionParticipantId: participant.participant_id,
				id: participant.player_id,
				name: participant.display_name,
				membership: participant.membership_type,
				rating: Number(participant.rating),
				uncertainty: Number(participant.uncertainty),
				status: participant.status,
				readySince: participant.ready_since ? new Date(participant.ready_since) : undefined,
				consecutiveMatches: 0,
				opportunities: 0,
				missedOpportunities: 0,
				setsPlayed: 0,
				leaveAfterMatch: participant.leave_after_match
			};
		}),
		activeMatch: (matches?.[0] ?? null) as ActiveMatch | null
	};
}

export async function claimOperatorLease(
	sessionId: string,
	pin: string,
	deviceId: string,
	takeover = false
) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { data, error } = await supabase.rpc('claim_operator_lease', {
		p_session_id: sessionId,
		p_pin: pin,
		p_device_id: deviceId,
		p_takeover: takeover
	});
	if (error) throw error;
	return data as string;
}

export async function checkInPlayer(sessionId: string, leaseId: string, playerId: string) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { error } = await supabase.rpc('check_in_player', {
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
	status: ParticipantStatus
) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { error } = await supabase.rpc('change_participant_status', {
		p_session_id: sessionId,
		p_lease_id: leaseId,
		p_participant_id: participantId,
		p_status: status
	});
	if (error) throw error;
}

async function command(name: string, args: Record<string, unknown>) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { data, error } = await supabase.rpc(name, args);
	if (error) throw error;
	return data;
}

export function startMatch(sessionId: string, leaseId: string, teamA: string[], teamB: string[]) {
	return command('start_match', {
		p_session_id: sessionId,
		p_lease_id: leaseId,
		p_team_a: teamA,
		p_team_b: teamB
	});
}

export function completeSet(
	sessionId: string,
	leaseId: string,
	teamAScore: number,
	teamBScore: number
) {
	return command('complete_set', {
		p_session_id: sessionId,
		p_lease_id: leaseId,
		p_team_a_score: teamAScore,
		p_team_b_score: teamBScore
	});
}

export function abandonMatch(sessionId: string, leaseId: string) {
	return command('abandon_match', { p_session_id: sessionId, p_lease_id: leaseId });
}
