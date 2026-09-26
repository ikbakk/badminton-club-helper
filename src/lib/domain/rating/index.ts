import type { Player } from '../types';
export const RATING_VERSION = 'team-elo-bounded-margin-v0';
export type SetResult = { teamA: Player[]; teamB: Player[]; scoreA: number; scoreB: number };
export function updateRatings(result: SetResult): Map<string, number> {
	if (result.teamA.length !== 2 || result.teamB.length !== 2 || result.scoreA === result.scoreB)
		throw new Error('A completed doubles set needs two players per team and a winner.');
	const a = result.teamA.reduce((n, p) => n + p.rating, 0) / 2,
		b = result.teamB.reduce((n, p) => n + p.rating, 0) / 2;
	const expectedA = 1 / (1 + Math.pow(10, (b - a) / 400));
	const actualA = result.scoreA > result.scoreB ? 1 : 0;
	const margin = Math.min(1.25, 1 + Math.abs(result.scoreA - result.scoreB) / 40);
	const next = new Map<string, number>();
	for (const p of result.teamA)
		next.set(p.id, p.rating + 20 * (1 + p.uncertainty) * margin * (actualA - expectedA));
	for (const p of result.teamB)
		next.set(p.id, p.rating + 20 * (1 + p.uncertainty) * margin * (1 - actualA - (1 - expectedA)));
	return next;
}
