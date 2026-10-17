import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
	const route = { clubId: 'club-a' };
	const profile = vi.fn();
	const chain = { select: vi.fn(), eq: vi.fn(), limit: vi.fn() };
	const from = vi.fn();
	return { route, profile, chain, from };
});
vi.mock('$lib/club-context', () => ({ selectedClubId: () => mocks.route.clubId }));
vi.mock('$lib/data/dashboard', () => ({ getPublicClub: mocks.profile }));
vi.mock('$lib/supabase', () => ({ supabase: { from: mocks.from } }));
import { loadClubLiveSession } from './live';
describe('club query identity across navigation', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.route.clubId = 'club-a';
		mocks.from.mockReturnValue(mocks.chain);
		mocks.chain.select.mockReturnValue(mocks.chain);
		mocks.chain.eq.mockReturnValue(mocks.chain);
		mocks.chain.limit.mockResolvedValue({ data: [], error: null });
	});
	it('keeps the original club when navigation changes during the profile fetch', async () => {
		let finish: (club: { id: string }) => void = () => {};
		mocks.profile.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		const request = loadClubLiveSession('club-a');
		mocks.route.clubId = 'club-b';
		finish({ id: 'club-a' });
		await request;
		expect(mocks.profile).toHaveBeenCalledWith('club-a');
		expect(mocks.chain.eq).toHaveBeenCalledWith('club_id', 'club-a');
		expect(mocks.chain.eq).not.toHaveBeenCalledWith('club_id', 'club-b');
	});
	it('does not fetch a default live session when the requested club is unavailable', async () => {
		mocks.profile.mockResolvedValue(null);
		await expect(loadClubLiveSession('missing')).rejects.toThrow('Klub tidak ditemukan');
		expect(mocks.from).not.toHaveBeenCalled();
	});
});
