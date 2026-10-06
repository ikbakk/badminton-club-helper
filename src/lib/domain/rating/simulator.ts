import { applyRatingSet, type CompletedSet, type RatingModel, type RatingState } from '.';

/** Deterministic fold for fixed-seed/fixture scenario evaluation. */
export function simulateRatingSets(
	model: RatingModel,
	initial: RatingState[],
	sets: CompletedSet[]
) {
	return sets.reduce(
		(state, set) => applyRatingSet(model, state, set).ratings,
		initial.map((player) => ({ ...player }))
	);
}
