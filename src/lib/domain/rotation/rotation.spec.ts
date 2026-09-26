import { describe, expect, it } from 'vitest';
import { recommendRotation } from '.';
import type { Participant } from '../types';
const p = (id: string, missed: number, consecutive = 0): Participant => ({
	id,
	name: id,
	membership: 'MEMBER',
	rating: 1200,
	uncertainty: 0.3,
	status: 'READY',
	readySince: new Date(Date.now() - 1000),
	opportunities: 3,
	missedOpportunities: missed,
	consecutiveMatches: consecutive,
	setsPlayed: 0
});
describe('rotation', () => {
	it('prioritises missed opportunities', () =>
		expect(
			recommendRotation([p('a', 0), p('b', 4), p('c', 2), p('d', 1)]).selectedPlayerIds[0]
		).toBe('b'));
	it('protects third consecutive match where four alternatives exist', () => {
		const r = recommendRotation([p('a', 9, 2), p('b', 1), p('c', 1), p('d', 1), p('e', 1)]);
		expect(r.selectedPlayerIds).not.toContain('a');
	});
});
