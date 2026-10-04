import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
	loadLiveSession: vi.fn(),
	claimOperatorLease: vi.fn(),
	claimAdminOperatorLease: vi.fn(),
	checkInPlayer: vi.fn(),
	addGuestAndCheckIn: vi.fn(),
	changeParticipantStatus: vi.fn(),
	startMatch: vi.fn(),
	completeSet: vi.fn(),
	substitutePlayer: vi.fn(),
	abandonMatch: vi.fn()
}));

vi.mock('$lib/data/live', () => api);

import { LiveController } from './live-controller.svelte';

const session = { id: 'session-1', club_id: 'club-1', started_at: '2026-09-28T10:00:00Z' };
const liveState = { session, participants: [], activeMatch: null };

describe('LiveController', () => {
	const notice = vi.fn();
	let controller: LiveController;

	beforeEach(() => {
		vi.resetAllMocks();
		api.loadLiveSession.mockResolvedValue(liveState);
		controller = new LiveController(notice);
		controller.session = session;
		controller.operatorLease = 'lease-a';
	});

	it('turns a revoked-lease rejection into viewer state and an explicit takeover message', async () => {
		api.checkInPlayer.mockRejectedValue(new Error('Valid operator lease required'));

		await controller.checkIn('member-1');

		expect(controller.isOperator).toBe(false);
		expect(api.loadLiveSession).toHaveBeenCalledOnce();
		expect(notice).toHaveBeenCalledWith('Session control moved to another device.');
	});

	it('checks a guest in through the dedicated transactional RPC', async () => {
		api.addGuestAndCheckIn.mockResolvedValue('guest-1');

		await controller.addGuest('Rafi');

		expect(api.addGuestAndCheckIn).toHaveBeenCalledWith('session-1', 'lease-a', 'Rafi');
		expect(api.loadLiveSession).toHaveBeenCalledOnce();
	});

	it('keeps the Set 1 → Set 2 substitution contract atomic', async () => {
		api.substitutePlayer.mockResolvedValue(undefined);

		await controller.substitute('iqbal', 'rafi', 'RESTING');

		expect(api.substitutePlayer).toHaveBeenCalledWith(
			'session-1',
			'lease-a',
			'iqbal',
			'rafi',
			'RESTING'
		);
		expect(api.loadLiveSession).toHaveBeenCalledOnce();
	});

	it('does not send mutations while offline', async () => {
		controller.setOnline(false);

		await controller.checkIn('member-1');

		expect(api.checkInPlayer).not.toHaveBeenCalled();
		expect(notice).toHaveBeenCalledWith('Offline — showing the last synchronized session state.');
	});

	it('surfaces Supabase object errors when an admin cannot claim control', async () => {
		api.claimAdminOperatorLease.mockRejectedValue({ message: 'Database function is missing' });

		const result = await controller.claimAsAdmin();

		expect(result).toEqual({ ok: false, requiresTakeover: false });
		expect(notice).toHaveBeenCalledWith('Database function is missing');
	});

	it('surfaces Supabase RPC details when starting a match fails', async () => {
		api.startMatch.mockRejectedValue({
			message: 'Could not find the function public.start_match',
			details: 'No matching function was found in the schema cache.',
			hint: 'Reload the schema cache.'
		});

		const result = await controller.startMatch(['p1', 'p2'], ['p3', 'p4']);

		expect(result).toBe(false);
		expect(notice).toHaveBeenCalledWith(
			'Could not find the function public.start_match — No matching function was found in the schema cache. — Reload the schema cache.'
		);
	});
});
