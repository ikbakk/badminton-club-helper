import type { CandidateMetrics, RotationPlayerInput, RotationWeights } from './types';

/** Central, deliberately small baseline weights (priority points). */
export const ROTATION_WEIGHTS = {
	opportunityDebt: 100,
	readyWaitPerMinute: 1,
	setDeficitPerSet: 8,
	consecutiveSecondRotationPenalty: 75,
	thirdConsecutivePenalty: 1_000_000
} as const;

/** Small, explicit product policy; null preserves the pre-guard baseline. */
export const STARVATION_POLICIES = {
	DEBT_3_OR_WAIT_45: { currentOpportunityDebt: 3, readyWaitMinutes: 45 },
	DEBT_4_OR_WAIT_45: { currentOpportunityDebt: 4, readyWaitMinutes: 45 },
	DEBT_4_OR_WAIT_60: { currentOpportunityDebt: 4, readyWaitMinutes: 60 },
	DEBT_5_OR_WAIT_45: { currentOpportunityDebt: 5, readyWaitMinutes: 45 },
	DEBT_3_OR_WAIT_40: { currentOpportunityDebt: 3, readyWaitMinutes: 40 },
	DEBT_5_OR_WAIT_60: { currentOpportunityDebt: 5, readyWaitMinutes: 60 }
} as const;

export function candidateMetrics(player: RotationPlayerInput, nowMs: number): CandidateMetrics {
	return {
		currentReadyWaitMs:
			player.status === 'READY' && player.readySinceMs !== null
				? Math.max(0, nowMs - player.readySinceMs)
				: 0,
		eligibleOpportunities: Math.max(0, player.eligibleOpportunities),
		missedOpportunities: Math.max(0, player.missedOpportunities),
		currentOpportunityDebt: Math.max(0, player.currentOpportunityDebt),
		setsPlayed: Math.max(0, player.setsPlayed),
		consecutiveRotations: Math.max(0, player.consecutiveRotations)
	};
}

export function scoreCandidate(
	metrics: CandidateMetrics,
	lowestSetCount: number,
	weights: RotationWeights = ROTATION_WEIGHTS
): number {
	const setDeficit = Math.max(0, lowestSetCount + 2 - metrics.setsPlayed);
	const consecutivePenalty =
		metrics.consecutiveRotations >= 2
			? ROTATION_WEIGHTS.thirdConsecutivePenalty
			: metrics.consecutiveRotations === 1
				? ROTATION_WEIGHTS.consecutiveSecondRotationPenalty
				: 0;
	return (
		metrics.currentOpportunityDebt * weights.opportunityDebt +
		(metrics.currentReadyWaitMs / 60_000) * weights.readyWaitPerMinute +
		setDeficit * weights.setDeficitPerSet -
		consecutivePenalty
	);
}
