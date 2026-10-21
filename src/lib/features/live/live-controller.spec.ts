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
	startDeciderSet: vi.fn(),
	finishTiedMatch: vi.fn(),
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
	let refreshModes: Array<boolean | undefined>;

	beforeEach(() => {
		vi.resetAllMocks();
		queryClient = new QueryClient();
		refreshModes = [];
		vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
		controller = new LiveController(
			notice,
			queryClient,
			async (action, invalidateLive, waitForRefresh) => {
				refreshModes.push(waitForRefresh);
				const result = await action();
				if (invalidateLive && waitForRefresh !== false) {
					await queryClient.invalidateQueries(
						{ queryKey: ['live', 'active-session'] },
						{ cancelRefetch: false }
					);
				}
				return result;
			}
		);
		controller.session = session;
		controller.setAdminAuthorized(true);
	});

	it('ignores a second courtside command while the first write is unresolved', async () => {
		let finish!: () => void;
		api.checkInPlayer.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const first = controller.checkIn('member-1');
		const second = controller.checkIn('member-1');
		expect(api.checkInPlayer).toHaveBeenCalledTimes(1);
		finish();
		await first;
		await expect(second).resolves.toBe(false);
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

		await controller.substitute('match-1', 'iqbal', 'rafi', 'RESTING');

		expect(api.substitutePlayer).toHaveBeenCalledWith(
			'session-1',
			'match-1',
			'iqbal',
			'rafi',
			'RESTING'
		);
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
			undefined,
			1
		);
	});

	it('sends the chosen court with the selected four to the start command', async () => {
		api.startMatch.mockResolvedValue('match-2');

		await controller.startMatch(['p1', 'p2'], ['p3', 'p4'], null, undefined, 2);

		expect(api.startMatch).toHaveBeenCalledWith(
			'session-1',
			['p1', 'p2'],
			['p3', 'p4'],
			null,
			undefined,
			2
		);
	});

	it('keeps recommendations available for a free court while another court is active', () => {
		controller.session = Object.assign({}, session, { court_count: 2 });
		controller.participants = Array.from({ length: 4 }, (_, index) => ({
			id: `ready-${index}`,
			name: `Pemain ${index}`,
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
			id: 'match-court-1',
			session_id: session.id,
			sequence_number: 1,
			sets: []
		};

		expect(controller.nextRecommendation).not.toBeNull();
	});

	it('releases the live-screen refresh wait after the server confirms a score', async () => {
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

		await expect(controller.completeSet('match-1', 21, 17)).resolves.toBe(true);
		expect(refreshModes).toEqual([false]);
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

		const result = await controller.completeSet('match-1', 21, 17);

		expect(result).toBe(false);
		expect(notice).toHaveBeenCalledWith('Score save failed — Try again.');
	});

	it('saves a score against the selected court match, not the first active match', async () => {
		controller.activeMatches = [
			{
				id: 'match-court-1',
				session_id: session.id,
				sequence_number: 1,
				court_number: 1,
				sets: [
					{
						id: 'set-court-1',
						setNumber: 1,
						status: 'IN_PROGRESS',
						teamAScore: null,
						teamBScore: null,
						players: []
					}
				]
			},
			{
				id: 'match-court-2',
				session_id: session.id,
				sequence_number: 2,
				court_number: 2,
				sets: [
					{
						id: 'set-court-2',
						setNumber: 1,
						status: 'IN_PROGRESS',
						teamAScore: null,
						teamBScore: null,
						players: []
					}
				]
			}
		];

		await controller.completeSet('match-court-2', 18, 21);

		expect(api.completeSet).toHaveBeenCalledWith('session-1', 'club-1', 'set-court-2', 18, 21);
	});

	it('keeps writes on separate courts independent while each score is pending', async () => {
		controller.activeMatches = [1, 2].map((courtNumber) => ({
			id: `match-court-${courtNumber}`,
			session_id: session.id,
			sequence_number: courtNumber,
			court_number: courtNumber,
			sets: [
				{
					id: `set-court-${courtNumber}`,
					setNumber: 1,
					status: 'IN_PROGRESS' as const,
					teamAScore: null,
					teamBScore: null,
					players: []
				}
			]
		}));
		const resolveWrites: Array<() => void> = [];
		api.completeSet.mockImplementation(
			() => new Promise<void>((resolve) => resolveWrites.push(resolve))
		);

		const first = controller.completeSet('match-court-1', 21, 18);
		const second = controller.completeSet('match-court-2', 21, 19);

		expect(api.completeSet).toHaveBeenCalledTimes(2);
		expect(controller.pendingForMatch('match-court-1')).toBe('Menyimpan skor…');
		expect(controller.pendingForMatch('match-court-2')).toBe('Menyimpan skor…');
		resolveWrites.forEach((resolve) => resolve());
		await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
		expect(controller.pendingForMatch('match-court-1')).toBe('');
		expect(controller.pendingForMatch('match-court-2')).toBe('');
	});

	it('offers match-scoped commands for starting or skipping a deciding set', () => {
		expect((controller as unknown as { startSetThree?: unknown }).startSetThree).toBeTypeOf(
			'function'
		);
		expect((controller as unknown as { finishTiedMatch?: unknown }).finishTiedMatch).toBeTypeOf(
			'function'
		);
	});

	it('starts or ends the deciding match only after the server command succeeds', async () => {
		api.startDeciderSet.mockResolvedValue(undefined);
		api.finishTiedMatch.mockResolvedValue(undefined);

		await expect(controller.startSetThree('match-court-2')).resolves.toBe(true);
		await expect(controller.finishTiedMatch('match-court-1')).resolves.toBe(true);

		expect(api.startDeciderSet).toHaveBeenCalledWith('session-1', 'match-court-2');
		expect(api.finishTiedMatch).toHaveBeenCalledWith('session-1', 'match-court-1');
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
