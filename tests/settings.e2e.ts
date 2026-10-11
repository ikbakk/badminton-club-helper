import { expect, test, type Page } from '@playwright/test';

const settings = {
	club_id: 'club-settings-e2e',
	name: 'PB NEWBIE',
	bank_name: 'BCA',
	bank_account_name: 'PB NEWBIE',
	bank_account_number: '1234567890',
	shopeepay_name: null,
	shopeepay_number: null,
	qris_image_url: null,
	publish_publicly: false
};
type MockSettings = {
	club_id: string;
	name: string;
	bank_name: string | null;
	bank_account_name: string | null;
	bank_account_number: string | null;
	shopeepay_name: string | null;
	shopeepay_number: string | null;
	qris_image_url: string | null;
	publish_publicly: boolean;
};

async function mockSettingsBackend(page: Page) {
	let currentSettings: MockSettings = { ...settings };
	let savedSettings: Record<string, unknown> | null = null;
	await page.route('**/rest/v1/**', async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/rpc/my_club'))
			return route.fulfill({
				json: [{ id: currentSettings.club_id, name: currentSettings.name, is_club_admin: true }]
			});
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({
				json: [{ id: currentSettings.club_id, name: currentSettings.name }]
			});
		if (path.endsWith('/rpc/club_settings')) return route.fulfill({ json: [currentSettings] });
		if (path.endsWith('/rpc/update_club_settings')) {
			savedSettings = route.request().postDataJSON();
			currentSettings = {
				club_id: currentSettings.club_id,
				name: String(savedSettings?.p_name),
				bank_name: savedSettings?.p_bank_name as string | null,
				bank_account_name: savedSettings?.p_bank_account_name as string | null,
				bank_account_number: savedSettings?.p_bank_account_number as string | null,
				shopeepay_name: savedSettings?.p_shopeepay_name as string | null,
				shopeepay_number: savedSettings?.p_shopeepay_number as string | null,
				qris_image_url: savedSettings?.p_qris_image_url as string | null,
				publish_publicly: Boolean(savedSettings?.p_publish_publicly)
			};
			return route.fulfill({ status: 204 });
		}
		if (path.endsWith('/rpc/public_payment_destinations'))
			return route.fulfill({
				json: currentSettings.publish_publicly
					? [
							{
								bank_name: currentSettings.bank_name,
								bank_account_name: currentSettings.bank_account_name,
								bank_account_number: currentSettings.bank_account_number,
								shopeepay_name: currentSettings.shopeepay_name,
								shopeepay_number: currentSettings.shopeepay_number,
								qris_image_url: currentSettings.qris_image_url
							}
						]
					: []
			});
		if (path.endsWith('/public_fund_summary'))
			return route.fulfill({ json: { received: 0, expenses: 0, balance: 0 } });
		if (path.endsWith('/rpc/public_fund_activity')) return route.fulfill({ json: [] });
		return route.fulfill({ json: [] });
	});
	await page.route('**/auth/v1/user', (route) =>
		route.fulfill({
			json: {
				id: 'admin-settings-e2e',
				aud: 'authenticated',
				role: 'authenticated',
				email: 'admin@example.com',
				app_metadata: {},
				user_metadata: {},
				created_at: '2026-10-01T00:00:00Z'
			}
		})
	);
	await page.addInitScript(() => {
		localStorage.setItem(
			'sb-zjqqjgdrojhqiylapvqd-auth-token',
			JSON.stringify({
				access_token: 'e2e-access-token',
				token_type: 'bearer',
				expires_in: 3600,
				expires_at: Math.floor(Date.now() / 1000) + 3600,
				refresh_token: 'e2e-refresh-token',
				user: {
					id: 'admin-settings-e2e',
					aud: 'authenticated',
					role: 'authenticated',
					email: 'admin@example.com',
					app_metadata: {},
					user_metadata: {},
					created_at: '2026-10-01T00:00:00Z'
				}
			})
		);
	});
	return {
		getSavedSettings: () => savedSettings,
		publishDestinations: () => {
			currentSettings.publish_publicly = true;
		}
	};
}

test('Club Admin can save profile and manual destinations with public visibility opt-in', async ({
	page
}) => {
	const backend = await mockSettingsBackend(page);
	await page.goto('/settings');
	await expect(page.getByLabel('Nama klub')).toHaveValue('PB NEWBIE');
	await expect(page.getByText('admin@example.com')).toBeVisible();

	await page.getByLabel('Nama klub').fill('PB NEWBIE Utama');
	await page.getByLabel('Tampilkan tujuan pembayaran di halaman Kas publik').check();
	await page.getByRole('button', { name: 'Simpan pengaturan' }).click();

	await expect(page.getByRole('status')).toContainText('Pengaturan tersimpan.');
	expect(backend.getSavedSettings()).toMatchObject({
		p_name: 'PB NEWBIE Utama',
		p_bank_account_number: '1234567890',
		p_publish_publicly: true
	});
});

test('Fund displays manual payment details only when the admin has published them', async ({
	page
}) => {
	const backend = await mockSettingsBackend(page);
	await page.goto('/fund');
	await expect(page.getByRole('heading', { name: 'Tujuan pembayaran iuran' })).toHaveCount(0);

	backend.publishDestinations();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Tujuan pembayaran iuran' })).toBeVisible();
	await expect(page.getByText('1234567890', { exact: true })).toBeVisible();
});
