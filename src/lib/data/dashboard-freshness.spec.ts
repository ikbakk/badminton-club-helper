import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ rows: [{ id: 'a', name: 'Before' }] }));
vi.mock('$lib/club-context', () => ({ selectedClubId: () => 'club-a' }));
vi.mock('$lib/supabase', () => ({
	supabase: {
		from: () => ({
			select: () => ({
				eq: () => ({
					limit: async () => ({
						data: api.rows.map((row) => ({ ...row, id: 'club-a' })),
						error: null
					})
				})
			})
		})
	}
}));
import { getPublicClub, invalidatePublicData } from './dashboard';
beforeEach(() => {
	vi.useFakeTimers();
	api.rows = [{ id: 'a', name: 'Before' }];
	invalidatePublicData();
});
afterEach(() => vi.useRealTimers());
it('refreshes cached club data after the freshness window', async () => {
	expect((await getPublicClub())?.name).toBe('Before');
	api.rows[0].name = 'After';
	expect((await getPublicClub())?.name).toBe('Before');
	vi.advanceTimersByTime(16_000);
	expect((await getPublicClub())?.name).toBe('After');
});
it('invalidates successful reads immediately after a club mutation', async () => {
	await getPublicClub();
	api.rows[0].name = 'Renamed';
	invalidatePublicData();
	expect((await getPublicClub())?.name).toBe('Renamed');
});
