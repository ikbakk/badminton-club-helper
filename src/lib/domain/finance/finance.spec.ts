import { describe, expect, it } from 'vitest';
import { clubBalance, credit, debt } from '.';
describe('derived finance', () =>
	it('derives balances from facts', () => {
		expect(debt([{ amount: 30000 }], [{ amount: 10000 }])).toBe(20000);
		expect(credit([{ amount: 30000 }], [{ amount: 10000 }])).toBe(20000);
		expect(clubBalance([{ amount: 30000 }], [{ amount: 12000 }])).toBe(18000);
	}));
