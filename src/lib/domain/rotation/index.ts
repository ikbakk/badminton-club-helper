import type { Participant } from '../types';

export const ROTATION_VERSION = 'rotation-opportunity-v0';
export type RotationRank = {
	playerId: string;
	score: number;
	reasons: string[];
	recommended: boolean;
};
export type RotationResult = {
	selectedPlayerIds: string[];
	ranking: RotationRank[];
	algorithmVersion: string;
	diagnostics: { fallbackUsed: boolean; eligibleCount: number };
};

/** Provisional, explainable baseline. Weights must be calibrated by simulations and override data. */
export function recommendRotation(participants: Participant[], now = new Date()): RotationResult {
	const ready = participants.filter((p) => p.status === 'READY');
	const nonConsecutive = ready.filter((p) => p.consecutiveMatches < 2);
	const pool = nonConsecutive.length >= 4 ? nonConsecutive : ready;
	const score = (p: Participant) => {
		const waitMinutes = p.readySince
			? Math.max(0, (now.getTime() - p.readySince.getTime()) / 60000)
			: 0;
		// Opportunity debt is primary; current wait breaks ties without treating late arrivals unfairly.
		return p.missedOpportunities * 100 + waitMinutes + Math.max(0, 2 - p.consecutiveMatches) * 2;
	};
	const sorted = [...pool].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
	const selected = sorted.slice(0, 4).map((p) => p.id);
	return {
		selectedPlayerIds: selected,
		algorithmVersion: ROTATION_VERSION,
		diagnostics: { fallbackUsed: pool !== nonConsecutive, eligibleCount: ready.length },
		ranking: sorted.map((p) => ({
			playerId: p.id,
			score: score(p),
			recommended: selected.includes(p.id),
			reasons: [
				p.missedOpportunities ? 'waiting priority' : 'ready to play',
				p.consecutiveMatches >= 2 ? 'needed to fill court' : 'consecutive-play protection'
			]
		}))
	};
}
