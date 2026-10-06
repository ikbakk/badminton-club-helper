import { explainCandidate } from './explain';
import { candidateMetrics, scoreCandidate } from './score';
import { ROTATION_WEIGHTS } from './score';
import type {
	RankedCandidate,
	RotationPlayerInput,
	RotationRecommendation,
	RotationWeights,
	StarvationPolicy
} from './types';

const tierOrder = { SHOULD_PLAY: 0, NORMAL: 1, DEPRIORITIZED: 2 } as const;

export function recommendNextPlayers(
	players: RotationPlayerInput[],
	nowMs: number,
	weights: RotationWeights = ROTATION_WEIGHTS,
	starvationPolicy: StarvationPolicy = null
): RotationRecommendation {
	const ready = players.filter((player) => player.status === 'READY');
	const setBaseline = ready.length ? Math.min(...ready.map((player) => player.setsPlayed)) : 0;
	const scored = ready.map((player) => {
		const metrics = candidateMetrics(player, nowMs);
		const debtThresholdReached =
			starvationPolicy !== null &&
			metrics.currentOpportunityDebt >= starvationPolicy.currentOpportunityDebt;
		const waitThresholdReached =
			starvationPolicy !== null &&
			metrics.currentReadyWaitMs >= starvationPolicy.readyWaitMinutes * 60_000;
		return {
			player,
			metrics,
			debtThresholdReached,
			waitThresholdReached,
			priority: scoreCandidate(metrics, setBaseline, weights)
		};
	});
	// A soft rule: hard-exclude a third consecutive rotation only while four
	// alternatives remain. Otherwise retain every READY player as a fill-in pool.
	const restedPool = scored.filter((candidate) => candidate.metrics.consecutiveRotations < 2);
	const fallbackUsed = restedPool.length < 4;
	const tiered = scored.map((candidate) => ({
		...candidate,
		tier:
			candidate.debtThresholdReached || candidate.waitThresholdReached
				? ('SHOULD_PLAY' as const)
				: candidate.metrics.consecutiveRotations >= 2 && !fallbackUsed
					? ('DEPRIORITIZED' as const)
					: ('NORMAL' as const)
	}));
	const pool = fallbackUsed
		? tiered
		: tiered.filter((candidate) => candidate.metrics.consecutiveRotations < 2);
	const ordered = [...pool].sort(
		(a, b) =>
			tierOrder[a.tier] - tierOrder[b.tier] ||
			b.priority - a.priority ||
			a.player.id.localeCompare(b.player.id)
	);
	const selected = ordered.slice(0, 4);
	const selectedIds = new Set(selected.map(({ player }) => player.id));
	const rankedCandidates: RankedCandidate[] = [
		...ordered,
		...tiered.filter((candidate) => !pool.includes(candidate))
	]
		.map(({ player, metrics, tier, priority, debtThresholdReached }) => ({
			playerId: player.id,
			tier,
			priority:
				metrics.consecutiveRotations >= 2 && !fallbackUsed ? Number.NEGATIVE_INFINITY : priority,
			reasons: [
				...(tier === 'SHOULD_PLAY'
					? [
							debtThresholdReached
								? `SHOULD PLAY: missed ${metrics.currentOpportunityDebt} eligible rotations in a row`
								: `SHOULD PLAY: READY for ${Math.floor(metrics.currentReadyWaitMs / 60_000)} minutes`
						]
					: []),
				...explainCandidate(metrics, selectedIds.has(player.id)),
				...(fallbackUsed && selectedIds.has(player.id) && metrics.consecutiveRotations >= 2
					? ['Limited READY alternatives; selected as a fill-in despite consecutive-play limit']
					: [])
			],
			metrics
		}))
		.sort(
			(a, b) =>
				(a.priority === Number.NEGATIVE_INFINITY
					? 1
					: b.priority === Number.NEGATIVE_INFINITY
						? -1
						: tierOrder[a.tier] - tierOrder[b.tier]) ||
				b.priority - a.priority ||
				a.playerId.localeCompare(b.playerId)
		);
	return {
		selectedPlayerIds: selected.map(({ player }) => player.id),
		rankedCandidates,
		diagnostics: { eligibleCount: ready.length, consecutiveFallbackUsed: fallbackUsed }
	};
}
