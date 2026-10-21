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

test('history keeps an empty closed session visible and labels it without a zero duration', async ({
	page
}) => {
	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({ json: [{ id: 'club-e2e', name: 'Test Club' }] });
		if (path.endsWith('/public_session_history'))
			return route.fulfill({
				json: [
					{
						id: 'empty-session',
						started_at: '2026-10-10T10:00:00Z',
						closed_at: '2026-10-10T10:00:00Z',
						attendance: 0,
						fee_per_person: null
					},
					{
						id: 'played-session',
						started_at: '2026-10-09T10:00:00Z',
						closed_at: '2026-10-09T13:00:00Z',
						attendance: 8,
						fee_per_person: 15000
					}
				]
			});
		return route.fulfill({ json: [] });
	});
	await page.goto('/clubs/club-e2e/history');
	const emptySession = page
		.getByRole('link')
		.filter({ hasText: 'Sesi kosong · tidak ada pemain hadir' });
	await expect(emptySession).toBeVisible();
	await expect(emptySession).not.toContainText('0j 0m');
	await expect(page.getByRole('link').filter({ hasText: '8 pemain · 3j 0m' })).toBeVisible();
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

test('player session summary shows actual sets, partners and recorded rating change', async ({
	page
}) => {
	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({ json: [{ id: 'club-e2e', name: 'Test Club' }] });
		if (path.endsWith('/public_member_roster'))
			return route.fulfill({
				json: [{ id: 'player-1', display_name: 'Rafi', membership_type: 'MEMBER' }]
			});
		if (path.endsWith('/rpc/public_player_profile'))
			return route.fulfill({
				json: [
					{
						id: 'player-1',
						display_name: 'Rafi',
						membership_type: 'MEMBER',
						sessions: 1,
						sets: 1,
						wins: 1,
						losses: 0
					}
				]
			});
		if (path.endsWith('/rpc/public_player_session_summaries'))
			return route.fulfill({
				json: [
					{
						session_id: 'session-1',
						started_at: '2026-10-17T10:00:00Z',
						closed_at: null,
						sets: 1,
						wins: 1,
						losses: 0,
						partners: ['Budi'],
						rating_change: 10
					}
				]
			});
		return route.fulfill({ json: [] });
	});
	await page.goto('/clubs/club-e2e/players/player-1');
	const summary = page.getByRole('region', { name: 'Ringkasan per sesi' });
	await expect(summary).toBeVisible();
	await expect(summary.getByText('1 set · 1 menang · 0 kalah', { exact: true })).toBeVisible();
	await expect(summary.getByText('Partner: Budi', { exact: true })).toBeVisible();
	await expect(summary.getByText('Rating dari set: +10', { exact: true })).toBeVisible();
});

test('mobile navigation stays reachable after scrolling a long club page', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 740 });
	await page.route('**/rest/v1/**', (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({
				json: [{ id: 'club-e2e', name: 'Klub Badminton Sabtu Malam Bersama Teman Lama' }]
			});
		if (path.endsWith('/public_session_history'))
			return route.fulfill({
				json: Array.from({ length: 20 }, (_, i) => ({
					id: `session-${i}`,
					started_at: '2026-10-10T10:00:00Z',
					closed_at: '2026-10-10T13:00:00Z',
					attendance: 10,
					fee_per_person: 15000
				}))
			});
		return route.fulfill({ json: [] });
	});
	await page.goto('/clubs/club-e2e/history');
	await expect(page.getByText('10 pemain', { exact: false }).first()).toBeVisible();
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
	await expect(nav.getByRole('link', { name: 'Pemain', exact: true })).toBeInViewport();
	await expect(nav.getByRole('link', { name: 'Kas', exact: true })).toBeInViewport();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
	await nav.getByRole('link', { name: 'Pemain', exact: true }).focus();
	await expect(nav.getByRole('link', { name: 'Pemain', exact: true })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/players$/);
	await expect(page.getByRole('link', { name: 'Pengaturan', exact: true })).toHaveCount(0);
});
