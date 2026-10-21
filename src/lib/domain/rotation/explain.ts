import type { CandidateMetrics } from './types';

function formatReadyWait(milliseconds: number): string {
	const minutes = Math.floor(milliseconds / 60_000);
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	if (hours === 0) return `${minutes} menit`;
	if (remainingMinutes === 0) return `${hours} jam`;
	return `${hours} jam ${remainingMinutes} menit`;
}

export function explainCandidate(metrics: CandidateMetrics, selected: boolean): string[] {
	const reasons: string[] = [];
	if (metrics.currentOpportunityDebt > 0) {
		reasons.push(
			`Tidak terpilih dalam ${metrics.currentOpportunityDebt} kesempatan rotasi saat siap${metrics.currentOpportunityDebt === 1 ? '' : ' berturut-turut'}`
		);
	}
	if (metrics.currentReadyWaitMs >= 60_000) {
		reasons.push(`Berstatus SIAP selama ${formatReadyWait(metrics.currentReadyWaitMs)}`);
	}
	if (metrics.consecutiveRotations >= 2)
		reasons.push(`Baru bermain ${metrics.consecutiveRotations} match berturut-turut`);
	else if (metrics.consecutiveRotations === 1) reasons.push('Bermain pada giliran sebelumnya');
	if (metrics.setsPlayed === 0) reasons.push('Belum bermain set malam ini');
	if (reasons.length === 0)
		reasons.push(selected ? 'Siap bermain' : 'Prioritas rotasi lebih rendah saat ini');
	return reasons;
}
