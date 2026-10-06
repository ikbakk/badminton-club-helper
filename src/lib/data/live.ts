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

type RotationFairnessRow = {
	participant_id: string;
	player_id: string;
	eligible_opportunities: number;
	missed_opportunities: number;
	current_opportunity_debt: number;
	rotations_played: number;
	sets_played: number;
	consecutive_rotations: number;
};

export type LiveSession = { id: string; club_id: string; started_at: string };
export type MatchSet = {
	id: string;
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

const liveTopic = (sessionId: string) => `live:${sessionId}`;

export function subscribeToLiveUpdates(sessionId: string, onUpdate: () => void) {
	const client = supabase;
	if (!client) return () => {};
	const channel = client
		.channel(liveTopic(sessionId))
		.on('broadcast', { event: 'state_changed' }, onUpdate)
		.subscribe();
	return () => void client.removeChannel(channel);
}

function broadcastLiveUpdate(sessionId: string) {
	if (!supabase) return;
	const channel = supabase.channel(liveTopic(sessionId));
	void channel
		.send({ type: 'broadcast', event: 'state_changed', payload: {} })
		.catch(() => {})
		.finally(() => void supabase?.removeChannel(channel));
}

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
	let fairnessRows: RotationFairnessRow[] = [];
	const { data: auth } = await supabase.auth.getSession();
	if (auth.session) {
		const { data: fairness, error: fairnessError } = await supabase.rpc(
			'get_rotation_fairness_state',
			{ p_session_id: session.id }
		);
		if (fairnessError) throw fairnessError;
		fairnessRows = (fairness ?? []) as RotationFairnessRow[];
	}
	const fairnessByPlayer = new Map(fairnessRows.map((row) => [row.player_id, row]));
	return {
		session,
		participants: (data ?? []).map((row) => {
			const participant = row as LiveParticipantRow;
			const fairness = fairnessByPlayer.get(participant.player_id);
			return {
				sessionParticipantId: participant.participant_id,
				id: participant.player_id,
				name: participant.display_name,
				membership: participant.membership_type,
				rating: Number(participant.rating),
				uncertainty: Number(participant.uncertainty),
				status: participant.status,
				readySince: participant.ready_since ? new Date(participant.ready_since) : undefined,
				consecutiveMatches: fairness?.consecutive_rotations ?? 0,
				opportunities: fairness?.eligible_opportunities ?? 0,
				missedOpportunities: fairness?.missed_opportunities ?? 0,
				currentOpportunityDebt: fairness?.current_opportunity_debt ?? 0,
				rotationsPlayed: fairness?.rotations_played ?? 0,
				setsPlayed: fairness?.sets_played ?? 0,
				leaveAfterMatch: participant.leave_after_match
			};
		}),
		activeMatch: (matches?.[0] ?? null) as ActiveMatch | null
	};
}

export async function checkInPlayer(sessionId: string, playerId: string) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { error } = await supabase.rpc('check_in_player', {
		p_session_id: sessionId,
		p_lease_id: null,
		p_player_id: playerId
	});
	if (error) throw error;
	broadcastLiveUpdate(sessionId);
}

export async function checkInPlayers(sessionId: string, playerIds: string[]) {
	if (!supabase) throw new Error('Supabase is not configured.');
	if (!playerIds.length) return;
	const { error } = await supabase.rpc('check_in_players', {
		p_session_id: sessionId,
		p_player_ids: playerIds
	});
	if (error) throw error;
	broadcastLiveUpdate(sessionId);
}

export async function changeParticipantStatus(
	sessionId: string,
	participantId: string,
	status: ParticipantStatus
) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { error } = await supabase.rpc('change_participant_status', {
		p_session_id: sessionId,
		p_lease_id: null,
		p_participant_id: participantId,
		p_status: status
	});
	if (error) throw error;
	broadcastLiveUpdate(sessionId);
}

async function command(name: string, args: Record<string, unknown>) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { data, error } = await supabase.rpc(name, args);
	if (error) throw error;
	const sessionId = args.p_session_id;
	if (typeof sessionId === 'string') broadcastLiveUpdate(sessionId);
	return data;
}

export function startMatch(
	sessionId: string,
	teamA: string[],
	teamB: string[],
	recommendationId: string | null = null,
	pairingAudit?: { recommendedA: string[]; recommendedB: string[]; diagnostics: unknown }
) {
	return (async () => {
		const matchId = await command('start_match', {
			p_session_id: sessionId,
			p_lease_id: null,
			p_team_a: teamA,
			p_team_b: teamB,
			p_rotation_recommendation_id: recommendationId
		});
		if (!pairingAudit) return { matchId, pairingAuditSaved: false };
		try {
			if (!supabase) throw new Error('Supabase is not configured.');
			const { error } = await supabase.rpc('save_pairing_recommendation', {
				p_match_id: matchId,
				p_recommended_team_a: pairingAudit.recommendedA,
				p_recommended_team_b: pairingAudit.recommendedB,
				p_diagnostics: pairingAudit.diagnostics
			});
			if (error) throw error;
			return { matchId, pairingAuditSaved: true };
		} catch {
			return { matchId, pairingAuditSaved: false };
		}
	})();
}

export async function saveRotationRecommendation(
	sessionId: string,
	recommendation: import('$lib/domain/rotation/types').RotationRecommendation
) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { data, error } = await supabase.rpc('save_rotation_recommendation', {
		p_session_id: sessionId,
		p_recommended_player_ids: recommendation.selectedPlayerIds,
		p_ranked_candidates: recommendation.rankedCandidates.map((candidate, index) => ({
			player_id: candidate.playerId,
			rank: index + 1,
			priority_score: Number.isFinite(candidate.priority) ? candidate.priority : null,
			recommended: recommendation.selectedPlayerIds.includes(candidate.playerId),
			diagnostics: {
				tier: candidate.tier,
				reasons: candidate.reasons,
				metrics: candidate.metrics
			}
		}))
	});
	if (error) throw error;
	return data as string;
}

async function trustedRatingCommand(path: string, payload: Record<string, unknown>) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { data } = await supabase.auth.getSession();
	const token = data.session?.access_token;
	if (!token) throw new Error('Sign in with a Club Admin account.');
	const response = await fetch(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
		body: JSON.stringify(payload)
	});
	const result = (await response.json()) as { message?: string; result?: unknown };
	if (!response.ok) throw new Error(result.message ?? 'Rating command failed.');
	return result;
}

export async function completeSet(
	sessionId: string,
	clubId: string,
	setId: string,
	teamAScore: number,
	teamBScore: number
) {
	const result = await trustedRatingCommand('/api/live/complete-set', {
		sessionId,
		clubId,
		setId,
		teamAScore,
		teamBScore
	});
	broadcastLiveUpdate(sessionId);
	return result.result;
}

export function abandonMatch(sessionId: string) {
	return command('abandon_match', { p_session_id: sessionId, p_lease_id: null });
}

export function addGuestAndCheckIn(sessionId: string, name: string) {
	return command('add_guest_and_check_in', {
		p_session_id: sessionId,
		p_lease_id: null,
		p_name: name
	});
}

export function substitutePlayer(
	sessionId: string,
	outgoingPlayerId: string,
	replacementPlayerId: string,
	outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
) {
	return command('substitute_player', {
		p_session_id: sessionId,
		p_lease_id: null,
		p_outgoing_player_id: outgoingPlayerId,
		p_replacement_player_id: replacementPlayerId,
		p_outgoing_status: outgoingStatus
	});
}

export function setLeaveAfterMatch(
	sessionId: string,
	participantId: string,
	leaveAfterMatch: boolean
) {
	return command('set_leave_after_match', {
		p_session_id: sessionId,
		p_lease_id: null,
		p_participant_id: participantId,
		p_leave_after_match: leaveAfterMatch
	});
}

export function closeSession(sessionId: string) {
	return command('close_session', { p_session_id: sessionId, p_lease_id: null }) as Promise<{
		attendance: number;
		sets: number;
		startedAt: string;
	}>;
}

export function reopenSession(sessionId: string) {
	return command('reopen_session', { p_session_id: sessionId, p_lease_id: null });
}

export async function suggestSessionFee(sessionId: string) {
	const result = await command('suggest_session_fee', {
		p_session_id: sessionId,
		p_lease_id: null
	});
	return result === null ? null : Number(result);
}

export async function correctCompletedSet(
	clubId: string,
	setId: string,
	teamAScore: number,
	teamBScore: number
) {
	return trustedRatingCommand('/api/live/correct-set', {
		clubId,
		setId,
		teamAScore,
		teamBScore
	});
}

export function confirmSessionFee(sessionId: string, fee: number) {
	return command('confirm_session_fee', {
		p_session_id: sessionId,
		p_lease_id: null,
		p_fee: fee
	}) as Promise<number>;
}
