import type { Participant } from '../types';
import { recommendNextPlayers } from './recommend';

export * from './types';
export * from './score';
export * from './recommend';
export * from './simulator';
export * from './explain';

/** Compatibility adapter for existing domain callers; production UI is not wired to this task. */
export function recommendRotation(participants: Participant[], now = new Date()) {
	const recommendation = recommendNextPlayers(
		participants.map((participant) => ({
			id: participant.id,
			name: participant.name,
			status: participant.status,
			readySinceMs: participant.readySince?.getTime() ?? null,
			eligibleOpportunities: participant.opportunities,
			missedOpportunities: participant.missedOpportunities,
			currentOpportunityDebt: 0,
			setsPlayed: participant.setsPlayed,
			consecutiveRotations: participant.consecutiveMatches
		})),
		now.getTime()
	);
	return {
		selectedPlayerIds: recommendation.selectedPlayerIds,
		algorithmVersion: 'smart-rotation-1-baseline',
		diagnostics: {
			fallbackUsed: recommendation.diagnostics.consecutiveFallbackUsed,
			eligibleCount: recommendation.diagnostics.eligibleCount
		},
		ranking: recommendation.rankedCandidates.map((candidate) => ({
			playerId: candidate.playerId,
			score: candidate.priority,
			recommended: recommendation.selectedPlayerIds.includes(candidate.playerId),
			reasons: candidate.reasons
		}))
	};
}
