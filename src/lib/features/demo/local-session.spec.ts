import { describe, expect, it } from 'vitest';
import {
	checkInDemoPlayers,
	completeDemoSet,
	correctDemoSet,
	DEMO_STORAGE_KEY,
	finishDemoTie,
	freshDemoState,
	sampleMatchDemoState,
	readDemoState,
	setDemoStatus,
	startDemoDecider,
	startDemoMatch,
	substituteDemoPlayer
} from './local-session';

describe('browser demo session', () => {
	it('starts with attendance before any match', () => {
		const state = freshDemoState();
		expect(state.session).toBeNull();
		expect(state.activeMatches).toHaveLength(0);
		expect(state.participants.every((player) => player.status === 'OUT')).toBe(true);
	});
	it('checks in a selected group as READY together without partial updates', () => {
		const state = freshDemoState();
		state.session = sampleMatchDemoState().session;
		expect(checkInDemoPlayers(state, ['demo-0', 'missing-player'])).toBe(false);
		expect(state.attendeeIds).toEqual([]);
		expect(checkInDemoPlayers(state, ['demo-0', 'demo-1'])).toBe(true);
		expect(state.attendeeIds).toEqual(['demo-0', 'demo-1']);
		expect(state.participants.slice(0, 2).every((player) => player.status === 'READY')).toBe(true);
		expect(
			state.participants.slice(0, 2).every((player) => player.readySince instanceof Date)
		).toBe(true);
		expect(checkInDemoPlayers(state, ['demo-1', 'demo-2'])).toBe(false);
		expect(state.participants[2].status).toBe('OUT');
	});
	it('restores saved state and READY timestamps without contacting a club', () => {
		const state = sampleMatchDemoState();
		const restored = readDemoState({
			getItem: (key) => (key === DEMO_STORAGE_KEY ? JSON.stringify(state) : null)
		});
		expect(restored.activeMatches[0].sets[1].status).toBe('IN_PROGRESS');
		expect(
			restored.participants.find((player) => player.id === 'demo-4')?.readySince
		).toBeInstanceOf(Date);
	});

	it('keeps a 1–1 match open for a deciding set and releases its players afterward', () => {
		const state = sampleMatchDemoState();
		expect(completeDemoSet(state, 'demo-match-1', 18, 21)).toBe(true);
		expect(state.activeMatches).toHaveLength(1);
		expect(startDemoDecider(state, 'demo-match-1')).toBe(true);
		expect(completeDemoSet(state, 'demo-match-1', 21, 19)).toBe(true);
		expect(state.activeMatches).toHaveLength(0);
		expect(state.completedMatches).toBe(1);
		expect(state.participants.filter((player) => player.status === 'READY')).toHaveLength(8);
	});

	it('uses one shared READY pool across courts and preserves set substitutions', () => {
		const state = sampleMatchDemoState();
		state.session!.court_count = 2;
		expect(startDemoMatch(state, ['demo-4', 'demo-5'], ['demo-6', 'demo-7'], 2)).toBe(true);
		expect(startDemoMatch(state, ['demo-4', 'demo-5'], ['demo-6', 'demo-7'], 3)).toBe(false);
		expect(completeDemoSet(state, 'demo-match-1', 21, 19)).toBe(true);
		expect(setDemoStatus(state, 'demo-8', 'READY')).toBe(true);
		expect(substituteDemoPlayer(state, 'demo-match-2', 'demo-4', 'demo-8', 'RESTING')).toBe(false);
		expect(completeDemoSet(state, 'demo-match-2', 21, 18)).toBe(true);
		expect(substituteDemoPlayer(state, 'demo-match-2', 'demo-4', 'demo-8', 'RESTING')).toBe(true);
		expect(state.activeMatches[0].sets[0].players[0].id).toBe('demo-4');
		expect(state.activeMatches[0].sets[1].players[0].id).toBe('demo-8');
	});

	it('allows correction and a tied match to be ended', () => {
		const state = sampleMatchDemoState();
		expect(correctDemoSet(state, 'demo-match-1', 1, 18, 21)).toBe(true);
		expect(completeDemoSet(state, 'demo-match-1', 21, 18)).toBe(true);
		expect(finishDemoTie(state, 'demo-match-1')).toBe(true);
		expect(state.completedMatches).toBe(1);
	});
});
