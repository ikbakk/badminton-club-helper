import { expect, test } from '@playwright/test';

test('history failure has retry and never claims the club has no sessions', async ({ page }) => {
	let failed = true;
	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({ json: [{ id: 'club-e2e', name: 'Test Club' }] });
		if (path.endsWith('/public_session_history'))
			return route.fulfill(
				failed
					? { status: 503, json: { message: 'Unavailable' } }
					: {
							json: [
								{
									id: 'session-1',
									started_at: '2026-10-10T10:00:00Z',
									closed_at: '2026-10-10T13:00:00Z',
									attendance: 10,
									fee_per_person: 15000
								}
							]
						}
			);
		return route.fulfill({ json: [] });
	});
	await page.goto('/clubs/club-e2e/history');
	await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('Belum ada sesi selesai.')).toHaveCount(0);
	failed = false;
	await page.getByRole('button', { name: 'Coba lagi' }).click();
	await expect(page.getByText('10 pemain', { exact: false })).toBeVisible();
});

test('fund failure is recoverable and does not display a fabricated zero balance', async ({
	page
}) => {
	let failed = true;
	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({ json: [{ id: 'club-e2e', name: 'Test Club' }] });
		if (path.endsWith('/public_fund_summary'))
			return route.fulfill({ json: { received: 50000, expenses: 10000, balance: 40000 } });
		if (path.endsWith('/rpc/public_fund_activity'))
			return route.fulfill(
				failed
					? { status: 503, json: { message: 'Unavailable' } }
					: {
							json: [
								{
									id: 'income-1',
									kind: 'INCOME',
									label: 'Iuran sesi',
									amount: 50000,
									occurred_at: '2026-10-10T10:00:00Z'
								}
							]
						}
			);
		return route.fulfill({ json: [] });
	});
	await page.goto('/clubs/club-e2e/fund');
	await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('Rp0', { exact: true })).toHaveCount(0);
	failed = false;
	await page.getByRole('button', { name: 'Coba lagi' }).click();
	await expect(page.getByText('Rp40.000', { exact: true })).toBeVisible();
	await expect(page.getByRole('listitem').getByText('Iuran sesi', { exact: true })).toBeVisible();
});

test('player profile failure offers retry without claiming the player is missing', async ({
	page
}) => {
	let failed = true;
	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({ json: [{ id: 'club-e2e', name: 'Test Club' }] });
		if (path.endsWith('/public_member_roster'))
			return route.fulfill({
				json: [{ id: 'player-1', display_name: 'Rafi', membership_type: 'MEMBER' }]
			});
		if (path.endsWith('/rpc/public_player_profile'))
			return route.fulfill(
				failed
					? { status: 503, json: { message: 'Unavailable' } }
					: {
							json: [
								{
									id: 'player-1',
									display_name: 'Rafi',
									membership_type: 'MEMBER',
									sessions: 3,
									sets: 12,
									wins: 7,
									losses: 5
								}
							]
						}
			);
		return route.fulfill({ json: [] });
	});
	await page.goto('/clubs/club-e2e/players/player-1');
	await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
	failed = false;
	await page.getByRole('button', { name: 'Coba lagi' }).click();
	await expect(page.getByRole('heading', { name: 'Rafi', exact: true })).toBeVisible();
	await expect(page.getByText('3 hadir', { exact: true })).toBeVisible();
});
