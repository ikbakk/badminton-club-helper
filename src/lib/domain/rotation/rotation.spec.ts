import { describe, expect, it } from 'vitest';
import {
	recommendNextPlayers,
	ROTATION_WEIGHTS,
	STARVATION_POLICIES,
	simulateSession
} from './index';
import type { RotationPlayerInput, RotationWeights, SimulationOptions } from './types';

const player = (id: string, overrides: Partial<RotationPlayerInput> = {}): RotationPlayerInput => ({
	id,
	name: id,
	status: 'READY',
	readySinceMs: 0,
	eligibleOpportunities: 0,
	missedOpportunities: 0,
	currentOpportunityDebt: overrides.currentOpportunityDebt ?? overrides.missedOpportunities ?? 0,
	setsPlayed: 0,
	consecutiveRotations: 0,
	...overrides
});

const tenPlayers = () => Array.from({ length: 10 }, (_, index) => ({ id: `p${index + 1}` }));

describe('Algorithm 1 scoring and recommendation', () => {
	it('centralizes explainable weights and prioritizes current opportunity debt', () => {
		const result = recommendNextPlayers(
			[
				player('newcomer'),
				player('waiting', {
					eligibleOpportunities: 8,
					missedOpportunities: 7,
					currentOpportunityDebt: 1
				}),
				player('current-debt', { missedOpportunities: 2, currentOpportunityDebt: 2 })
			],
			0,
			ROTATION_WEIGHTS,
			null
		);
		expect(result.rankedCandidates[0].playerId).toBe('current-debt');
		expect(ROTATION_WEIGHTS.opportunityDebt).toBeGreaterThan(ROTATION_WEIGHTS.setDeficitPerSet);
	});
	it('adds real READY waiting urgency when missed opportunities are equal', () => {
		const result = recommendNextPlayers(
			[
				player('long', { readySinceMs: 0, eligibleOpportunities: 2, missedOpportunities: 2 }),
				player('short', {
					readySinceMs: 60 * 60_000 - 10 * 60_000,
					eligibleOpportunities: 2,
					missedOpportunities: 2
				})
			],
			60 * 60_000
		);
		expect(result.rankedCandidates[0].playerId).toBe('long');
	});
	it('soft-excludes a third consecutive match with four READY alternatives', () => {
		const result = recommendNextPlayers(
			[
				player('hot', { consecutiveRotations: 2, missedOpportunities: 20 }),
				...Array.from({ length: 4 }, (_, i) => player(`alt${i}`, { missedOpportunities: 0 }))
			],
			0
		);
		expect(result.selectedPlayerIds).not.toContain('hot');
	});
	it('allows a third consecutive match only as an explained fill-in fallback', () => {
		const result = recommendNextPlayers(
			[player('a', { consecutiveRotations: 2 }), player('b'), player('c'), player('d')],
			0
		);
		expect(result.selectedPlayerIds).toHaveLength(4);
		expect(result.diagnostics.consecutiveFallbackUsed).toBe(true);
		expect(
			result.rankedCandidates.find((candidate) => candidate.playerId === 'a')?.reasons.join(' ')
		).toContain('fill-in');
	});
	it('filters every non-READY state and returns a deterministic four-player result', () => {
		const states = ['PLAYING', 'RESTING', 'AWAY', 'OUT', 'LEFT'] as const;
		const inputs = [
			...states.map((status, i) => player(`not-ready-${i}`, { status })),
			...Array.from({ length: 4 }, (_, i) => player(`ready-${i}`))
		];
		const result = recommendNextPlayers(inputs, 1234);
		expect(result.selectedPlayerIds).toHaveLength(4);
		expect(new Set(result.selectedPlayerIds).size).toBe(4);
		expect(result).toEqual(recommendNextPlayers(inputs, 1234));
	});
});

describe('deterministic Smart Rotation simulation scenarios', () => {
	it('A: keeps a stable 10-player population balanced and avoids repeated runs', () => {
		const result = simulateSession({
			players: tenPlayers(),
			matchDurationsMs: [35 * 60_000],
			rotations: 30
		});
		expect(result.rotationsCompleted).toBe(30);
		expect(result.metrics.selectionSpread).toBeLessThanOrEqual(1);
		expect(result.metrics.consecutiveMatchSelections).toBe(0);
		expect(result.players.every((p) => p.rotationsPlayed > 0)).toBe(true);
	});
	it('B: balances 14 players across variable match durations', () => {
		const results = (['COMBINED', 'LEAST_GAMES', 'FIFO'] as const).map((strategy) =>
			simulateSession({
				players: Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` })),
				matchDurationsMs: [12 * 60_000, 35 * 60_000, 19 * 60_000],
				rotations: 35,
				strategy
			})
		);
		expect(results[0].metrics.missedOpportunities.max).toBeLessThanOrEqual(26);
		expect(results.every((result) => result.rotationsCompleted === 35)).toBe(true);
	});
	it('C: late arrival does not jump ahead on zero games, then catches up with opportunities', () => {
		const result = simulateSession({
			players: [
				...Array.from({ length: 8 }, (_, i) => ({ id: `p${i}` })),
				{ id: 'late', arrivesAtMs: 4 * 30 * 60_000 }
			],
			matchDurationsMs: [30 * 60_000],
			rotations: 12
		});
		expect(result.selections[4].actual).not.toContain('late');
		expect(result.players.find((p) => p.playerId === 'late')?.eligibleOpportunities).toBe(8);
		expect(result.players.find((p) => p.playerId === 'late')?.rotationsPlayed).toBeGreaterThan(0);
	});
	it.each(['RESTING', 'AWAY'] as const)(
		'D/E: %s time does not create READY wait or missed opportunities',
		(status) => {
			const result = simulateSession({
				players: [...Array.from({ length: 8 }, (_, i) => ({ id: `p${i}` })), { id: 'returner' }],
				events: [
					{ atMs: 10, type: 'STATUS', playerId: 'returner', status },
					{ atMs: 4 * 30 * 60_000, type: 'STATUS', playerId: 'returner', status: 'READY' }
				],
				matchDurationsMs: [30 * 60_000],
				rotations: 6
			});
			const returning = result.players.find((p) => p.playerId === 'returner')!;
			expect(returning.eligibleOpportunities).toBeLessThanOrEqual(3);
			expect(returning.maximumContinuousReadyWaitMs).toBeLessThanOrEqual(2 * 30 * 60_000);
			expect(returning.setsPlayed).toBeGreaterThanOrEqual(0);
		}
	);
	it('F: two consecutive rotations are protected when four alternatives exist', () => {
		const result = simulateSession({
			players: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}` })),
			matchDurationsMs: [1],
			rotations: 8
		});
		expect(result.forcedThirdConsecutiveSelections).toBe(0);
	});
	it('G: still returns four when only four READY players remain after two consecutive turns', () => {
		const players = Array.from({ length: 4 }, (_, i) =>
			player(`p${i}`, { consecutiveRotations: 2 })
		);
		const result = recommendNextPlayers(players, 0);
		expect(result.selectedPlayerIds).toHaveLength(4);
		expect(result.diagnostics.consecutiveFallbackUsed).toBe(true);
	});
	it('H: longer current READY wait outranks the shorter wait at equal opportunity count', () => {
		const result = recommendNextPlayers(
			[
				player('long', { readySinceMs: 0, eligibleOpportunities: 3, missedOpportunities: 3 }),
				player('short', {
					readySinceMs: 20 * 60_000,
					eligibleOpportunities: 3,
					missedOpportunities: 3
				})
			],
			35 * 60_000
		);
		expect(result.rankedCandidates[0].playerId).toBe('long');
	});
	it('I: applies manual overrides to actual opportunity/participation history', () => {
		const result = simulateSession({
			players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` })),
			matchDurationsMs: [100],
			rotations: 1,
			overrides: { 0: ['p0', 'p1', 'p2', 'p4'] }
		});
		expect(result.selections[0].recommended).toContain('p3');
		expect(result.selections[0].actual).toContain('p4');
		expect(result.players.find((p) => p.playerId === 'p3')?.missedOpportunities).toBe(1);
		expect(result.players.find((p) => p.playerId === 'p4')?.rotationsPlayed).toBe(1);
	});
	it('J: OUT/LEFT players leave recommendations while retaining history', () => {
		const inputs = [
			player('out', { status: 'OUT', missedOpportunities: 5 }),
			player('left', { status: 'LEFT' }),
			...Array.from({ length: 4 }, (_, i) => player(`r${i}`))
		];
		const result = recommendNextPlayers(inputs, 0);
		expect(result.selectedPlayerIds).not.toContain('out');
		expect(result.selectedPlayerIds).not.toContain('left');
		expect(inputs.find((p) => p.id === 'out')?.missedOpportunities).toBe(5);
	});
	it('K: Set 2 fill-in records one set, not an extra full match rotation', () => {
		const result = simulateSession({
			players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` })),
			matchDurationsMs: [100],
			rotations: 1,
			fillIns: { 0: [{ outgoingPlayerId: 'p0', incomingPlayerId: 'p4' }] }
		});
		expect(result.players.find((p) => p.playerId === 'p0')?.setsPlayed).toBe(1);
		expect(result.players.find((p) => p.playerId === 'p4')?.setsPlayed).toBe(1);
		expect(result.players.find((p) => p.playerId === 'p4')?.rotationsPlayed).toBe(0);
		expect(result.players.find((p) => p.playerId === 'p4')?.fillInSets).toBe(1);
	});
});

describe('seeded simulation invariants and baseline comparison', () => {
	function lcg(seed: number) {
		let state = seed >>> 0;
		return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
	}
	it('checks 250 reproducible sessions spanning 4–16 players, arrivals and status transitions', () => {
		const random = lcg(0x5eed1234);
		const sensitivity = new Map(
			[60, 100, 120].map((weight) => [
				weight,
				{ spreads: 0, maxWait: 0, starvation: 0, missedSpread: 0, forcedThird: 0 }
			])
		);
		for (let session = 0; session < 250; session++) {
			const count = 4 + Math.floor(random() * 13);
			const players = Array.from({ length: count }, (_, i) => ({
				id: `s${session}-p${i}`,
				arrivesAtMs: Math.floor(random() * 6) * 15 * 60_000
			}));
			const events = players
				.slice(4)
				.filter(() => random() < 0.35)
				.map((p, i) => ({
					atMs: (i + 1) * 15 * 60_000,
					type: 'STATUS' as const,
					playerId: p.id,
					status: (['RESTING', 'AWAY', 'OUT', 'READY'] as const)[Math.floor(random() * 4)]
				}));
			const options: SimulationOptions = {
				players,
				events,
				matchDurationsMs: [(12 + Math.floor(random() * 40)) * 60_000],
				rotations: 20
			};
			const result = simulateSession(options);
			for (const selection of result.selections) {
				expect(selection.actual).toHaveLength(4);
				expect(new Set(selection.actual).size).toBe(4);
			}
			for (const p of result.players) {
				expect(p.setsPlayed).toBeGreaterThanOrEqual(0);
				expect(p.missedOpportunities).toBeGreaterThanOrEqual(0);
				expect(p.eligibleOpportunities).toBeGreaterThanOrEqual(p.missedOpportunities);
			}
			for (const opportunityDebt of [60, 100, 120]) {
				const weighted = simulateSession({
					...options,
					weights: { ...ROTATION_WEIGHTS, opportunityDebt }
				});
				const summary = sensitivity.get(opportunityDebt)!;
				const rotations = weighted.players.map((p) => p.rotationsPlayed);
				const misses = weighted.players.map((p) => p.missedOpportunities);
				summary.spreads += Math.max(...rotations) - Math.min(...rotations);
				summary.maxWait += weighted.metrics.maximumContinuousReadyWaitMs;
				summary.starvation += weighted.metrics.starvationIncidents;
				summary.missedSpread += Math.max(...misses) - Math.min(...misses);
				summary.forcedThird += weighted.forcedThirdConsecutiveSelections;
			}
		}
		for (const summary of sensitivity.values()) {
			expect(summary.forcedThird).toBe(0);
			expect(summary.spreads).toBeGreaterThanOrEqual(0);
		}
	});
	it('runs all three strategies on identical 14-player variable-duration conditions', () => {
		const setup = {
			players: Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` })),
			matchDurationsMs: [12, 35, 19].map((m) => m * 60_000),
			rotations: 40
		};
		const combined = simulateSession({ ...setup, strategy: 'COMBINED' });
		const leastGames = simulateSession({ ...setup, strategy: 'LEAST_GAMES' });
		const fifo = simulateSession({ ...setup, strategy: 'FIFO' });
		expect(combined.metrics.selectionSpread).toBeLessThanOrEqual(
			leastGames.metrics.selectionSpread + 1
		);
		expect([combined, leastGames, fifo].every((result) => result.rotationsCompleted === 40)).toBe(
			true
		);
	});
	it('bounds starvation in stable populations from 4 through 16 READY players', () => {
		for (let count = 4; count <= 16; count++) {
			const result = simulateSession({
				players: Array.from({ length: count }, (_, i) => ({ id: `n${count}-p${i}` })),
				matchDurationsMs: [12, 35, 19].map((minutes) => minutes * 60_000),
				rotations: 60
			});
			expect(
				result.players.every((player) => player.rotationsPlayed > 0),
				`starved player in stable ${count}-player session`
			);
			expect(result.metrics.selectionSpread).toBeLessThanOrEqual(1);
			expect(result.forcedThirdConsecutiveSelections).toBe(0);
		}
	});
});

describe('adversarial Smart Rotation regression scenarios', () => {
	it('applies a deterministic SHOULD_PLAY tier without overriding consecutive protection', () => {
		const options = [
			...Array.from({ length: 4 }, (_, i) => player(`alt${i}`)),
			player('protected', { missedOpportunities: 8, consecutiveRotations: 2 })
		];
		const recommendation = recommendNextPlayers(
			options,
			0,
			ROTATION_WEIGHTS,
			STARVATION_POLICIES.DEBT_4_OR_WAIT_45
		);
		expect(recommendation.selectedPlayerIds).toHaveLength(4);
		expect(recommendation.selectedPlayerIds).not.toContain('protected');
		expect(
			recommendation.rankedCandidates.find((candidate) => candidate.playerId === 'protected')?.tier
		).toBe('SHOULD_PLAY');
		const fatigued = recommendNextPlayers(
			[
				...Array.from({ length: 4 }, (_, i) => player(`rested${i}`)),
				player('fatigued', { consecutiveRotations: 2 })
			],
			0,
			ROTATION_WEIGHTS,
			STARVATION_POLICIES.DEBT_4_OR_WAIT_45
		);
		expect(
			fatigued.rankedCandidates.find((candidate) => candidate.playerId === 'fatigued')?.tier
		).toBe('DEPRIORITIZED');
		expect(fatigued.selectedPlayerIds).not.toContain('fatigued');
		const shouldPlay = Array.from({ length: 6 }, (_, i) =>
			player(`urgent${i}`, { missedOpportunities: 8, currentOpportunityDebt: 4 })
		);
		const first = recommendNextPlayers(
			shouldPlay,
			0,
			ROTATION_WEIGHTS,
			STARVATION_POLICIES.DEBT_4_OR_WAIT_45
		);
		expect(first.selectedPlayerIds).toEqual(
			recommendNextPlayers(shouldPlay, 0, ROTATION_WEIGHTS, STARVATION_POLICIES.DEBT_4_OR_WAIT_45)
				.selectedPlayerIds
		);
		expect(first.selectedPlayerIds).toEqual(['urgent0', 'urgent1', 'urgent2', 'urgent3']);
	});

	it('compares candidate starvation thresholds on newcomer, wait, and stable 10/14-player sessions', () => {
		const policies = [null, ...Object.values(STARVATION_POLICIES)];
		const newcomerSetup = {
			players: [
				...Array.from({ length: 8 }, (_, i) => ({ id: `old${i}` })),
				{ id: 'new', arrivesAtMs: 6 * 20 * 60_000 }
			],
			matchDurationsMs: [20 * 60_000],
			rotations: 14
		};
		const results = policies.map((starvationPolicy) =>
			simulateSession({ ...newcomerSetup, starvationPolicy })
		);
		const baseline = results[0];
		const product = results[2]; // missed >= 4 OR continuous READY wait >= 45m
		const baselineNew = baseline.players.find((p) => p.playerId === 'new')!;
		const guardedNew = product.players.find((p) => p.playerId === 'new')!;
		const comparisonRows = results.map((result) => ({
			newRotations: result.players.find((p) => p.playerId === 'new')!.rotationsPlayed,
			newMissed: result.players.find((p) => p.playerId === 'new')!.missedOpportunities,
			firstSelection: result.selections.findIndex((s) => s.actual.includes('new')),
			rotationSpread: result.metrics.selectionSpread,
			setsSpread: result.metrics.setsPlayed.max - result.metrics.setsPlayed.min,
			missedSpread: result.metrics.missedOpportunities.max - result.metrics.missedOpportunities.min,
			maxWaitMinutes: result.metrics.maximumContinuousReadyWaitMs / 60_000,
			starvation: result.metrics.starvationIncidents,
			forcedThird: result.forcedThirdConsecutiveSelections
		}));
		expect(comparisonRows.every((row) => row.newRotations === 4 && row.newMissed === 4)).toBe(true);
		expect(comparisonRows.every((row) => row.firstSelection === 7)).toBe(true);
		expect(
			comparisonRows.every(
				(row) =>
					row.rotationSpread === 3 &&
					row.setsSpread === 6 &&
					row.missedSpread === 5 &&
					row.maxWaitMinutes === 40 &&
					row.starvation === 0 &&
					row.forcedThird === 0
			)
		).toBe(true);
		expect(baselineNew.eligibleOpportunities).toBe(8);
		expect(baselineNew.rotationsPlayed).toBeGreaterThan(1);
		expect(baselineNew.missedOpportunities).toBeLessThan(7);
		expect(baselineNew.maximumContinuousReadyWaitMs).toBeLessThan(120 * minuteMs(1));
		expect(guardedNew.rotationsPlayed).toBe(baselineNew.rotationsPlayed);
		expect(
			results
				.slice(1)
				.every(
					(outcome) =>
						outcome.players.find((p) => p.playerId === 'new')?.rotationsPlayed ===
						baselineNew.rotationsPlayed
				)
		).toBe(true);
		for (const count of [10, 14]) {
			const stableOptions = {
				players: Array.from({ length: count }, (_, i) => ({ id: `stable${count}-${i}` })),
				matchDurationsMs: [12, 35, 19].map(minuteMs),
				rotations: 40
			};
			const outcomes = policies.map((starvationPolicy) =>
				simulateSession({ ...stableOptions, starvationPolicy })
			);
			for (const outcome of outcomes) {
				expect(outcome.forcedThirdConsecutiveSelections).toBe(0);
				expect(outcome.metrics.selectionSpread).toBeLessThanOrEqual(1);
			}
		}
	});

	it('long READY wait protects a modest-debt player, but RESTING time does not', () => {
		const guarded = recommendNextPlayers(
			[
				player('waiting', {
					missedOpportunities: 1,
					currentOpportunityDebt: 1,
					readySinceMs: 0
				}),
				player('other')
			],
			45 * 60_000,
			ROTATION_WEIGHTS,
			STARVATION_POLICIES.DEBT_4_OR_WAIT_45
		);
		expect(
			guarded.rankedCandidates.find((candidate) => candidate.playerId === 'waiting')?.tier
		).toBe('SHOULD_PLAY');
		const rested = recommendNextPlayers(
			[
				player('returner', { status: 'READY', readySinceMs: 45 * 60_000, missedOpportunities: 0 }),
				player('resting', { status: 'RESTING', readySinceMs: null, missedOpportunities: 0 })
			],
			45 * 60_000
		);
		expect(
			rested.rankedCandidates.find((candidate) => candidate.playerId === 'returner')?.tier
		).toBe('NORMAL');
		expect(rested.rankedCandidates.map((candidate) => candidate.playerId)).not.toContain('resting');
	});

	it('A: one missed opportunity is offset by 100 additional READY-wait minutes', () => {
		for (const waitMinutes of [20, 40, 60, 104, 105, 106]) {
			const result = recommendNextPlayers(
				[
					player('A', { missedOpportunities: 3, readySinceMs: 115 * 60_000 }),
					player('B', {
						missedOpportunities: 2,
						readySinceMs: (120 - waitMinutes) * 60_000
					})
				],
				120 * 60_000,
				ROTATION_WEIGHTS,
				null
			);
			const winner = result.rankedCandidates[0].playerId;
			expect(winner === 'B').toBe(waitMinutes > 105);
		}
	});

	it('B: late newcomer catches up without jumping ahead of long-time attendees', () => {
		const setup = {
			players: [
				...Array.from({ length: 8 }, (_, i) => ({ id: `old${i}` })),
				{ id: 'new', arrivesAtMs: 6 * 20 * 60_000 }
			],
			matchDurationsMs: [20 * 60_000],
			rotations: 14
		};
		const smart = simulateSession({ ...setup, starvationPolicy: null });
		const least = simulateSession({ ...setup, strategy: 'LEAST_GAMES' });
		expect(smart.selections[6].actual).not.toContain('new');
		expect(least.selections[6].actual).toContain('new');
		expect(smart.players.find((p) => p.playerId === 'new')?.rotationsPlayed).toBeGreaterThan(0);
		expect(smart.players.find((p) => p.playerId === 'new')?.eligibleOpportunities).toBe(8);
	});

	it('C: repeated RESTING/READY transitions reset wait and pause opportunity accrual', () => {
		const minute = 60_000;
		const result = simulateSession({
			players: [...Array.from({ length: 8 }, (_, i) => ({ id: `p${i}` })), { id: 'toggle' }],
			events: [
				{ atMs: minute, type: 'STATUS', playerId: 'toggle', status: 'RESTING' },
				{ atMs: 5 * minute, type: 'STATUS', playerId: 'toggle', status: 'READY' },
				{ atMs: 6 * minute, type: 'STATUS', playerId: 'toggle', status: 'RESTING' },
				{ atMs: 10 * minute, type: 'STATUS', playerId: 'toggle', status: 'READY' }
			],
			matchDurationsMs: [minute],
			rotations: 12
		});
		const toggle = result.players.find((p) => p.playerId === 'toggle')!;
		expect(toggle.maximumContinuousReadyWaitMs).toBeLessThanOrEqual(2 * minute);
		expect(toggle.totalReadyWaitMs).toBeLessThanOrEqual(4 * minute);
		// One initial READY exposure, one between the first pair of transitions, two after return.
		expect(toggle.eligibleOpportunities).toBe(4);
		expect(toggle.missedOpportunities).toBeLessThanOrEqual(toggle.eligibleOpportunities);
	});

	it('D: repeated admin overrides accrue misses for the ignored candidate, then rank them urgently', () => {
		const result = simulateSession({
			players: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` })),
			matchDurationsMs: [minuteMs(15)],
			rotations: 5,
			overrides: Object.fromEntries(
				Array.from({ length: 4 }, (_, index) => [index, ['p0', 'p1', 'p2', 'p4']])
			)
		});
		const ignored = result.players.find((p) => p.playerId === 'p3')!;
		expect(ignored.missedOpportunities).toBe(4);
		expect(ignored.rotationsPlayed).toBe(1);
		expect(ignored.currentOpportunityDebt).toBe(0);
		const next = recommendNextPlayers(
			result.players.map((p) =>
				player(p.playerId, {
					setsPlayed: p.setsPlayed,
					eligibleOpportunities: p.eligibleOpportunities,
					missedOpportunities: p.missedOpportunities,
					currentOpportunityDebt: p.currentOpportunityDebt,
					consecutiveRotations: p.consecutiveRotations,
					readySinceMs: 0
				})
			),
			15 * minuteMs(1)
		);
		expect(next.selectedPlayerIds).toContain('p3');
	});

	it('E/I: equal missed count gives higher urgency to longer READY wait', () => {
		const result = recommendNextPlayers(
			[
				player('A', { missedOpportunities: 2, readySinceMs: 35 * 60_000 }),
				player('B', { missedOpportunities: 2, readySinceMs: 0 })
			],
			50 * 60_000
		);
		expect(result.rankedCandidates[0].playerId).toBe('B');
	});

	it('F: compares all strategies in a mixed 12-player session with events, override, and fill-in', () => {
		const setup = {
			players: Array.from({ length: 12 }, (_, i) => ({
				id: `m${i}`,
				arrivesAtMs: i < 8 ? 0 : (i - 7) * 25 * 60_000
			})),
			events: [
				{ atMs: 4 * 60_000, type: 'STATUS' as const, playerId: 'm1', status: 'RESTING' as const },
				{ atMs: 45 * 60_000, type: 'STATUS' as const, playerId: 'm1', status: 'READY' as const },
				{ atMs: 55 * 60_000, type: 'STATUS' as const, playerId: 'm6', status: 'AWAY' as const },
				{ atMs: 130 * 60_000, type: 'STATUS' as const, playerId: 'm6', status: 'READY' as const },
				{ atMs: 165 * 60_000, type: 'STATUS' as const, playerId: 'm11', status: 'LEFT' as const }
			],
			matchDurationsMs: [12, 35, 19].map((m) => m * 60_000),
			rotations: 24,
			overrides: { 2: ['m1', 'm2', 'm3', 'm4'], 7: ['m1', 'm3', 'm5', 'm7'] },
			fillIns: { 0: [{ outgoingPlayerId: 'm0', incomingPlayerId: 'm4' }] }
		};
		const results = (['LEAST_GAMES', 'FIFO', 'COMBINED'] as const).map((strategy) =>
			simulateSession({ ...setup, strategy, starvationPolicy: null })
		);
		const guardComparisons = [null, ...Object.values(STARVATION_POLICIES)].map((starvationPolicy) =>
			simulateSession({ ...setup, strategy: 'COMBINED', starvationPolicy })
		);
		const dynamicMetrics = guardComparisons.map((result) => ({
			rotationSpread: result.metrics.selectionSpread,
			setsSpread: result.metrics.setsPlayed.max - result.metrics.setsPlayed.min,
			missedSpread: result.metrics.missedOpportunities.max - result.metrics.missedOpportunities.min,
			maxWaitMinutes: result.metrics.maximumContinuousReadyWaitMs / 60_000,
			starvation: result.metrics.starvationIncidents,
			lateTurns: result.players.find((p) => p.playerId === 'm11')!.rotationsPlayed,
			forcedThird: result.forcedThirdConsecutiveSelections
		}));
		expect(dynamicMetrics.every((metric) => metric.rotationSpread === 10)).toBe(true);
		expect(
			dynamicMetrics.every(
				(metric) =>
					metric.setsSpread === 21 &&
					metric.missedSpread === 15 &&
					metric.maxWaitMinutes === 66 &&
					metric.starvation === 0 &&
					metric.lateTurns === 1 &&
					metric.forcedThird === 0
			)
		).toBe(true);
		expect(guardComparisons.every((result) => result.rotationsCompleted > 15)).toBe(true);
		expect(guardComparisons.every((result) => result.forcedThirdConsecutiveSelections === 0)).toBe(
			true
		);
		expect(guardComparisons.every((result) => result.metrics.starvationIncidents === 0)).toBe(true);
		expect(
			guardComparisons.every(
				(result) => result.players.find((player) => player.playerId === 'm11')!.rotationsPlayed > 0
			)
		).toBe(true);
		expect(results.every((result) => result.rotationsCompleted > 15)).toBe(true);
		expect(results[2].players.find((p) => p.playerId === 'm4')?.fillInSets).toBe(1);
		expect(
			results[2].players.find((p) => p.playerId === 'm6')?.eligibleOpportunities
		).toBeLessThanOrEqual(24);
		expect(results.every((result) => result.players.every((p) => p.setsPlayed >= 0))).toBe(true);
		const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
		expect(spread(results[2].players.map((p) => p.missedOpportunities))).toBeLessThan(
			spread(results[1].players.map((p) => p.missedOpportunities))
		);
		expect(results[2].forcedThirdConsecutiveSelections).toBe(0);
		expect(
			results[2].players
				.filter((p) => p.eligibleOpportunities > 0 && p.rotationsPlayed === 0)
				.map((p) => p.playerId)
		).toEqual([]);
	});

	it('G: set deficit is secondary to an additional missed rotation', () => {
		const result = recommendNextPlayers(
			[
				player('debt', { missedOpportunities: 3, setsPlayed: 8 }),
				player('low-sets', { missedOpportunities: 2, setsPlayed: 0 })
			],
			0
		);
		expect(result.rankedCandidates[0].playerId).toBe('debt');
	});

	it('H: soft consecutive protection behaves sensibly with five and six READY players', () => {
		for (const count of [5, 6]) {
			const inputs = Array.from({ length: count }, (_, i) =>
				player(`p${i}`, {
					consecutiveRotations: i < count - 1 ? 2 : 0,
					missedOpportunities: i < count - 1 ? 0 : 1
				})
			);
			const result = recommendNextPlayers(inputs, 0);
			expect(result.selectedPlayerIds).toHaveLength(4);
			expect(result.diagnostics.consecutiveFallbackUsed).toBe(true);
		}
		const enoughAlternatives = recommendNextPlayers(
			[
				...Array.from({ length: 4 }, (_, i) => player(`alt${i}`)),
				player('hot', { consecutiveRotations: 2, missedOpportunities: 50 })
			],
			0
		);
		expect(enoughAlternatives.selectedPlayerIds).not.toContain('hot');
	});

	it('J: consecutive-heavy groups stay excluded where possible, but fairness debt wins in fallback', () => {
		const result = recommendNextPlayers(
			[
				...Array.from({ length: 3 }, (_, i) =>
					player(`hot${i}`, { consecutiveRotations: 2, missedOpportunities: 20 })
				),
				player('debt1', { missedOpportunities: 5 }),
				player('debt2', { missedOpportunities: 4 })
			],
			0
		);
		expect(result.selectedPlayerIds).toHaveLength(4);
		expect(result.diagnostics.consecutiveFallbackUsed).toBe(true);
		expect(result.selectedPlayerIds).toContain('debt1');
		expect(
			result.rankedCandidates.find((candidate) => candidate.playerId === 'hot0')?.reasons.join(' ')
		).toContain('2 or more');
	});

	it('runs a controlled fixed-grid weight sensitivity sweep without changing fatigue rules', () => {
		const waitDebtCase = (weights: RotationWeights) =>
			recommendNextPlayers(
				[
					player('opportunity', { missedOpportunities: 3, readySinceMs: 65 * 60_000 }),
					player('wait', { missedOpportunities: 2, readySinceMs: 10 * 60_000 })
				],
				70 * 60_000,
				weights,
				null
			).selectedPlayerIds[0];
		const missed = [60, 80, 100, 120];
		const wait = [0.5, 1, 1.5, 2];
		const set = [4, 8, 12];
		const results: Array<{ missed: number; wait: number; set: number; winner: string }> = [];
		for (const missedOpportunity of missed) {
			for (const readyWaitPerMinute of wait) {
				for (const setDeficitPerSet of set) {
					const weights = {
						...ROTATION_WEIGHTS,
						opportunityDebt: missedOpportunity,
						readyWaitPerMinute,
						setDeficitPerSet
					};
					results.push({
						missed: missedOpportunity,
						wait: readyWaitPerMinute,
						set: setDeficitPerSet,
						winner: waitDebtCase(weights)
					});
				}
			}
		}
		expect(results).toHaveLength(48);
		expect(results.filter((row) => row.winner === 'wait').length).toBeGreaterThan(0);
		expect(results.filter((row) => row.winner === 'opportunity').length).toBeGreaterThan(0);
	});

	it('reports outcome metrics for selected weight variants on one fixed dynamic session', () => {
		const setup: SimulationOptions = {
			players: Array.from({ length: 12 }, (_, i) => ({
				id: `w${i}`,
				arrivesAtMs: i < 8 ? 0 : (i - 7) * 25 * minuteMs(1)
			})),
			events: [
				{ atMs: minuteMs(4), type: 'STATUS', playerId: 'w1', status: 'RESTING' },
				{ atMs: minuteMs(45), type: 'STATUS', playerId: 'w1', status: 'READY' },
				{ atMs: minuteMs(55), type: 'STATUS', playerId: 'w6', status: 'AWAY' },
				{ atMs: minuteMs(130), type: 'STATUS', playerId: 'w6', status: 'READY' },
				{ atMs: minuteMs(165), type: 'STATUS', playerId: 'w11', status: 'LEFT' }
			],
			matchDurationsMs: [12, 35, 19].map(minuteMs),
			rotations: 24,
			overrides: { 2: ['w1', 'w2', 'w3', 'w4'], 7: ['w1', 'w3', 'w5', 'w7'] },
			fillIns: { 0: [{ outgoingPlayerId: 'w0', incomingPlayerId: 'w4' }] }
		};
		const configs: Array<{ name: string; weights: RotationWeights }> = [
			{ name: 'low-opportunity', weights: { ...ROTATION_WEIGHTS, opportunityDebt: 60 } },
			{ name: 'current', weights: ROTATION_WEIGHTS },
			{ name: 'high-wait', weights: { ...ROTATION_WEIGHTS, readyWaitPerMinute: 2 } },
			{ name: 'high-set', weights: { ...ROTATION_WEIGHTS, setDeficitPerSet: 12 } }
		];
		const metrics = configs.map(({ name, weights }) => {
			const result = simulateSession({ ...setup, weights, starvationPolicy: null });
			const rotations = result.players.map((p) => p.rotationsPlayed);
			const sets = result.players.map((p) => p.setsPlayed);
			const misses = result.players.map((p) => p.missedOpportunities);
			const repeatedSkip = simulateSession({
				players: Array.from({ length: 5 }, (_, i) => ({ id: `skip${i}` })),
				matchDurationsMs: [minuteMs(15)],
				rotations: 4,
				overrides: Object.fromEntries(
					Array.from({ length: 4 }, (_, index) => [index, ['skip0', 'skip1', 'skip2', 'skip4']])
				)
			});
			const ignored = repeatedSkip.players.find((p) => p.playerId === 'skip3')!;
			const overrideRecovery = recommendNextPlayers(
				repeatedSkip.players.map((p) =>
					player(p.playerId, {
						eligibleOpportunities: p.eligibleOpportunities,
						missedOpportunities: p.missedOpportunities,
						currentOpportunityDebt: p.currentOpportunityDebt,
						setsPlayed: p.setsPlayed,
						consecutiveRotations: p.consecutiveRotations,
						readySinceMs: 0
					})
				),
				minuteMs(60),
				weights,
				null
			).selectedPlayerIds.includes('skip3');
			return {
				name,
				rotationSpread: Math.max(...rotations) - Math.min(...rotations),
				setsSpread: Math.max(...sets) - Math.min(...sets),
				maxReadyWaitMs: result.metrics.maximumContinuousReadyWaitMs,
				missedSpread: Math.max(...misses) - Math.min(...misses),
				forcedThird: result.forcedThirdConsecutiveSelections,
				starvation: result.metrics.starvationIncidents,
				lateArrivalRotations: result.players
					.filter((p) => p.playerId === 'w11')
					.map((p) => p.rotationsPlayed)[0],
				overrideRecovery,
				ignoredMisses: ignored.missedOpportunities
			};
		});
		expect(metrics.every((metric) => metric.rotationSpread >= 0 && metric.setsSpread >= 0)).toBe(
			true
		);
		expect(metrics.every((metric) => metric.forcedThird === 0)).toBe(true);
		expect(metrics.every((metric) => metric.overrideRecovery && metric.ignoredMisses === 4)).toBe(
			true
		);
		expect(
			metrics.every((metric) => metric.starvation === 0 && metric.lateArrivalRotations > 0)
		).toBe(true);
		expect(metrics.find((metric) => metric.name === 'low-opportunity')?.maxReadyWaitMs).toBe(
			66 * minuteMs(1)
		);
		expect(metrics.find((metric) => metric.name === 'current')?.maxReadyWaitMs).toBe(
			66 * minuteMs(1)
		);
	});
});

function minuteMs(minutes: number) {
	return minutes * 60_000;
}
