import { describe, expect, it } from 'vitest';
import {
	evaluateSession,
	readyHistoryIsComplete,
	type SessionEvaluationInput
} from './session-evaluation';
import { pbNewbieSessionFixture } from './session-evaluation.fixture';

const fixture: SessionEvaluationInput = {
	sessionId: 'session',
	startedAt: '2026-01-01T00:00:00Z',
	closedAt: '2026-01-01T02:00:00Z',
	players: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() })),
	periods: [
		{
			playerId: 'a',
			status: 'READY',
			startedAt: '2026-01-01T00:00:00Z',
			endedAt: '2026-01-01T00:30:00Z'
		},
		{
			playerId: 'a',
			status: 'AWAY',
			startedAt: '2026-01-01T00:30:00Z',
			endedAt: '2026-01-01T01:30:00Z'
		},
		{
			playerId: 'a',
			status: 'READY',
			startedAt: '2026-01-01T01:30:00Z',
			endedAt: '2026-01-01T02:00:00Z'
		}
	],
	readyWaitComplete: true,
	rotations: [
		{
			id: 'r1',
			at: '2026-01-01T00:20:00Z',
			readyPlayerIds: ['a', 'b', 'c', 'd', 'e'],
			recommendedPlayerIds: ['a', 'b', 'c', 'd'],
			actualPlayerIds: ['a', 'b', 'c', 'd']
		},
		{
			id: 'r2',
			at: '2026-01-01T01:40:00Z',
			readyPlayerIds: ['a', 'b', 'c', 'd', 'e'],
			recommendedPlayerIds: ['a', 'b', 'c', 'd'],
			actualPlayerIds: ['b', 'c', 'd', 'e']
		}
	],
	matches: [
		{
			id: 'm1',
			pairing: {
				recommendedGap: 24,
				recommendedPlayerTeams: [
					{ playerId: 'a', team: 'A' },
					{ playerId: 'b', team: 'A' },
					{ playerId: 'c', team: 'B' },
					{ playerId: 'd', team: 'B' }
				]
			},
			sets: [
				{
					id: 's1',
					number: 1,
					status: 'COMPLETED',
					scoreA: 21,
					scoreB: 19,
					players: [
						{ playerId: 'a', team: 'A' },
						{ playerId: 'b', team: 'A' },
						{ playerId: 'c', team: 'B' },
						{ playerId: 'd', team: 'B' }
					]
				},
				{
					id: 's2',
					number: 2,
					status: 'COMPLETED',
					scoreA: 21,
					scoreB: 8,
					players: [
						{ playerId: 'a', team: 'A' },
						{ playerId: 'e', team: 'A' },
						{ playerId: 'c', team: 'B' },
						{ playerId: 'd', team: 'B' }
					]
				}
			]
		}
	],
	recommendationCount: 3,
	ratingObservations: [
		{
			playerId: 'a',
			source: 'SET_RESULT',
			ratingBefore: 1200,
			ratingAfter: 1210,
			setId: 's1'
		}
	]
};

describe('post-session evaluation', () => {
	it('evaluates existing recommendations, actual lineups, waits, scores and flags without persistence', () => {
		const result = evaluateSession(fixture);
		expect(result.algorithm1).toMatchObject({
			recommendations: 3,
			overrides: 1,
			rotationSpread: 1,
			maxReadyWaitMinutes: 30,
			starvationIncidents: 0
		});
		expect(result.algorithm1.players.find((p) => p.playerId === 'e')).toMatchObject({
			eligibleOpportunities: 2,
			rotationsPlayed: 1,
			setsPlayed: 1
		});
		expect(result.algorithm2).toMatchObject({
			recommendations: 1,
			accepted: 1,
			overrides: 0,
			completedSets: 2,
			closeSetCount: 1,
			blowoutCount: 1
		});
		expect(result.ratingObservations[0].ratingAfter).toBe(1210);
	});
	it('normalizes a team-side swap and handles a session without matches', () => {
		const swapped = structuredClone(fixture);
		swapped.matches[0].sets[0].players = swapped.matches[0].sets[0].players.map((p) => ({
			...p,
			team: p.team === 'A' ? 'B' : 'A'
		}));
		expect(evaluateSession(swapped).algorithm2.overrides).toBe(0);
		expect(
			evaluateSession({ ...fixture, rotations: [], matches: [], recommendationCount: 0 }).algorithm2
				.completedSets
		).toBe(0);
	});
	it('counts a genuinely different team partition as an override', () => {
		const input = structuredClone(fixture);
		input.matches[0].sets[0].players = [
			{ playerId: 'a', team: 'A' },
			{ playerId: 'c', team: 'A' },
			{ playerId: 'b', team: 'B' },
			{ playerId: 'd', team: 'B' }
		];
		expect(evaluateSession(input).algorithm2.overrides).toBe(1);
	});
	it('tracks separate READY periods and late arrivals without counting RESTING or AWAY', () => {
		const input = structuredClone(fixture);
		input.players = [
			{ id: 'a', name: 'A' },
			{ id: 'late', name: 'Late' }
		];
		input.rotations = [];
		input.matches = [];
		input.periods = [
			{
				playerId: 'a',
				status: 'READY',
				startedAt: '2026-01-01T00:00:00Z',
				endedAt: '2026-01-01T00:10:00Z'
			},
			{
				playerId: 'a',
				status: 'RESTING',
				startedAt: '2026-01-01T00:10:00Z',
				endedAt: '2026-01-01T00:40:00Z'
			},
			{
				playerId: 'a',
				status: 'AWAY',
				startedAt: '2026-01-01T00:40:00Z',
				endedAt: '2026-01-01T01:30:00Z'
			},
			{
				playerId: 'a',
				status: 'READY',
				startedAt: '2026-01-01T01:30:00Z',
				endedAt: '2026-01-01T02:00:00Z'
			},
			{
				playerId: 'late',
				status: 'READY',
				startedAt: '2026-01-01T01:45:00Z',
				endedAt: '2026-01-01T02:00:00Z'
			}
		];
		const result = evaluateSession(input);
		expect(result.algorithm1.players.find((player) => player.playerId === 'a')).toMatchObject({
			totalReadyWaitMinutes: 40,
			maxReadyWaitMinutes: 30
		});
		expect(result.algorithm1.players.find((player) => player.playerId === 'late')).toMatchObject({
			totalReadyWaitMinutes: 15,
			maxReadyWaitMinutes: 15,
			starvation: false
		});
	});
	it('counts a READY player with no full rotation as starvation, not a substitution set as rotation', () => {
		const input = structuredClone(fixture);
		input.rotations = input.rotations.map((r) => ({
			...r,
			actualPlayerIds: r.actualPlayerIds.filter((id) => id !== 'e')
		}));
		const result = evaluateSession(input);
		expect(result.algorithm1.players.find((p) => p.playerId === 'e')).toMatchObject({
			rotationsPlayed: 0,
			setsPlayed: 1,
			fillInSets: 1,
			starvation: true
		});
	});
	it('evaluates the deterministic 12-player PB NEWBIE fixture consistently', () => {
		const result = evaluateSession(pbNewbieSessionFixture);
		expect(result.attendance).toBe(12);
		expect(result.algorithm1).toMatchObject({
			recommendations: 3,
			overrides: 1,
			starvationIncidents: 0
		});
		expect(result.algorithm1.players).toHaveLength(12);
		expect(
			result.algorithm1.players.find((player) => player.playerId === 'pb-05')?.fillInSets
		).toBe(1);
		expect(result.algorithm2).toMatchObject({
			recommendations: 2,
			accepted: 1,
			overrides: 1,
			completedSets: 4,
			closeSetCount: 2,
			blowoutCount: 1,
			averageActualGap: 24.5
		});
		expect(result.ratingObservations[0]).toMatchObject({ ratingAfter: 1208, setId: 'set-1-1' });
	});
	it('uses corrected persisted score margins, not an obsolete score', () => {
		const corrected = structuredClone(pbNewbieSessionFixture);
		const setOne = corrected.matches[0].sets[0];
		setOne.scoreA = 21;
		setOne.scoreB = 18;
		const result = evaluateSession(corrected);
		expect(result.algorithm2.sets.find((set) => set.setId === 'set-1-1')?.margin).toBe(3);
		expect(result.algorithm2.closeSetCount).toBe(2);
	});
	it('marks absent status-period history unavailable instead of reporting zero wait', () => {
		const incomplete = evaluateSession({ ...fixture, readyWaitComplete: false });
		expect(incomplete.algorithm1).toMatchObject({
			readyWaitStatus: 'INCOMPLETE',
			maxReadyWaitMinutes: null
		});
		expect(
			incomplete.algorithm1.players.find((player) => player.playerId === 'a')?.totalReadyWaitMinutes
		).toBeNull();
		expect(incomplete.flags).toContain('READY_WAIT_INCOMPLETE');
	});
	it('checks persisted status-period coverage end to end from check-in through session close', () => {
		const participants = [{ playerId: 'p1', checkedInAt: '2026-01-01T00:00:00Z' }];
		const periods = [
			{
				playerId: 'p1',
				status: 'READY',
				startedAt: '2026-01-01T00:00:00Z',
				endedAt: '2026-01-01T00:30:00Z'
			},
			{
				playerId: 'p1',
				status: 'AWAY',
				startedAt: '2026-01-01T00:30:00Z',
				endedAt: '2026-01-01T01:00:00Z'
			}
		];
		expect(
			readyHistoryIsComplete({ participants, periods, closedAt: '2026-01-01T01:00:00Z' })
		).toBe(true);
		expect(
			readyHistoryIsComplete({
				participants,
				periods: periods.slice(1),
				closedAt: '2026-01-01T01:00:00Z'
			})
		).toBe(false);
	});
});
