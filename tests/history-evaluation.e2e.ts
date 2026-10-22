import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { evaluateSession } from '../src/lib/domain/session-evaluation';
import { pbNewbieSessionFixture } from '../src/lib/domain/session-evaluation.fixture';

const sessionId = 'history-evaluation-e2e';
const evaluation = evaluateSession({ ...pbNewbieSessionFixture, sessionId });

async function setupHistory(
	page: import('@playwright/test').Page,
	admin: boolean,
	attendance = 12
) {
	await page.addInitScript(
		({ admin }) => {
			if (!admin) return;
			localStorage.setItem(
				'pb-newbie:club-access',
				JSON.stringify({ id: 'club-e2e', name: 'PB NEWBIE', is_club_admin: true })
			);
			const payload = btoa(
				JSON.stringify({ sub: 'admin-e2e', exp: Math.floor(Date.now() / 1000) + 3600 })
			)
				.replace(/=/g, '')
				.replace(/\+/g, '-')
				.replace(/\//g, '_');
			localStorage.setItem(
				'sb-courtside-e2e-auth-token',
				JSON.stringify({
					access_token: `e30.${payload}.sig`,
					refresh_token: 'e2e-refresh',
					token_type: 'bearer',
					expires_at: Math.floor(Date.now() / 1000) + 3600,
					user: {
						id: 'admin-e2e',
						aud: 'authenticated',
						role: 'authenticated',
						app_metadata: { provider: 'email', providers: ['email'] },
						user_metadata: {},
						created_at: new Date().toISOString()
					}
				})
			);
		},
		{ admin }
	);
	await page.route('**/rest/v1/**', async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({ json: [{ id: 'club-e2e', name: 'PB NEWBIE' }] });
		if (path.endsWith('/public_session_history'))
			return route.fulfill({
				json: [
					{
						id: sessionId,
						started_at: pbNewbieSessionFixture.startedAt,
						closed_at: pbNewbieSessionFixture.closedAt,
						fee_per_person: null,
						attendance
					}
				]
			});
		return route.fulfill({ json: [] });
	});
	await page.route('**/rest/v1/rpc/**', async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith('/my_club'))
			return route.fulfill({
				json: admin ? [{ id: 'club-e2e', name: 'PB NEWBIE', is_club_admin: true }] : []
			});
		return route.fulfill({ json: [] });
	});
	await page.route(`**/api/history/${sessionId}/evaluation`, async (route) => {
		if (!admin || !route.request().headers().authorization?.startsWith('Bearer e30.'))
			return route.fulfill({ status: 403, json: { message: 'Club Admin authority is required.' } });
		return route.fulfill({ json: evaluation, headers: { 'cache-control': 'private, no-store' } });
	});
}

test('public history does not expose admin evaluation diagnostics', async ({ page }) => {
	await setupHistory(page, false);
	await page.goto(`/clubs/club-e2e/history/${sessionId}`);
	await expect(page.getByRole('heading', { name: 'Evaluasi sesi' })).toHaveCount(0);
});

test('Club Admin sees evaluation rendered from the deterministic session fixture', async ({
	page
}) => {
	await setupHistory(page, true);
	await page.goto(`/clubs/club-e2e/history/${sessionId}`);
	await expect(page.getByRole('heading', { name: 'Evaluasi sesi' })).toBeVisible();
	await expect(page.getByText('Set ketat').first()).toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Ekspor JSON' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe(`evaluasi-sesi-${sessionId}.json`);
});

test('recap shares the full roster as PNG and can omit all finance', async ({ page }) => {
	await setupHistory(page, true, 24);
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'canShare', { value: () => true });
		Object.defineProperty(navigator, 'share', {
			value: async (data: ShareData) => {
				(
					window as Window & {
						shared?: { text?: string; type?: string; width?: number; height?: number };
					}
				).shared = {
					text: data.text,
					width: data.files?.[0] ? (await createImageBitmap(data.files[0])).width : 0,
					height: data.files?.[0] ? (await createImageBitmap(data.files[0])).height : 0,
					type: data.files?.[0]?.type
				};
			}
		});
	});
	await page.route('**/rest/v1/rpc/public_session_attendance', (route) =>
		route.fulfill({
			json: Array.from({ length: 24 }, (_, i) => ({
				player_id: `p-${i}`,
				display_name: i === 0 ? 'Andi & Bella <Klub>' : `Pemain ${i + 1}`,
				membership_type: 'MEMBER',
				is_paid: true
			}))
		})
	);
	await page.goto(`/clubs/club-e2e/history/${sessionId}`);
	await page.getByRole('button', { name: 'Bagikan', exact: true }).click();
	const image = page.getByRole('dialog').getByRole('img');
	await expect(image).toBeVisible();
	const financialImage = await image.getAttribute('src');
	const downloadSvg = async () => {
		const pending = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Unduh SVG' }).click();
		const download = await pending;
		return readFile((await download.path())!, 'utf8');
	};
	expect(await downloadSvg()).toContain('Iuran sesi');
	await page.getByRole('checkbox', { name: 'Sertakan iuran dan pembayaran' }).uncheck();
	await expect(image).not.toHaveAttribute('src', financialImage!);
	const vector = await downloadSvg();
	expect(vector).toContain('Main bareng');
	expect(vector).toContain('Pemain 24');
	expect(vector).toContain('Andi &amp; Bella &lt;Klub&gt;');
	expect(vector).not.toMatch(/Iuran sesi|Total tagihan|lunas|Rp|Hasil pertandingan/);

	await page.getByRole('button', { name: 'Bagikan gambar' }).click();
	await expect
		.poll(() =>
			page.evaluate(() => (window as Window & { shared?: { type?: string } }).shared?.type)
		)
		.toBe('image/png');
	expect(
		await page.evaluate(() => (window as Window & { shared?: { width?: number } }).shared?.width)
	).toBe(1080);
	expect(
		await page.evaluate(() => (window as Window & { shared?: { height?: number } }).shared?.height)
	).toBeGreaterThan(1350);
	const text = await page.evaluate(
		() => (window as Window & { shared?: { text?: string } }).shared?.text
	);
	expect(text).not.toMatch(/Iuran|Pembayaran|tagihan|Biaya/);
	await expect(page.getByRole('button', { name: 'Unduh gambar' })).toBeVisible();
});
