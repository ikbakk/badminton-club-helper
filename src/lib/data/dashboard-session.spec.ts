import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('$lib/club-context', () => ({ selectedClubId: () => 'club-1' }));
vi.mock('$lib/supabase', () => ({ supabase: { rpc: api.rpc } }));

import { startSession } from './dashboard';

describe('startSession', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		api.rpc.mockResolvedValue({ data: 'session-1', error: null });
	});

	it('starts one court by default and passes an explicit court count to the server', async () => {
		await startSession('club-1');
		expect(api.rpc).toHaveBeenLastCalledWith('start_session', {
			p_club_id: 'club-1',
			p_court_count: 1
		});

		await startSession('club-1', 3);
		expect(api.rpc).toHaveBeenLastCalledWith('start_session', {
			p_club_id: 'club-1',
			p_court_count: 3
		});
	});

	it('rejects a non-positive or fractional court count before making a request', async () => {
		await expect(startSession('club-1', 0)).rejects.toThrow(
			'Jumlah court harus berupa bilangan bulat positif.'
		);
		await expect(startSession('club-1', 1.5)).rejects.toThrow(
			'Jumlah court harus berupa bilangan bulat positif.'
		);
		expect(api.rpc).not.toHaveBeenCalled();
	});
});
