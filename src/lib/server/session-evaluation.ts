import {
	evaluateSession,
	readyHistoryIsComplete,
	type SessionEvaluationInput
} from '$lib/domain/session-evaluation';
import { adminEvaluationService, requireClubAdmin } from './algorithm2-rating';

const data = <T>(result: { data: unknown; error: unknown }, label: string) => {
	if (result.error) throw new Error(`Could not load ${label}.`);
	return (result.data ?? []) as T[];
};

export async function evaluatePersistedSession(sessionId: string, token: string) {
	const db = adminEvaluationService();
	const sessionResult = await db
		.from('sessions')
		.select('id,club_id,started_at,closed_at')
		.eq('id', sessionId)
		.maybeSingle();
	if (sessionResult.error || !sessionResult.data) throw new Error('Session not found.');
	await requireClubAdmin(token, sessionResult.data.club_id);
	const [
		participantsResult,
		periodsResult,
		matchesResult,
		recommendationsResult,
		eventsResult,
		ratingResult
	] = await Promise.all([
		db
			.from('session_participants')
			.select('id,player_id,checked_in_at,players(display_name)')
			.eq('session_id', sessionId),
		db
			.from('participant_status_periods')
			.select(
				'session_participant_id,status,started_at,ended_at,session_participants!inner(player_id)'
			)
			.eq('session_participants.session_id', sessionId),
		db
			.from('matches')
			.select(
				'id,sequence_number,rotation_recommendation_id,sets(id,set_number,status,team_a_score,team_b_score,set_players(player_id,team))'
			)
			.eq('session_id', sessionId)
			.order('sequence_number'),
		db
			.from('rotation_recommendations')
			.select('id,rotation_candidate_scores(player_id,recommended)')
			.eq('session_id', sessionId),
		db
			.from('session_events')
			.select('event_type,entity_id,metadata,created_at')
			.eq('session_id', sessionId)
			.eq('event_type', 'ROTATION_STARTED')
			.order('created_at'),
		db
			.from('player_rating_history')
			.select(
				'player_id,set_id,source,rating_before,rating_after,sets!inner(match_id,matches!inner(session_id))'
			)
			.eq('sets.matches.session_id', sessionId)
	]);
	type Participant = {
		id: string;
		player_id: string;
		checked_in_at: string;
		players: { display_name: string } | null;
	};
	type Period = {
		session_participant_id: string;
		status: string;
		started_at: string;
		ended_at: string | null;
		session_participants: { player_id: string };
	};
	type DbSet = {
		id: string;
		set_number: number;
		status: string;
		team_a_score: number | null;
		team_b_score: number | null;
		set_players: { player_id: string; team: 'A' | 'B' }[];
	};
	type Match = {
		id: string;
		sequence_number: number;
		rotation_recommendation_id: string | null;
		sets: DbSet[];
	};
	type RotationRec = {
		id: string;
		rotation_candidate_scores: { player_id: string; recommended: boolean }[];
	};
	type Event = {
		event_type: string;
		entity_id: string;
		metadata: {
			ready_player_ids?: string[];
			selected_player_ids?: string[];
			rotation_recommendation_id?: string;
		};
		created_at: string;
	};
	type Rating = {
		player_id: string;
		set_id: string | null;
		source: string;
		rating_before: number;
		rating_after: number;
	};
	const participants = data<Participant>(participantsResult, 'session attendance');
	const periods = data<Period>(periodsResult, 'status history');
	const matches = data<Match>(matchesResult, 'matches');
	const rotationRecs = data<RotationRec>(recommendationsResult, 'rotation recommendations');
	const events = data<Event>(eventsResult, 'rotation events');
	const ratings = data<Rating>(ratingResult, 'rating history');
	const normalizedPeriods = periods.map((period) => ({
		playerId: period.session_participants.player_id,
		status: period.status,
		startedAt: period.started_at,
		endedAt: period.ended_at
	}));
	const rotations = events.map((event) => {
		const match = matches.find((item) => item.id === event.entity_id);
		const recId = event.metadata?.rotation_recommendation_id ?? match?.rotation_recommendation_id;
		const rec = rotationRecs.find((item) => item.id === recId);
		return {
			id: event.entity_id,
			at: event.created_at,
			readyPlayerIds: event.metadata?.ready_player_ids ?? [],
			recommendedPlayerIds:
				rec?.rotation_candidate_scores
					.filter((item) => item.recommended)
					.map((item) => item.player_id) ?? [],
			actualPlayerIds: event.metadata?.selected_player_ids ?? []
		};
	});
	const pairingResults = await db
		.from('pairing_recommendations')
		.select('id,match_id,diagnostics,pairing_recommendation_players(player_id,recommended_team)')
		.in(
			'match_id',
			matches.map((item) => item.id).length
				? matches.map((item) => item.id)
				: ['00000000-0000-0000-0000-000000000000']
		);
	type Pairing = {
		id: string;
		match_id: string;
		diagnostics: { recommended_gap?: number; pairings?: { teams: string[][]; gap: number }[] };
		pairing_recommendation_players: { player_id: string; recommended_team: 'A' | 'B' }[];
	};
	const pairings = data<Pairing>(pairingResults, 'pairing recommendations');
	const canonicalPartition = (a: string[], b: string[]) =>
		[a.slice().sort().join('|'), b.slice().sort().join('|')].sort().join('::');
	const input: SessionEvaluationInput = {
		sessionId,
		startedAt: sessionResult.data.started_at,
		closedAt: sessionResult.data.closed_at,
		players: participants.map((item) => ({
			id: item.player_id,
			name: item.players?.display_name ?? 'Pemain'
		})),
		periods: normalizedPeriods,
		readyWaitComplete:
			Boolean(sessionResult.data.closed_at) &&
			readyHistoryIsComplete({
				participants: participants.map((item) => ({
					playerId: item.player_id,
					checkedInAt: item.checked_in_at
				})),
				periods: normalizedPeriods,
				closedAt: sessionResult.data.closed_at ?? ''
			}),
		rotations,
		recommendationCount: rotationRecs.length,
		matches: matches.map((match) => {
			const pairing = pairings.find((item) => item.match_id === match.id);
			const firstSet = match.sets.find((set) => set.set_number === 1);
			const actualA =
				firstSet?.set_players
					.filter((player) => player.team === 'A')
					.map((player) => player.player_id) ?? [];
			const actualB =
				firstSet?.set_players
					.filter((player) => player.team === 'B')
					.map((player) => player.player_id) ?? [];
			const actualGap = pairing?.diagnostics?.pairings?.find(
				(option) =>
					option.teams.length === 2 &&
					canonicalPartition(option.teams[0], option.teams[1]) ===
						canonicalPartition(actualA, actualB)
			)?.gap;
			return {
				id: match.id,
				pairing: pairing
					? {
							recommendedPlayerTeams: pairing.pairing_recommendation_players.map((item) => ({
								playerId: item.player_id,
								team: item.recommended_team
							})),
							recommendedGap: Number.isFinite(Number(pairing.diagnostics?.recommended_gap))
								? Number(pairing.diagnostics?.recommended_gap)
								: null,
							actualGap: Number.isFinite(Number(actualGap)) ? Number(actualGap) : null
						}
					: undefined,
				sets: match.sets.map((set) => ({
					id: set.id,
					number: set.set_number,
					status: set.status,
					scoreA: set.team_a_score,
					scoreB: set.team_b_score,
					players: set.set_players.map((player) => ({
						playerId: player.player_id,
						team: player.team
					}))
				}))
			};
		}),
		ratingObservations: ratings.map((item) => ({
			playerId: item.player_id,
			source: item.source,
			ratingBefore: Number(item.rating_before),
			ratingAfter: Number(item.rating_after),
			setId: item.set_id
		}))
	};
	return evaluateSession(input);
}
