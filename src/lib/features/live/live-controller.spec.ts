import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';

const api = vi.hoisted(() => ({
	liveSessionQueryKey: ['live', 'active-session'],
	emptyLiveSessionSnapshot: { session: null, participants: [], activeMatch: null },
	checkInPlayer: vi.fn(),
	checkInPlayers: vi.fn(),
	addGuestAndCheckIn: vi.fn(),
	changeParticipantStatus: vi.fn(),
	startMatch: vi.fn(),
	saveRotationRecommendation: vi.fn(),
	completeSet: vi.fn(),
	correctCompletedSet: vi.fn(),
	substitutePlayer: vi.fn(),
	abandonMatch: vi.fn(),
	closeSession: vi.fn(),
	suggestSessionFee: vi.fn(),
	setLeaveAfterMatch: vi.fn()
}));

vi.mock('$lib/data/live', () => api);

import { LiveController } from './live-controller.svelte';

const session = { id: 'session-1', club_id: 'club-1', started_at: '2026-09-28T10:00:00Z' };

describe('LiveController', () => {
	const notice = vi.fn();
	let controller: LiveController;
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.resetAllMocks();
		queryClient = new QueryClient();
		vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
		controller = new LiveController(notice, queryClient, async (action, invalidateLive) => {
			const result = await action();
			if (invalidateLive) {
				await queryClient.invalidateQueries(
					{ queryKey: ['live', 'active-session'] },
					{ cancelRefetch: false }
				);
			}
			return result;
		});
		controller.session = session;
		controller.setAdminAuthorized(true);
	});

	it('invalidates the authoritative Live query after a successful command', async () => {
		api.checkInPlayer.mockResolvedValue(undefined);

		await controller.checkIn('member-1');

		expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
			{ queryKey: ['live', 'active-session'] },
			{ cancelRefetch: false }
		);
	});

	it('surfaces the backend authorization error without dropping the signed-in admin', async () => {
		api.checkInPlayer.mockRejectedValue(new Error('Club Admin authority is required'));

		await controller.checkIn('member-1');

		expect(controller.canManage).toBe(true);
		expect(notice).toHaveBeenCalledWith('Club Admin authority is required');
	});

	it('checks a guest in through the dedicated transactional RPC', async () => {
		api.addGuestAndCheckIn.mockResolvedValue('guest-1');

		await controller.addGuest('Rafi');

		expect(api.addGuestAndCheckIn).toHaveBeenCalledWith('session-1', 'Rafi');
		expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
	});

	it('checks multiple players in with one batched command', async () => {
		api.checkInPlayers.mockResolvedValue(undefined);

		await controller.checkInMany(['member-1', 'member-2', 'member-3']);

		expect(api.checkInPlayers).toHaveBeenCalledOnce();
		expect(api.checkInPlayers).toHaveBeenCalledWith('session-1', [
			'member-1',
			'member-2',
			'member-3'
		]);
		expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
	});

	it('keeps the Set 1 → Set 2 substitution contract atomic', async () => {
		api.substitutePlayer.mockResolvedValue(undefined);

		await controller.substitute('iqbal', 'rafi', 'RESTING');

		expect(api.substitutePlayer).toHaveBeenCalledWith('session-1', 'iqbal', 'rafi', 'RESTING');
		expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
	});

	it('does not send mutations while offline', async () => {
		controller.setOnline(false);

		await controller.checkIn('member-1');

		expect(api.checkInPlayer).not.toHaveBeenCalled();
		expect(notice).toHaveBeenCalledWith(
			'Koneksi terputus. Menampilkan kondisi sesi terakhir yang tersimpan.'
		);
	});

	it('does not allow live writes without an authenticated Club Admin', async () => {
		controller.setAdminAuthorized(false);

		const result = await controller.checkIn('member-1');

		expect(result).toBe(false);
		expect(api.checkInPlayer).not.toHaveBeenCalled();
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

	it('persists a current-state recommendation only for an idle session with four READY players', async () => {
		const players = Array.from({ length: 5 }, (_, index) => ({
			id: `p${index + 1}`,
			name: `Pemain ${index + 1}`,
			membership: 'MEMBER' as const,
			rating: 1200,
			uncertainty: 0.7,
			status: 'READY' as const,
			readySince: new Date(0),
			consecutiveMatches: 0,
			opportunities: 3,
			missedOpportunities: 2,
			currentOpportunityDebt: index === 0 ? 4 : 0,
			rotationsPlayed: 1,
			setsPlayed: 2
		}));
		controller.participants = players;
		api.saveRotationRecommendation.mockResolvedValue('recommendation-1');

		const prepared = await controller.prepareNextMatch();

		expect(prepared?.id).toBe('recommendation-1');
		expect(prepared?.recommendation.selectedPlayerIds).toContain('p1');
		expect(api.saveRotationRecommendation).toHaveBeenCalledOnce();
	});

	it('does not prepare an actionable recommendation for fewer than four READY players or an active match', async () => {
		controller.participants = Array.from({ length: 3 }, (_, index) => ({
			id: `p${index}`,
			name: `P${index}`,
			membership: 'MEMBER' as const,
			rating: 1200,
			uncertainty: 0.7,
			status: 'READY' as const,
			consecutiveMatches: 0,
			opportunities: 0,
			missedOpportunities: 0,
			currentOpportunityDebt: 0,
			rotationsPlayed: 0,
			setsPlayed: 0
		}));
		expect(await controller.prepareNextMatch()).toBeNull();
		controller.participants = Array.from({ length: 4 }, (_, index) => ({
			id: `p${index}`,
			name: `P${index}`,
			membership: 'MEMBER' as const,
			rating: 1200,
			uncertainty: 0.7,
			status: 'READY' as const,
			consecutiveMatches: 0,
			opportunities: 0,
			missedOpportunities: 0,
			currentOpportunityDebt: 0,
			rotationsPlayed: 0,
			setsPlayed: 0
		}));
		controller.activeMatch = {
			id: 'match-1',
			session_id: 'session-1',
			sequence_number: 1,
			sets: []
		};
		expect(await controller.prepareNextMatch()).toBeNull();
		expect(api.saveRotationRecommendation).not.toHaveBeenCalled();
	});

	it('sends the actual selected four and recommendation ID to the start command', async () => {
		api.startMatch.mockResolvedValue('match-1');

		await controller.startMatch(['p1', 'p2'], ['p3', 'p5'], 'recommendation-1');

		expect(api.startMatch).toHaveBeenCalledWith(
			'session-1',
			['p1', 'p2'],
			['p3', 'p5'],
			'recommendation-1',
			undefined
		);
	});

	it('keeps score completion unsuccessful when the server rejects it', async () => {
		api.completeSet.mockRejectedValue({ message: 'Score save failed', details: 'Try again.' });
		controller.activeMatch = {
			id: 'match-1',
			session_id: 'session-1',
			sequence_number: 1,
			sets: [
				{
					id: 'set-1',
					setNumber: 1,
					status: 'IN_PROGRESS',
					teamAScore: null,
					teamBScore: null,
					players: []
				}
			]
		};

		const result = await controller.completeSet(21, 17);

		expect(result).toBe(false);
		expect(notice).toHaveBeenCalledWith('Score save failed — Try again.');
	});

	it('surfaces the backend reason when session close fails', async () => {
		api.closeSession.mockRejectedValue({ message: 'Complete or abandon the active match first' });

		const result = await controller.close();

		expect(result).toBe(false);
		expect(notice).toHaveBeenCalledWith('Complete or abandon the active match first');
	});

	it('keeps two club snapshots and invalidations isolated in one QueryClient', async () => {
		const keyA = ['live', 'active-session', 'club-a'];
		const keyB = ['live', 'active-session', 'club-b'];
		const a = new LiveController(notice, queryClient, (action) => action(), keyA);
		const b = new LiveController(notice, queryClient, (action) => action(), keyB);
		a.session = { ...session, club_id: 'club-a' };
		b.session = { ...session, id: 'session-b', club_id: 'club-b' };
		expect(a.session?.club_id).toBe('club-a');
		expect(b.session?.id).toBe('session-b');
		await b.refresh();
		expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
			{ queryKey: keyB },
			{ cancelRefetch: false }
		);
	});

	it('returns success when the server closes the session', async () => {
		api.closeSession.mockResolvedValue({ attendance: 4, sets: 2, startedAt: session.started_at });

		const result = await controller.close();

		expect(result).toBe(true);
		expect(api.closeSession).toHaveBeenCalledWith(session.id);
	});
});
