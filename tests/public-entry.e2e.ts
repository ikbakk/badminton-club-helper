import { expect, test, type Page } from '@playwright/test';

const clubA = '11111111-1111-4111-8111-111111111111';
const clubB = '22222222-2222-4222-8222-222222222222';
const user = {
	id: 'admin-e2e',
	email: 'organizer@example.com',
	aud: 'authenticated',
	role: 'authenticated',
	app_metadata: { provider: 'email', providers: ['email'] },
	user_metadata: {},
	created_at: '2026-10-14T00:00:00Z'
};
async function backend(
	page: Page,
	signedIn = false,
	ownedClubs: { id: string; name: string; is_club_admin: boolean }[] = []
) {
	let created = false;
	const reads: string[] = [];
	if (signedIn)
		await page.addInitScript(
			({ user }) => {
				const payload = btoa(
					JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })
				)
					.replace(/=/g, '')
					.replace(/\+/g, '-')
					.replace(/\//g, '_');
				localStorage.setItem(
					'sb-courtside-e2e-auth-token',
					JSON.stringify({
						access_token: `e30.${payload}.sig`,
						refresh_token: 'test-refresh',
						token_type: 'bearer',
						expires_at: Math.floor(Date.now() / 1000) + 3600,
						user
					})
				);
			},
			{ user }
		);
	await page.route('**/auth/v1/**', (route) =>
		route.fulfill({ json: route.request().url().includes('/signup') ? { user } : user })
	);
	await page.route('**/rest/v1/**', (route) => {
		const url = new URL(route.request().url());
		reads.push(url.pathname + url.search);
		if (url.pathname.endsWith('/rpc/my_club'))
			return route.fulfill({
				json: created ? [{ id: clubB, name: 'Klub Beta', is_club_admin: true }] : ownedClubs
			});
		if (url.pathname.endsWith('/rpc/create_club')) {
			created = true;
			return route.fulfill({ json: clubB });
		}
		if (url.pathname.endsWith('/public_club_profile')) {
			const id = url.searchParams.get('id')?.replace('eq.', '');
			return route.fulfill({
				json:
					id === clubA
						? [{ id, name: 'Klub Alfa' }]
						: id === clubB
							? [{ id, name: 'Klub Beta' }]
							: []
			});
		}
		if (url.pathname.endsWith('/live_session'))
			return route.fulfill({
				json: [
					{
						id: 'session-b',
						club_id: url.searchParams.get('club_id')?.replace('eq.', ''),
						started_at: '2026-10-14T00:00:00Z'
					}
				]
			});
		if (url.pathname.endsWith('/public_fund_summary'))
			return route.fulfill({ json: { received: 0, expenses: 0, balance: 0 } });
		return route.fulfill({ json: [] });
	});
	return reads;
}

test('landing is neutral and makes no club or account requests', async ({ page }) => {
	const reads = await backend(page);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Main bareng/ })).toBeVisible();
	await expect(page.getByText('PB NEWBIE')).toHaveCount(0);
	await expect(page).toHaveURL(/\/$/);
	await page.screenshot({ path: 'output/playwright/landing-desktop.png', fullPage: true });
	expect(reads).toEqual([]);
	await page.getByRole('link', { name: 'Buat klub', exact: true }).first().click();
	await expect(page.getByRole('heading', { name: 'Buat akun admin.' })).toBeVisible();
});

test('signup confirmation is explicit and does not create a club before confirmation', async ({
	page
}) => {
	const reads = await backend(page);
	await page.goto('/start?mode=signup');
	await page.getByLabel('Email', { exact: true }).fill(user.email);
	await page.getByLabel('Kata sandi', { exact: true }).fill('test-password');
	await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Periksa email');
	expect(reads.some((url) => url.includes('/create_club'))).toBe(false);
});

test('new organizer creates their own club and enters its explicit Live URL', async ({ page }) => {
	const reads = await backend(page, true);
	await page.goto('/start');
	await expect(page.getByRole('heading', { name: 'Buat klubmu.' })).toBeVisible();
	await page.getByLabel('Nama klub').fill('Klub Beta');
	await page.getByRole('button', { name: 'Buat klub', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/clubs/${clubB}/live$`));
	await expect(page.getByText('Klub Beta').first()).toBeVisible();
	expect(reads.some((url) => url.includes('club_id=eq.' + clubB))).toBe(true);
	expect(reads.some((url) => url.includes(clubA))).toBe(false);
});

test('shared club link carries identity through navigation and unknown links never fall back', async ({
	page
}) => {
	const reads = await backend(page);
	await page.goto(`/clubs/${clubA}/live`);
	await expect(page.getByText('Klub Alfa').first()).toBeVisible();
	await page.getByRole('link', { name: 'Pemain', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/clubs/${clubA}/players$`));
	await page.goto(`/clubs/${clubB}/live`);
	await expect(page.getByText('Klub Beta').first()).toBeVisible();
	await expect(page.getByText('Klub Alfa')).toHaveCount(0);
	await page.goto('/clubs/33333333-3333-4333-8333-333333333333/live');
	await expect(page.getByRole('heading', { name: 'Klub tidak ditemukan.' })).toBeVisible();
	expect(
		reads.filter((url) => url.includes('/live_session')).every((url) => url.includes('club_id=eq.'))
	).toBe(true);
});

test('legacy unscoped Live leads to account entry without reading a public club', async ({
	page
}) => {
	const reads = await backend(page);
	await page.goto('/live');
	await expect(page).toHaveURL(/\/start$/);
	await expect(page.getByRole('heading', { name: 'Selamat datang lagi.' })).toBeVisible();
	expect(reads).toEqual([]);
});

for (const width of [390, 360]) {
	test(`public landing and signup fit mobile width ${width}`, async ({ page }) => {
		await backend(page);
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/');
		await expect(
			page.getByRole('link', { name: 'Buat klub', exact: true }).first()
		).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.screenshot({ path: `output/playwright/landing-${width}.png`, fullPage: true });
		await page.getByRole('link', { name: 'Buat klub', exact: true }).first().click();
		await expect(page.getByRole('heading', { name: 'Buat akun admin.' })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.screenshot({ path: `output/playwright/signup-${width}.png`, fullPage: true });
	});
}

test('signed-in organizer viewing another club remains read-only', async ({ page }) => {
	const reads = await backend(page, true, [{ id: clubA, name: 'Klub Alfa', is_club_admin: true }]);
	await page.goto(`/clubs/${clubB}/live`);
	await expect(page.getByText('Klub Beta').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Check in pemain', exact: true })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Pengaturan', exact: true })).toHaveCount(0);
	expect(reads.some((url) => url.includes('get_rotation_fairness_state'))).toBe(false);
});

test('signing out returns to neutral account entry', async ({ page }) => {
	await backend(page, true, [{ id: clubB, name: 'Klub Beta', is_club_admin: true }]);
	await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));
	await page.goto(`/clubs/${clubB}/live`);
	await page.getByLabel('Akun dan klub saya', { exact: true }).click();
	await page.getByRole('button', { name: 'Keluar', exact: true }).click();
	await expect(page).toHaveURL(/\/start$/);
	await expect(page.getByRole('heading', { name: 'Selamat datang lagi.' })).toBeVisible();
});

test('failed sign-out keeps the account visible and reports the failure', async ({ page }) => {
	await backend(page, true, [{ id: clubB, name: 'Klub Beta', is_club_admin: true }]);
	await page.route('**/auth/v1/logout**', (route) =>
		route.fulfill({ status: 500, json: { message: 'Logout unavailable' } })
	);
	await page.goto(`/clubs/${clubB}/live`);
	await page.getByLabel('Akun dan klub saya', { exact: true }).click();
	await page.getByRole('button', { name: 'Keluar', exact: true }).click();
	await expect(page.getByText('Logout unavailable', { exact: true })).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/clubs/${clubB}/live$`));
});

test('password recovery sends the explicit redirect and preserves email on failure', async ({
	page
}) => {
	await backend(page);
	let body: { email?: string } = {};
	await page.route('**/auth/v1/recover**', (route) => {
		body = route.request().postDataJSON();
		expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe(
			new URL('/reset-password', page.url()).href
		);
		return route.fulfill({ status: 429, json: { message: 'Please try again later' } });
	});
	await page.goto('/start');
	await page.getByRole('button', { name: 'Lupa kata sandi?' }).click();
	await page.getByLabel('Email', { exact: true }).fill(user.email);
	await page.getByRole('button', { name: 'Kirim tautan pemulihan' }).click();
	await expect(page.getByRole('alert')).toContainText('Please try again later');
	await expect(page.getByLabel('Email', { exact: true })).toHaveValue(user.email);
	expect(body.email).toBe(user.email);
	await page.route('**/auth/v1/recover**', (route) => route.fulfill({ json: {} }));
	await page.getByRole('button', { name: 'Kirim tautan pemulihan' }).click();
	await expect(page.getByRole('status')).toContainText('Jika email terdaftar');
});

test('expired recovery link does not allow a password write', async ({ page }) => {
	await backend(page);
	await page.goto('/reset-password#error=access_denied&error_description=expired');
	await expect(page.getByRole('alert')).toContainText('kedaluwarsa');
	await expect(page.getByRole('button', { name: 'Simpan kata sandi' })).toHaveCount(0);
});

test('validated recovery link saves only matching passwords and returns to sign-in', async ({
	page
}) => {
	await backend(page);
	let writes = 0;
	await page.route('**/auth/v1/user', (route) => {
		if (route.request().method() === 'PUT') {
			writes++;
			return route.fulfill({ json: user });
		}
		return route.fulfill({ json: user });
	});
	await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));
	const payload = Buffer.from(
		JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })
	).toString('base64url');
	await page.goto(
		`/reset-password#access_token=e30.${payload}.sig&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery`
	);
	await expect(page.getByLabel('Kata sandi baru', { exact: true })).toBeVisible();
	await page.getByLabel('Kata sandi baru', { exact: true }).fill('new-password');
	await page.getByLabel('Ulangi kata sandi').fill('wrong-password');
	await page.getByRole('button', { name: 'Simpan kata sandi' }).click();
	await expect(page.getByRole('alert')).toContainText('harus sama');
	expect(writes).toBe(0);
	await page.getByLabel('Ulangi kata sandi').fill('new-password');
	await page.getByRole('button', { name: 'Simpan kata sandi' }).click();
	await expect(page).toHaveURL(/\/start\?password=updated$/);
	await expect(page.getByRole('status')).toContainText('Kata sandi diperbarui');
	expect(writes).toBe(1);
});

test('failed password save retains input for retry', async ({ page }) => {
	await backend(page, true);
	await page.route('**/auth/v1/user', (route) =>
		route.fulfill(
			route.request().method() === 'PUT'
				? { status: 422, json: { message: 'Password rejected' } }
				: { json: user }
		)
	);
	await page.goto('/reset-password');
	await page.getByLabel('Kata sandi baru', { exact: true }).fill('new-password');
	await page.getByLabel('Ulangi kata sandi').fill('new-password');
	await page.getByRole('button', { name: 'Simpan kata sandi' }).click();
	await expect(page.getByRole('alert')).toContainText('Password rejected');
	await expect(page.getByLabel('Kata sandi baru', { exact: true })).toHaveValue('new-password');
});

test('saved password with failed sign-out retries without another password write', async ({
	page
}) => {
	await backend(page, true);
	let writes = 0;
	await page.route('**/auth/v1/user', (route) => {
		if (route.request().method() === 'PUT') writes++;
		return route.fulfill({ json: user });
	});
	await page.route('**/auth/v1/logout**', (route) =>
		route.fulfill({ status: 500, json: { message: 'Unavailable' } })
	);
	await page.setViewportSize({ width: 360, height: 844 });
	await page.goto('/reset-password');
	await page.getByLabel('Kata sandi baru', { exact: true }).fill('new-password');
	await page.getByLabel('Ulangi kata sandi').fill('new-password');
	await page.getByRole('button', { name: 'Simpan kata sandi' }).click();
	await expect(page.getByRole('alert')).toContainText('Kata sandi tersimpan');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));
	await page.getByRole('button', { name: 'Lanjutkan ke masuk' }).click();
	await expect(page).toHaveURL(/\/start\?password=updated$/);
	expect(writes).toBe(1);
});

test('landing demo opens a read-only fictional session without backend calls', async ({ page }) => {
	const reads = await backend(page);
	await page.goto('/');
	await page.getByRole('link', { name: 'Coba demo', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Coba Courtside', exact: true })).toBeVisible();
	await expect(page.getByText('Set 1 · 21–18', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Skor Tim A')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Ganti pemain', exact: true })).toHaveCount(0);
	expect(reads).toEqual([]);
});
