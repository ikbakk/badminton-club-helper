/** Pure, set-based Algorithm 2 model comparison domain. */
export const RATING_VERSIONS = {
	TEAM_ELO: 'team-elo-baseline-v1',
	TRUESKILL: 'trueskill-style-v1',
	TRUESKILL_MARGIN: 'trueskill-style-bounded-margin-v1'
} as const;
export type RatingModel = (typeof RATING_VERSIONS)[keyof typeof RATING_VERSIONS];
export type RatingState = { id: string; rating: number; sigma: number; games: number };
export type CompletedSet = {
	teamA: [string, string];
	teamB: [string, string];
	scoreA: number;
	scoreB: number;
	completed?: boolean;
};
export type RatingUpdate = {
	ratings: RatingState[];
	expectedA: number;
	deltaByPlayer: Map<string, number>;
};
export const RATING_CONSTANTS = {
	BASE_RATING: 1200,
	NEWCOMER_SIGMA: 280,
	ESTABLISHED_SIGMA: 65,
	MIN_SIGMA: 45,
	MAX_SIGMA: 350,
	TEAM_ELO_K: 24,
	TRUESKILL_K: 18,
	SIGMA_DECAY: 0.94,
	RATING_SCALE: 400,
	MARGIN_MAX_MULTIPLIER: 1.35,
	MARGIN_SATURATION: 10
} as const;
function validSet(set: CompletedSet) {
	return set.completed !== false && set.scoreA >= 0 && set.scoreB >= 0 && set.scoreA !== set.scoreB;
}
function probability(a: number, b: number) {
	return 1 / (1 + 10 ** ((b - a) / RATING_CONSTANTS.RATING_SCALE));
}
function teamMean(players: Map<string, RatingState>, ids: [string, string]) {
	return (players.get(ids[0])!.rating + players.get(ids[1])!.rating) / 2;
}
/** Saturating evidence: 1 + .35 × margin / (margin + 10). */
export function boundedMarginMultiplier(scoreA: number, scoreB: number) {
	const margin = Math.abs(scoreA - scoreB);
	return (
		1 +
		((RATING_CONSTANTS.MARGIN_MAX_MULTIPLIER - 1) * margin) /
			(margin + RATING_CONSTANTS.MARGIN_SATURATION)
	);
}
export function applyRatingSet(
	model: RatingModel,
	states: RatingState[],
	set: CompletedSet
): RatingUpdate {
	if (!validSet(set))
		return {
			ratings: states.map((state) => ({ ...state })),
			expectedA: 0.5,
			deltaByPlayer: new Map()
		};
	if (new Set([...set.teamA, ...set.teamB]).size !== 4)
		throw new Error('A completed doubles set needs four distinct players.');
	const byId = new Map(states.map((state) => [state.id, state]));
	for (const id of [...set.teamA, ...set.teamB])
		if (!byId.has(id)) throw new Error(`Missing rating for ${id}`);
	const expectedA = probability(teamMean(byId, set.teamA), teamMean(byId, set.teamB));
	const actualA = set.scoreA > set.scoreB ? 1 : 0;
	const margin =
		model === RATING_VERSIONS.TRUESKILL_MARGIN
			? boundedMarginMultiplier(set.scoreA, set.scoreB)
			: 1;
	const next = new Map(byId),
		deltas = new Map<string, number>();
	for (const [ids, result, expected] of [
		[set.teamA, actualA, expectedA],
		[set.teamB, 1 - actualA, 1 - expectedA]
	] as const)
		for (const id of ids) {
			const player = byId.get(id)!;
			const weight =
				model === RATING_VERSIONS.TEAM_ELO ? 1 : player.sigma / RATING_CONSTANTS.NEWCOMER_SIGMA;
			const delta =
				(model === RATING_VERSIONS.TEAM_ELO
					? RATING_CONSTANTS.TEAM_ELO_K
					: RATING_CONSTANTS.TRUESKILL_K) *
				weight *
				margin *
				(result - expected);
			deltas.set(id, delta);
			next.set(id, {
				...player,
				rating: player.rating + delta,
				sigma:
					model === RATING_VERSIONS.TEAM_ELO
						? player.sigma
						: Math.max(
								RATING_CONSTANTS.MIN_SIGMA,
								Math.min(RATING_CONSTANTS.MAX_SIGMA, player.sigma * RATING_CONSTANTS.SIGMA_DECAY)
							),
				games: player.games + 1
			});
		}
	return { ratings: states.map((state) => next.get(state.id)!), expectedA, deltaByPlayer: deltas };
}
export type PairingOption = {
	teams: [[string, string], [string, string]];
	teamStrengths: [number, number];
	predictedGap: number;
	teamAWinProbability: number;
	uncertainty: number;
};
export function evaluatePairings(states: RatingState[]): PairingOption[] {
	if (states.length !== 4 || new Set(states.map((player) => player.id)).size !== 4)
		throw new Error('Pairing requires exactly four distinct players.');
	const byId = new Map(states.map((player) => [player.id, player]));
	const [a, b, c, d] = states.map((player) => player.id);
	return (
		[
			[
				[a, b],
				[c, d]
			],
			[
				[a, c],
				[b, d]
			],
			[
				[a, d],
				[b, c]
			]
		] as PairingOption['teams'][]
	)
		.map((teams) => {
			const strengths = teams.map(
				(team) => (byId.get(team[0])!.rating + byId.get(team[1])!.rating) / 2
			) as [number, number];
			return {
				teams,
				teamStrengths: strengths,
				predictedGap: Math.abs(strengths[0] - strengths[1]),
				teamAWinProbability: probability(strengths[0], strengths[1]),
				uncertainty: teams.flat().reduce((sum, id) => sum + byId.get(id)!.sigma, 0) / 4
			};
		})
		.sort(
			(left, right) =>
				left.predictedGap - right.predictedGap ||
				left.teams.flat().join('|').localeCompare(right.teams.flat().join('|'))
		);
}
export function recommendPairing(states: RatingState[]) {
	return evaluatePairings(states)[0];
}
export const RATING_VERSION = RATING_VERSIONS.TRUESKILL_MARGIN;

export const RATING_ESTABLISHED_SIGMA_THRESHOLD = 100;

export function getRatingConfidenceLabel(sigma: number): 'CALIBRATING' | 'ESTABLISHED' {
	return sigma <= RATING_ESTABLISHED_SIGMA_THRESHOLD ? 'ESTABLISHED' : 'CALIBRATING';
}
