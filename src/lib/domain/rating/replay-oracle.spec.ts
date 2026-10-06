import { describe, expect, it } from 'vitest';
import { applyRatingSet, RATING_VERSION, type CompletedSet, type RatingState } from '.';

const epsilon = 1e-12;
const initial: RatingState[] = ['a', 'b', 'c', 'd'].map((id) => ({
	id,
	rating: 1200,
	sigma: 280,
	games: 0
}));

const timeline: CompletedSet[] = [
	{ teamA: ['a', 'b'], teamB: ['c', 'd'], scoreA: 21, scoreB: 17 },
	{ teamA: ['a', 'c'], teamB: ['b', 'd'], scoreA: 18, scoreB: 21 },
	{ teamA: ['a', 'd'], teamB: ['b', 'c'], scoreA: 21, scoreB: 15 },
	{ teamA: ['a', 'b'], teamB: ['c', 'd'], scoreA: 19, scoreB: 21 }
];

describe('Algorithm 2 replay oracle', () => {
	it('rebuilds a corrected older set from the initialization boundary', () => {
		const corrected = timeline.map((set, index) =>
			index === 1 ? { ...set, scoreA: 21, scoreB: 18 } : set
		);
		const replayed = corrected.reduce(
			(states, set) => applyRatingSet(RATING_VERSION, states, set).ratings,
			initial
		);
		let states = initial;
		for (const set of corrected) states = applyRatingSet(RATING_VERSION, states, set).ratings;
		for (const player of replayed) {
			const expected = states.find((state) => state.id === player.id)!;
			expect(Math.abs(player.rating - expected.rating)).toBeLessThan(epsilon);
			expect(Math.abs(player.sigma - expected.sigma)).toBeLessThan(epsilon);
		}
	});
});
