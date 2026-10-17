import { expect, test } from '@playwright/test';
import { evaluateSession } from '../src/lib/domain/session-evaluation';
import { pbNewbieSessionFixture } from '../src/lib/domain/session-evaluation.fixture';

const sessionId = 'history-evaluation-e2e';
const evaluation = evaluateSession({ ...pbNewbieSessionFixture, sessionId });

async function setupHistory(page: import('@playwright/test').Page, admin: boolean) {
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
						attendance: 12
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

test('recap has a result-only mode and uses native image sharing when supported', async ({
	page
}) => {
	await setupHistory(page, true);
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'canShare', { value: () => true });
		Object.defineProperty(navigator, 'share', {
			value: async (data: ShareData) => {
				(window as Window & { shared?: { text?: string; type?: string } }).shared = {
					text: data.text,
					type: data.files?.[0]?.type
				};
			}
		});
	});
	await page.addInitScript(() => {
		const original = CanvasRenderingContext2D.prototype.fillText;
		CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
			const state = window as Window & { drawnTexts?: string[] };
			(state.drawnTexts ??= []).push(text);
			if (maxWidth === undefined) original.call(this, text, x, y);
			else original.call(this, text, x, y, maxWidth);
		};
	});

	await page.goto(`/clubs/club-e2e/history/${sessionId}`);
	await page.getByRole('button', { name: 'Bagikan', exact: true }).click();
	const image = page.getByRole('dialog').getByRole('img');
	const financialImage = await image.getAttribute('src');
	await page.evaluate(() => {
		(window as Window & { drawnTexts?: string[] }).drawnTexts = [];
	});
	await page.getByRole('checkbox', { name: 'Sertakan iuran dan pembayaran' }).uncheck();
	await expect(image).not.toHaveAttribute('src', financialImage!);
	const drawn = await page.evaluate(
		() => (window as Window & { drawnTexts?: string[] }).drawnTexts ?? []
	);
	expect(drawn).toContain('MATCH TERCATAT');
	expect(drawn.join(' ')).not.toMatch(/IURAN|TAGIHAN|LUNAS|Rp/);
	await page.getByRole('button', { name: 'Bagikan gambar' }).click();
	await expect
		.poll(() =>
			page.evaluate(() => (window as Window & { shared?: { type?: string } }).shared?.type)
		)
		.toBe('image/png');
	const text = await page.evaluate(
		() => (window as Window & { shared?: { text?: string } }).shared?.text
	);
	expect(text).not.toMatch(/Iuran|Pembayaran|tagihan|Biaya/);
	await expect(page.getByRole('button', { name: 'Unduh gambar' })).toBeVisible();
});
