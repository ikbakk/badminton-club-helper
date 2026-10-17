import { describe, expect, it } from 'vitest';
import { simulateRandomSession, auditSelections } from '../../../../scripts/session-simulation';

describe('seeded session simulation', () => {
	it('replays the same randomized actions and selections for a seed', () => {
		const options = { seed: 42, players: 12, minimum: 3 };
		expect(simulateRandomSession(options)).toEqual(simulateRandomSession(options));
		expect(simulateRandomSession({ ...options, seed: 43 })).not.toEqual(
			simulateRandomSession(options)
		);
	});
	for (const players of [9, 10, 11, 12, 13, 14]) {
		it(`reaches three full rotation starts for every one of ${players} players`, () => {
			for (let seed = 1; seed <= 10; seed++) {
				const report = simulateRandomSession({ seed, players, minimum: 3 });
				expect(report.passed).toBe(true);
				expect(report.result.players.every((player) => player.rotationsPlayed >= 3)).toBe(true);
				expect(report.violations).toEqual([]);
				expect(report.result.selections.every((turn) => new Set(turn.actual).size === 4)).toBe(
					true
				);
			}
		});
	}
	it('reports an unmet target instead of forcing selection or silently extending a cap', () => {
		const report = simulateRandomSession({ seed: 42, players: 12, minimum: 3, maxRotations: 2 });
		expect(report.passed).toBe(false);
		expect(report.result.rotationsCompleted).toBe(2);
		expect(report.unmetPlayerIds.length).toBeGreaterThan(0);
	});
	it('keeps fill-in sets separate from full rotation starts', () => {
		const report = simulateRandomSession({ seed: 42, players: 12, minimum: 3 });
		expect(report.result.players.some((player) => player.fillInSets > 0)).toBe(true);
		expect(report.result.players.reduce((n, p) => n + p.rotationsPlayed, 0)).toBe(
			report.result.rotationsCompleted * 4
		);
	});
	it('rejects invalid sizes and nonfinite inputs', () => {
		expect(() => simulateRandomSession({ seed: 1, players: 3, minimum: 3 })).toThrow();
		expect(() => simulateRandomSession({ seed: NaN, players: 12, minimum: 3 })).toThrow();
		expect(() => simulateRandomSession({ seed: 1, players: 12, minimum: 2 })).toThrow();
	});
});

it('the independent audit rejects duplicate and not-READY selections', () => {
	const report = simulateRandomSession({ seed: 42, players: 12, minimum: 3 });
	const changed = structuredClone(report.result);
	changed.selections[0].actual = ['sim-01', 'sim-01', 'sim-03', 'sim-12'];
	const audit = auditSelections(report.scenario, changed);
	expect(audit.violations.some((message) => message.includes('distinct'))).toBe(true);
	expect(audit.violations.some((message) => message.includes('not READY'))).toBe(true);
});
