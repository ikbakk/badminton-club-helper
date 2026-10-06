import { describe, expect, it } from 'vitest';
import { applyRatingSet, RATING_VERSION, type RatingState } from '$lib/domain/rating';
import { calculateSetTransitions } from './algorithm2-rating';

const initial: RatingState[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
	id,
	rating: 1200,
	sigma: 280,
	games: 0
}));

describe('trusted Algorithm 2 transition manifest', () => {
	it('uses the canonical TypeScript update for exactly the actual four-player lineup', () => {
		const lineup = [
			{ player_id: 'a', team: 'A' as const },
			{ player_id: 'e', team: 'A' as const },
			{ player_id: 'c', team: 'B' as const },
			{ player_id: 'd', team: 'B' as const }
		];
		const expected = applyRatingSet(RATING_VERSION, initial, {
			teamA: ['a', 'e'],
			teamB: ['c', 'd'],
			scoreA: 21,
			scoreB: 14
		});
		const transitions = calculateSetTransitions(initial, 'set-2', lineup, 21, 14);

		expect(transitions).toHaveLength(4);
		expect(transitions.map((transition) => transition.player_id)).not.toContain('b');
		for (const transition of transitions) {
			const state = expected.ratings.find((rating) => rating.id === transition.player_id)!;
			expect(transition.rating_after).toBe(state.rating);
			expect(transition.uncertainty_after).toBe(state.sigma);
		}
	});

	it('rejects a non-doubles actual lineup before a transition can be committed', () => {
		expect(() =>
			calculateSetTransitions(initial, 'bad-set', [{ player_id: 'a', team: 'A' }], 21, 19)
		).toThrow('requires two actual players per team');
	});
});
