import { describe, expect, it } from 'vitest';
import { recommendPairing } from '.';
const p = (id: string, rating: number) => ({
	id,
	name: id,
	membership: 'MEMBER' as const,
	rating,
	uncertainty: 0.2
});
describe('pairing', () => {
	it('chooses the closest team totals', () =>
		expect(
			recommendPairing([p('a', 1300), p('b', 1200), p('c', 1100), p('d', 1000)]).balanceGap
		).toBe(0));
	it('requires four players', () => expect(() => recommendPairing([p('a', 1)])).toThrow());
});
