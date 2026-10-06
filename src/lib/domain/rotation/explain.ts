import type { CandidateMetrics } from './types';

export function explainCandidate(metrics: CandidateMetrics, selected: boolean): string[] {
	const reasons: string[] = [];
	if (metrics.currentOpportunityDebt > 0) {
		reasons.push(
			`Missed ${metrics.currentOpportunityDebt} eligible rotation${metrics.currentOpportunityDebt === 1 ? '' : 's'} in a row`
		);
	}
	if (metrics.currentReadyWaitMs >= 60_000) {
		reasons.push(`Has been READY for ${Math.floor(metrics.currentReadyWaitMs / 60_000)} minutes`);
	}
	if (metrics.consecutiveRotations >= 2) reasons.push('Just played 2 or more matches in a row');
	else if (metrics.consecutiveRotations === 1) reasons.push('Played the previous rotation');
	if (metrics.setsPlayed === 0) reasons.push('Has played fewer sets tonight');
	if (reasons.length === 0)
		reasons.push(selected ? 'Ready to play' : 'Lower current rotation priority');
	return reasons;
}
