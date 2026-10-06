import { createClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { applyRatingSet, RATING_VERSION, type RatingState } from '$lib/domain/rating';

const url = publicEnv.PUBLIC_SUPABASE_URL;
const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = privateEnv.SUPABASE_SERVICE_ROLE_KEY;

function configured(): { url: string; anonKey: string; serviceKey: string } {
	if (!url || !anonKey || !serviceKey)
		throw new Error('Algorithm 2 server command is not configured.');
	return { url, anonKey, serviceKey };
}

function service() {
	const config = configured();
	return createClient(config.url, config.serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

export function adminEvaluationService() {
	return service();
}

export async function requireClubAdmin(token: string, clubId: string) {
	const config = configured();
	const caller = createClient(config.url, config.anonKey, {
		global: { headers: { Authorization: `Bearer ${token}` } },
		auth: { persistSession: false, autoRefreshToken: false }
	});
	const { data, error } = await caller.auth.getUser(token);
	if (error || !data.user) throw new Error('Sign in with a Club Admin account.');
	const { data: role, error: roleError } = await service()
		.from('club_roles')
		.select('user_id')
		.eq('club_id', clubId)
		.eq('user_id', data.user.id)
		.eq('role', 'CLUB_ADMIN')
		.maybeSingle();
	if (roleError || !role) throw new Error('Club Admin authority is required.');
}

type DbRating = {
	player_id: string;
	rating: string | number;
	uncertainty: string | number;
	revision: string | number;
};
type SetLineup = { player_id: string; team: 'A' | 'B' };
export type RatingTransition = {
	player_id: string;
	set_id: string;
	rating_before: number;
	rating_after: number;
	uncertainty_before: number;
	uncertainty_after: number;
	is_current?: boolean;
};

const asNumber = (value: string | number) => Number(value);

function ratingState(rows: DbRating[]): RatingState[] {
	return rows.map((row) => ({
		id: row.player_id,
		rating: asNumber(row.rating),
		sigma: asNumber(row.uncertainty),
		games: 0
	}));
}

export function calculateSetTransitions(
	states: RatingState[],
	setId: string,
	lineup: SetLineup[],
	scoreA: number,
	scoreB: number
): RatingTransition[] {
	const teamA = lineup.filter((player) => player.team === 'A').map((player) => player.player_id);
	const teamB = lineup.filter((player) => player.team === 'B').map((player) => player.player_id);
	if (teamA.length !== 2 || teamB.length !== 2 || lineup.length !== 4)
		throw new Error('A rated completed set requires two actual players per team.');
	const result = applyRatingSet(RATING_VERSION, states, {
		teamA: teamA as [string, string],
		teamB: teamB as [string, string],
		scoreA,
		scoreB
	});
	const before = new Map(states.map((state) => [state.id, state]));
	return lineup.map(({ player_id }) => {
		const previous = before.get(player_id)!;
		const next = result.ratings.find((state) => state.id === player_id)!;
		return {
			player_id,
			set_id: setId,
			rating_before: previous.rating,
			rating_after: next.rating,
			uncertainty_before: previous.sigma,
			uncertainty_after: next.sigma
		};
	});
}

export async function commitCompletedSet(input: {
	sessionId: string;
	clubId: string;
	setId: string;
	scoreA: number;
	scoreB: number;
}) {
	const db = service();
	const { data: session, error: sessionError } = await db
		.from('sessions')
		.select('id')
		.eq('id', input.sessionId)
		.eq('club_id', input.clubId)
		.eq('status', 'LIVE')
		.maybeSingle();
	if (sessionError || !session) throw new Error('Live session not found for this club.');
	const { data: match, error: matchError } = await db
		.from('matches')
		.select('id')
		.eq('session_id', input.sessionId)
		.eq('status', 'IN_PROGRESS')
		.maybeSingle();
	if (matchError || !match) throw new Error('No match is in progress.');
	const { data: set, error: setError } = await db
		.from('sets')
		.select('id')
		.eq('match_id', match.id)
		.eq('status', 'IN_PROGRESS')
		.maybeSingle();
	if (setError || !set) throw new Error('No set is in progress.');
	if (set.id !== input.setId)
		throw new Error('The selected set is no longer in progress. Reload and retry.');
	const { data: lineup, error: lineupError } = await db
		.from('set_players')
		.select('player_id,team')
		.eq('set_id', set.id);
	if (lineupError || !lineup) throw lineupError ?? new Error('Set lineup not found.');
	const ids = lineup.map((player) => player.player_id);
	const { data: ratings, error: ratingError } = await db
		.from('player_ratings')
		.select('player_id,rating,uncertainty,revision')
		.in('player_id', ids);
	if (ratingError || !ratings || ratings.length !== 4)
		throw ratingError ?? new Error('Rating state not found for actual lineup.');
	const transitions = calculateSetTransitions(
		ratingState(ratings as DbRating[]),
		set.id,
		lineup as SetLineup[],
		input.scoreA,
		input.scoreB
	);
	const expected = (ratings as DbRating[]).map((rating) => ({
		player_id: rating.player_id,
		revision: asNumber(rating.revision),
		rating: asNumber(rating.rating),
		uncertainty: asNumber(rating.uncertainty)
	}));
	const { data, error } = await db.rpc('commit_algorithm_2_completed_set', {
		p_session_id: input.sessionId,
		p_team_a_score: input.scoreA,
		p_team_b_score: input.scoreB,
		p_expected: expected,
		p_transitions: transitions
	});
	if (error) throw error;
	return data as 'SET_2' | 'MATCH_COMPLETED';
}

type RatedSet = {
	id: string;
	team_a_score: number;
	team_b_score: number;
	set_number: number;
	completed_at: string;
	match_id: string;
	players: SetLineup[];
	session_started_at: string;
	sequence_number: number;
};

type RawRatedSet = {
	id: string;
	team_a_score: string | number;
	team_b_score: string | number;
	set_number: number;
	completed_at: string;
	match_id: string;
	set_players: SetLineup[];
	matches: { sequence_number: number; sessions: { started_at: string; club_id: string } };
};

/** Replays only explicit V1-marked sets; pre-era completed sets are invisible. */
export async function replayClubRatings(input: {
	clubId: string;
	setId: string;
	scoreA: number;
	scoreB: number;
}) {
	const db = service();
	const { data: ratings, error: ratingsError } = await db
		.from('player_ratings')
		.select('player_id,rating,uncertainty,revision,players!inner(club_id)')
		.eq('players.club_id', input.clubId);
	if (ratingsError || !ratings) throw ratingsError ?? new Error('Club ratings not found.');
	const { data: anchors, error: anchorsError } = await db
		.from('player_rating_history')
		.select('player_id,rating_after,uncertainty_after')
		.eq('source', 'INITIALIZATION')
		.eq('algorithm_version', RATING_VERSION);
	if (anchorsError || !anchors)
		throw anchorsError ?? new Error('Rating initialization anchors not found.');
	const initial = anchors
		.filter((anchor) =>
			(ratings as DbRating[]).some((rating) => rating.player_id === anchor.player_id)
		)
		.map((anchor) => ({
			id: anchor.player_id,
			rating: asNumber(anchor.rating_after),
			sigma: asNumber(anchor.uncertainty_after),
			games: 0
		}));
	const { data: rawSets, error: setsError } = await db
		.from('sets')
		.select(
			'id,team_a_score,team_b_score,set_number,completed_at,match_id,set_players(player_id,team),matches!inner(sequence_number,sessions!inner(started_at,club_id))'
		)
		.eq('rating_algorithm_version', RATING_VERSION)
		.eq('matches.sessions.club_id', input.clubId)
		.eq('status', 'COMPLETED');
	if (setsError || !rawSets) throw setsError ?? new Error('Rated set timeline not found.');
	const sets = (rawSets as unknown as RawRatedSet[])
		.map((set) => ({
			id: set.id,
			team_a_score: set.id === input.setId ? input.scoreA : Number(set.team_a_score),
			team_b_score: set.id === input.setId ? input.scoreB : Number(set.team_b_score),
			set_number: set.set_number,
			completed_at: set.completed_at,
			match_id: set.match_id,
			players: set.set_players,
			session_started_at: set.matches.sessions.started_at,
			sequence_number: set.matches.sequence_number
		}))
		.sort(
			(a, b) =>
				a.session_started_at.localeCompare(b.session_started_at) ||
				a.sequence_number - b.sequence_number ||
				a.set_number - b.set_number ||
				a.id.localeCompare(b.id)
		) as RatedSet[];
	if (!sets.some((set) => set.id === input.setId))
		throw new Error('Only a V1-rated completed set can be corrected.');
	let current = initial;
	const transitions: RatingTransition[] = [];
	for (const set of sets) {
		const changes = calculateSetTransitions(
			current,
			set.id,
			set.players,
			set.team_a_score,
			set.team_b_score
		);
		transitions.push(...changes);
		const next = new Map(changes.map((change) => [change.player_id, change]));
		current = current.map((state) => {
			const change = next.get(state.id);
			return change
				? {
						...state,
						rating: change.rating_after,
						sigma: change.uncertainty_after,
						games: state.games + 1
					}
				: state;
		});
	}
	for (const transition of transitions) {
		const last = [...transitions].reverse().find((item) => item.player_id === transition.player_id);
		transition.is_current = last === transition;
	}
	const expected = (ratings as DbRating[]).map((rating) => ({
		player_id: rating.player_id,
		revision: asNumber(rating.revision)
	}));
	const { error } = await db.rpc('commit_algorithm_2_replay', {
		p_club_id: input.clubId,
		p_corrected_set_id: input.setId,
		p_team_a_score: input.scoreA,
		p_team_b_score: input.scoreB,
		p_expected_revisions: expected,
		p_transitions: transitions
	});
	if (error) throw error;
	return {
		affectedPlayers: new Set(transitions.map((transition) => transition.player_id)).size,
		ratedSets: sets.length
	};
}
