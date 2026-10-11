import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('$lib/supabase', () => ({ supabase: { rpc: api.rpc } }));

import {
	getClubSettings,
	getPublicPaymentDestinations,
	updateClubSettings,
	type ClubSettingsInput
} from './club-settings';

const settings: ClubSettingsInput = {
	name: 'PB NEWBIE',
	bank_name: 'BCA',
	bank_account_name: 'PB NEWBIE',
	bank_account_number: '1234567890',
	shopeepay_name: null,
	shopeepay_number: null,
	qris_image_url: null,
	publish_publicly: true
};

describe('club settings data access', () => {
	beforeEach(() => vi.resetAllMocks());

	it('loads the admin settings record through the protected RPC', async () => {
		api.rpc.mockResolvedValue({ data: [{ club_id: 'club-1', ...settings }], error: null });

		await expect(getClubSettings('club-1')).resolves.toEqual({ club_id: 'club-1', ...settings });
		expect(api.rpc).toHaveBeenCalledWith('club_settings', { p_club_id: 'club-1' });
	});

	it('saves the profile and optional destinations in one authoritative command', async () => {
		api.rpc.mockResolvedValue({ data: null, error: null });

		await updateClubSettings('club-1', settings);

		expect(api.rpc).toHaveBeenCalledWith('update_club_settings', {
			p_club_id: 'club-1',
			p_name: 'PB NEWBIE',
			p_bank_name: 'BCA',
			p_bank_account_name: 'PB NEWBIE',
			p_bank_account_number: '1234567890',
			p_shopeepay_name: null,
			p_shopeepay_number: null,
			p_qris_image_url: null,
			p_publish_publicly: true
		});
	});

	it('does not expose destinations when the public-safe RPC returns no row', async () => {
		api.rpc.mockResolvedValue({ data: [], error: null });

		await expect(getPublicPaymentDestinations('club-1')).resolves.toBeNull();
		expect(api.rpc).toHaveBeenCalledWith('public_payment_destinations', { p_club_id: 'club-1' });
	});

	it('surfaces database failures instead of reporting a successful save', async () => {
		const failure = new Error('Club Admin authority is required');
		api.rpc.mockResolvedValue({ data: null, error: failure });

		await expect(updateClubSettings('club-1', settings)).rejects.toBe(failure);
	});
});
