import { expect, it } from 'vitest';
import { kokShares } from './session-charges';

it('splits kok by actual completed set appearances after a substitution', () => {
	const shares = kokShares(
		[
			{
				id: 'm1',
				kokCount: 3,
				sets: [
					{ players: ['a', 'b', 'c', 'd'].map((id) => ({ id })) },
					{ players: ['a', 'b', 'c', 'e'].map((id) => ({ id })) }
				]
			}
		],
		10000
	);
	expect([...shares.values()].reduce((a, b) => a + b, 0)).toBe(30000);
	expect(shares.get('a')).toBe(7500);
	expect(shares.get('d')).toBe(3750);
	expect(shares.get('e')).toBe(3750);
});
