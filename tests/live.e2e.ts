import { expect, test } from '@playwright/test';

const sessionId = 'session-live-e2e';
const session = {
	id: sessionId,
	club_id: 'club-e2e',
	started_at: '2026-10-04T18:00:00.000Z'
};

async function mockLiveBackend(
	page: import('@playwright/test').Page,
	withActiveMatch = false,
	failScore = false,
	failSubstitution = false,
	withRoster = false
) {
	let closed = false;
	let feeConfirmed = false;
	let paidWriteCount = 0;
	const paidPlayers = new Set<string>();
	await page.route('**/rest/v1/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname;
		if (path.endsWith('/live_session'))
			return route.fulfill({ json: [session], headers: { 'content-range': '0-0/1' } });
		if (path.endsWith('/live_participants'))
			return route.fulfill({
				json: failSubstitution
					? [
							{
								participant_id: 'sp-ra',
								player_id: 'p5',
								display_name: 'Rafi',
								membership_type: 'GUEST',
								rating: 1200,
								uncertainty: 0.7,
								status: 'READY',
								ready_since: '2026-10-04T17:30:00.000Z',
								leave_after_match: false
							}
						]
					: []
			});
		if (path.endsWith('/live_active_match'))
			return route.fulfill({
				json: withActiveMatch
					? [
							{
								id: 'match-e2e',
								session_id: sessionId,
								sequence_number: 1,
								sets: failSubstitution
									? [
											{
												setNumber: 1,
												status: 'COMPLETED',
												teamAScore: 21,
												teamBScore: 17,
												players: [
													{ id: 'p1', name: 'A', team: 'A' },
													{ id: 'p2', name: 'B', team: 'A' },
													{ id: 'p3', name: 'C', team: 'B' },
													{ id: 'p4', name: 'D', team: 'B' }
												]
											},
											{
												setNumber: 2,
												status: 'IN_PROGRESS',
												teamAScore: null,
												teamBScore: null,
												players: [
													{ id: 'p1', name: 'A', team: 'A' },
													{ id: 'p2', name: 'B', team: 'A' },
													{ id: 'p3', name: 'C', team: 'B' },
													{ id: 'p4', name: 'D', team: 'B' }
												]
											}
										]
									: [
											{
												setNumber: 1,
												status: 'IN_PROGRESS',
												teamAScore: null,
												teamBScore: null,
												players: [
													{ id: 'p1', name: 'A', team: 'A' },
													{ id: 'p2', name: 'B', team: 'A' },
													{ id: 'p3', name: 'C', team: 'B' },
													{ id: 'p4', name: 'D', team: 'B' }
												]
											}
										]
							}
						]
					: []
			});
		if (path.endsWith('/public_club_profile'))
			return route.fulfill({ json: [{ id: 'club-e2e', name: 'PB NEWBIE' }] });
		if (path.endsWith('/public_member_roster')) return route.fulfill({ json: [] });
		if (path.endsWith('/public_session_history'))
			return route.fulfill({
				json: closed
					? [
							{
								...session,
								closed_at: '2026-10-04T21:00:00.000Z',
								fee_per_person: feeConfirmed ? 15000 : null,
								attendance: 2
							}
						]
					: []
			});
		if (path.endsWith('/public_fund_summary'))
			return route.fulfill({ json: [{ received: 0, expenses: 0, balance: 0 }] });
		if (path.endsWith('/rpc/public_fund_activity')) return route.fulfill({ json: [] });
		if (path.endsWith('/rpc/my_club'))
			return route.fulfill({
				json: [
					{
						id: 'club-e2e',
						name: 'PB NEWBIE',
						is_club_admin: true,
						is_finance_admin: true
					}
				]
			});
		if (path.endsWith('/rpc/club_roster'))
			return route.fulfill({
				json: withRoster
					? Array.from({ length: 20 }, (_, index) => ({
							id: ['player-a', 'player-b'][index] ?? `player-${index + 1}`,
							display_name: ['Ayu', 'Budi'][index] ?? `Pemain ${index + 1}`,
							membership_type: 'MEMBER',
							rating: 1200,
							uncertainty: 0.7
						}))
					: []
			});
		if (path.endsWith('/rpc/finance_session_attendees'))
			return route.fulfill({
				json: feeConfirmed
					? ['player-a', 'player-b'].map((playerId, index) => ({
							player_id: playerId,
							display_name: index ? 'Budi' : 'Ayu',
							amount: 15000,
							paid_at: paidPlayers.has(playerId) ? '2026-10-04T21:05:00Z' : null
						}))
					: []
			});
		if (path.endsWith('/rpc/public_session_finance_recap'))
			return route.fulfill({
				json: [
					{
						fee_per_person: feeConfirmed ? 15000 : null,
						expected_fees: feeConfirmed ? 30000 : 0,
						court_expenses: 0,
						shuttlecock_expenses: 0,
						other_expenses: 0
					}
				]
			});
		if (path.endsWith('/rpc/public_session_attendance'))
			return route.fulfill({
				json: closed
					? [
							{
								player_id: 'player-a',
								display_name: 'Ayu',
								membership_type: 'MEMBER',
								is_paid: paidPlayers.has('player-a')
							},
							{
								player_id: 'player-b',
								display_name: 'Budi',
								membership_type: 'MEMBER',
								is_paid: paidPlayers.has('player-b')
							}
						]
					: []
			});
		if (path.endsWith('/rpc/close_session')) {
			closed = true;
			return route.fulfill({ json: { attendance: 2, sets: 0, startedAt: session.started_at } });
		}
		if (path.endsWith('/rpc/suggest_session_fee')) return route.fulfill({ json: 15000 });
		if (path.endsWith('/rpc/confirm_session_fee')) {
			feeConfirmed = true;
			return route.fulfill({ json: 2 });
		}
		if (path.endsWith('/rpc/set_session_attendee_paid')) {
			paidWriteCount += 1;
			const body = route.request().postDataJSON();
			if (body.p_paid) paidPlayers.add(body.p_player_id);
			else paidPlayers.delete(body.p_player_id);
			return route.fulfill({ json: null });
		}
		if (path.endsWith('/rpc/complete_set') && failScore)
			return route.fulfill({ status: 400, json: { message: 'Score save failed' } });
		if (path.endsWith('/rpc/substitute_player') && failSubstitution)
			return route.fulfill({ status: 400, json: { message: 'Substitution save failed' } });
		return route.fulfill({ json: [] });
	});
	await page.route('**/auth/v1/user', (route) =>
		route.fulfill({
			json: {
				id: 'admin-e2e',
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
					id: 'admin-e2e',
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
	return { getPaidWriteCount: () => paidWriteCount };
}

test('public visitor can open the read-only live view', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('PB NEWBIE', { exact: true })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Riwayat' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Dana' })).toBeVisible();
});

test('admin checks in a selected group with one database request', async ({ page }) => {
	await mockLiveBackend(page, false, false, false, true);
	const batchRequests: { p_session_id: string; p_player_ids: string[] }[] = [];
	page.on('request', (request) => {
		if (request.url().endsWith('/rpc/check_in_players')) batchRequests.push(request.postDataJSON());
	});
	await page.goto('/live');
	await page.getByRole('button', { name: 'Check in pemain', exact: true }).click();
	const sheet = page.locator('.sve-sheet.court-sheet').first();
	const viewportHeight = page.viewportSize()!.height;
	const scrollState = await sheet.evaluate((element) => ({
		height: element.getBoundingClientRect().height,
		bottom: element.getBoundingClientRect().bottom,
		scrollHeight: element.scrollHeight,
		clientHeight: element.clientHeight
	}));
	expect(scrollState.height).toBeLessThanOrEqual(viewportHeight * 0.75 + 2);
	expect(scrollState.bottom).toBeCloseTo(viewportHeight, 0);
	expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
	const pageScrollBeforeSelection = await page.evaluate(() => window.scrollY);
	await page.getByLabel('Pilih pemain yang datang').getByText('Ayu', { exact: true }).click();
	await page.getByLabel('Pilih pemain yang datang').getByText('Budi', { exact: true }).click();
	expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBeforeSelection);
	await page.getByRole('button', { name: 'Check in 2 pemain' }).click();
	await expect.poll(() => batchRequests.length).toBe(1);
	expect(batchRequests[0]).toEqual({
		p_session_id: sessionId,
		p_player_ids: ['player-a', 'player-b']
	});
});

test('admin can end a session and continue on its dedicated close page', async ({ page }) => {
	const backend = await mockLiveBackend(page);
	await page.goto('/');

	await page.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
	const confirm = page
		.getByRole('dialog')
		.getByRole('button', { name: 'Akhiri sesi', exact: true });
	await expect(confirm).toBeEnabled();
	await confirm.click();

	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}$`));
	await expect(page.getByRole('heading', { name: 'Rekap penutupan sesi' })).toBeVisible();
	await expect(page.getByText('2 pemain hadir · 0 match · sesi sudah ditutup')).toBeVisible();
	await page.getByRole('button', { name: 'Konfirmasi iuran & buat tagihan' }).click();
	await expect(page.getByRole('heading', { name: 'Checklist pembayaran' })).toBeVisible();
	await expect(page.getByText('Ayu')).toBeVisible();
	const firstPaidToggle = page.getByRole('checkbox').first();
	await firstPaidToggle.check();
	await firstPaidToggle.uncheck();
	await expect(page.getByText('0/2 lunas')).toBeVisible();
	await expect.poll(() => backend.getPaidWriteCount()).toBe(1);
	await firstPaidToggle.check();
	await expect(page.getByText('1/2 lunas')).toBeVisible();
	await expect.poll(() => backend.getPaidWriteCount()).toBe(2);
	await page.getByRole('link', { name: 'Riwayat' }).click();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}/confirm$`));
	await expect(page.getByRole('heading', { name: 'Mau keluar ke riwayat?' })).toBeVisible();
	await page.getByRole('link', { name: 'Kembali edit iuran & pembayaran' }).click();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}$`));
	await page.getByRole('link', { name: 'Riwayat' }).click();
	await page.getByRole('link', { name: 'Lanjut ke riwayat' }).click();
	await expect(page.getByRole('heading', { name: 'Rekap dana sesi' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Hadir & pembayaran (2)' })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Lunas' })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Belum bayar' })).toBeVisible();
	await expect(page.getByText('Rp15.000', { exact: true })).toBeVisible();
});

test('active match prevents session close but keeps its action discoverable', async ({ page }) => {
	await mockLiveBackend(page, true);
	await page.goto('/');

	await page.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText(/Selesaikan atau batalkan match/)).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Akhiri sesi', exact: true })).toBeDisabled();
});

test('failed score save keeps the operator input available for retry', async ({ page }) => {
	await mockLiveBackend(page, true, true);
	await page.goto('/');
	await page.getByLabel('Skor Tim A').fill('21');
	await page.getByLabel('Skor Tim B').fill('17');
	await page.getByRole('button', { name: 'Selesaikan Set 1' }).click();

	await expect(page.getByText('Score save failed')).toBeVisible();
	await expect(page.getByLabel('Skor Tim A')).toHaveValue('21');
	await expect(page.getByLabel('Skor Tim B')).toHaveValue('17');
});

test('substitution remains on its confirmation step when save fails', async ({ page }) => {
	await mockLiveBackend(page, true, false, true);
	await page.goto('/');
	await page.getByRole('button', { name: 'Ganti pemain' }).click();
	await page.getByRole('button', { name: 'A', exact: true }).click();
	await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
	await page.getByRole('button', { name: 'Rafi menunggu', exact: true }).click();
	await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
	await page.getByRole('button', { name: 'Konfirmasi', exact: true }).click();

	await expect(page.getByText('Substitution save failed')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'A sekarang…' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Konfirmasi', exact: true })).toBeEnabled();
});
