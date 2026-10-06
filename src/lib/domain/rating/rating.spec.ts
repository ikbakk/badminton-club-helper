import { describe, expect, it } from 'vitest';
import {
	applyRatingSet,
	boundedMarginMultiplier,
	evaluatePairings,
	getRatingConfidenceLabel,
	RATING_CONSTANTS,
	RATING_VERSIONS,
	type RatingState
} from '.';

const players = (sigma: number = RATING_CONSTANTS.NEWCOMER_SIGMA): RatingState[] =>
	['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, rating: 1200, sigma, games: 0 }));
const set = (scoreA = 21, scoreB = 19) => ({
	teamA: ['a', 'b'] as [string, string],
	teamB: ['c', 'd'] as [string, string],
	scoreA,
	scoreB
});
const state = (all: RatingState[], id: string) => all.find((player) => player.id === id)!;

describe('Algorithm 2 rating models', () => {
	it('uses one centralized sigma threshold for confidence presentation', () => {
		expect(getRatingConfidenceLabel(100)).toBe('ESTABLISHED');
		expect(getRatingConfidenceLabel(100.01)).toBe('CALIBRATING');
	});
	it.each(Object.values(RATING_VERSIONS))(
		'%s is deterministic and only updates actual completed set participants',
		(model) => {
			const result = applyRatingSet(model, players(), set());
			expect(result.ratings.map((player) => player.rating)).toEqual(
				applyRatingSet(model, players(), set()).ratings.map((player) => player.rating)
			);
			expect(state(result.ratings, 'e')).toEqual(state(players(), 'e'));
			expect(applyRatingSet(model, players(), { ...set(), completed: false }).ratings).toEqual(
				players()
			);
		}
	);
	it('moves an uncertainty-aware newcomer more than an established player for identical surprise', () => {
		const novice = players();
		const veteran = players(RATING_CONSTANTS.ESTABLISHED_SIGMA);
		expect(
			Math.abs(applyRatingSet(RATING_VERSIONS.TRUESKILL, novice, set()).deltaByPlayer.get('a')!)
		).toBeGreaterThan(
			Math.abs(applyRatingSet(RATING_VERSIONS.TRUESKILL, veteran, set()).deltaByPlayer.get('a')!)
		);
	});
	it('keeps sigma bounded and shrinks gradually', () => {
		let current = players();
		for (let i = 0; i < 20; i++)
			current = applyRatingSet(RATING_VERSIONS.TRUESKILL, current, set()).ratings;
		expect(state(current, 'a').sigma).toBeGreaterThanOrEqual(RATING_CONSTANTS.MIN_SIGMA);
		expect(state(current, 'a').sigma).toBeLessThan(RATING_CONSTANTS.NEWCOMER_SIGMA);
	});
	it('bounded margin is monotonic, saturating, and only changes Model C', () => {
		const values = [
			[21, 20],
			[21, 19],
			[21, 15],
			[21, 10],
			[21, 5]
		].map(([a, b]) => boundedMarginMultiplier(a, b));
		expect(values).toEqual([...values].sort((a, b) => a - b));
		expect(values.at(-1)!).toBeLessThanOrEqual(RATING_CONSTANTS.MARGIN_MAX_MULTIPLIER);
		expect(
			Math.abs(
				applyRatingSet(RATING_VERSIONS.TRUESKILL_MARGIN, players(), set(21, 10)).deltaByPlayer.get(
					'a'
				)!
			)
		).toBeGreaterThan(
			Math.abs(
				applyRatingSet(RATING_VERSIONS.TRUESKILL_MARGIN, players(), set(21, 19)).deltaByPlayer.get(
					'a'
				)!
			)
		);
		expect(
			applyRatingSet(RATING_VERSIONS.TRUESKILL, players(), set(21, 10)).deltaByPlayer.get('a')
		).toBe(
			applyRatingSet(RATING_VERSIONS.TRUESKILL, players(), set(21, 19)).deltaByPlayer.get('a')
		);
	});
	it('treats repeated surprise as more evidence without a one-set collapse', () => {
		let current = players(RATING_CONSTANTS.ESTABLISHED_SIGMA).map((p) => ({
			...p,
			rating: p.id < 'c' ? 1400 : 1200
		}));
		const upset = set(14, 21);
		const one = applyRatingSet(RATING_VERSIONS.TRUESKILL_MARGIN, current, upset).ratings;
		for (let i = 0; i < 5; i++)
			current = applyRatingSet(RATING_VERSIONS.TRUESKILL_MARGIN, current, upset).ratings;
		expect(state(one, 'a').rating).toBeLessThan(1400);
		expect(state(current, 'a').rating).toBeLessThan(state(one, 'a').rating);
	});
	it('enumerates exactly three legal pairings and deterministically chooses the smallest gap', () => {
		const ratings = [1600, 1500, 1400, 1300].map((rating, index) => ({
			id: String.fromCharCode(97 + index),
			rating,
			sigma: 80,
			games: 10
		}));
		const options = evaluatePairings(ratings);
		expect(options).toHaveLength(3);
		expect(options[0].predictedGap).toBe(0);
		expect(new Set(options.flatMap((option) => option.teams.flat())).size).toBe(4);
	});
	it('does not update a substituted-out player in the actual second-set lineup', () => {
		const result = applyRatingSet(RATING_VERSIONS.TRUESKILL_MARGIN, players(), {
			teamA: ['a', 'e'],
			teamB: ['c', 'd'],
			scoreA: 21,
			scoreB: 14
		});
		expect(state(result.ratings, 'b').games).toBe(0);
		expect(state(result.ratings, 'e').games).toBe(1);
	});
});
