import { expect, test } from '@playwright/test';

const sessionId = 'session-live-e2e';
const session = {
	id: sessionId,
	club_id: 'club-e2e',
	started_at: '2026-10-04T18:00:00.000Z',
	court_count: 1
};

async function mockLiveBackend(
	page: import('@playwright/test').Page,
	withActiveMatch = false,
	failScore = false,
	failSubstitution = false,
	withRoster = false,
	readyCount = 0,
	failRecommendation = false,
	failPairingAudit = false,
	delayAdminAccess = false,
	authenticated = true,
	courtCount = 1,
	hasSession = true,
	tiedMatch = false
) {
	let closed = false;
	let sessionStarted = hasSession;
	let activeCourtCount = courtCount;
	let feeConfirmed = false;
	let feeConfirmCount = 0;
	let paidWriteCount = 0;
	let startMatchBody: Record<string, unknown> | null = null;
	let startSessionBody: Record<string, unknown> | null = null;
	let deciderCommand: { path: string; body: Record<string, unknown> } | null = null;
	let saveRecommendationBody: Record<string, unknown> | null = null;
	let savePairingBody: Record<string, unknown> | null = null;
	let publicRatingValue = 1248.4;
	const paidPlayers = new Set<string>();
	await page.route('**/rest/v1/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname;
		if (path.endsWith('/live_session'))
			return route.fulfill({
				json: closed || !sessionStarted ? [] : [{ ...session, court_count: activeCourtCount }],
				headers: { 'content-range': closed || !sessionStarted ? '*/*' : '0-0/1' }
			});
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
								uncertainty: 280,
								status: 'READY',
								ready_since: '2026-10-04T17:30:00.000Z',
								leave_after_match: false
							}
						]
					: readyCount
						? Array.from({ length: readyCount }, (_, index) => ({
								participant_id: `sp-${index + 1}`,
								player_id: `p${index + 1}`,
								display_name: `Pemain ${index + 1}`,
								membership_type: 'MEMBER',
								rating: 1200,
								uncertainty: 280,
								status: withActiveMatch && index < 4 ? 'PLAYING' : 'READY',
								ready_since: '2026-10-05T17:00:00.000Z',
								leave_after_match: false
							}))
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
								court_number: 1,
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
									: tiedMatch
										? [
												{
													setNumber: 1,
													status: 'COMPLETED',
													teamAScore: 21,
													teamBScore: 18,
													players: [
														{ id: 'p1', name: 'A', team: 'A' },
														{ id: 'p2', name: 'B', team: 'A' },
														{ id: 'p3', name: 'C', team: 'B' },
														{ id: 'p4', name: 'D', team: 'B' }
													]
												},
												{
													setNumber: 2,
													status: 'COMPLETED',
													teamAScore: 18,
													teamBScore: 21,
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
		if (path.endsWith('/public_member_roster'))
			return route.fulfill({
				json: withRoster ? [{ id: 'p1', display_name: 'Pemain 1', membership_type: 'MEMBER' }] : []
			});
		if (path.endsWith('/rpc/public_player_profile'))
			return route.fulfill({
				json: [
					{
						id: 'p1',
						display_name: 'Pemain 1',
						membership_type: 'MEMBER',
						sessions: 2,
						sets: 3,
						wins: 2,
						losses: 1
					}
				]
			});
		if (path.endsWith('/rpc/public_player_recent_sessions')) return route.fulfill({ json: [] });
		if (path.endsWith('/rpc/public_player_rating'))
			return route.fulfill({
				json: [
					{
						rating: publicRatingValue,
						uncertainty: 90,
						algorithm_version: 'trueskill-style-bounded-margin-v1'
					}
				]
			});
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
		if (path.endsWith('/rpc/my_club')) {
			if (delayAdminAccess) await new Promise((resolve) => setTimeout(resolve, 600));
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
		}
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
		if (path.endsWith('/rpc/start_session')) {
			const body = route.request().postDataJSON() as Record<string, unknown>;
			startSessionBody = body;
			sessionStarted = true;
			activeCourtCount = Number(body.p_court_count);
			return route.fulfill({ json: sessionId });
		}
		if (path.endsWith('/rpc/suggest_session_fee')) return route.fulfill({ json: 15000 });
		if (path.endsWith('/rpc/confirm_session_fee')) {
			feeConfirmCount += 1;
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
		if (path.endsWith('/rpc/get_rotation_fairness_state'))
			return route.fulfill({
				json: Array.from({ length: readyCount }, (_, index) => ({
					participant_id: `sp-${index + 1}`,
					player_id: `p${index + 1}`,
					eligible_opportunities: index === 0 ? 4 : 2,
					missed_opportunities: index === 0 ? 4 : 1,
					current_opportunity_debt: index === 0 ? 4 : 0,
					rotations_played: index === 0 ? 0 : 1,
					sets_played: index === 0 ? 0 : 2,
					consecutive_rotations: 0
				}))
			});
		if (path.endsWith('/rpc/save_rotation_recommendation')) {
			saveRecommendationBody = route.request().postDataJSON();
			if (failRecommendation)
				return route.fulfill({ status: 503, json: { message: 'Recommendation unavailable' } });
			return route.fulfill({ json: 'recommendation-e2e' });
		}
		if (path.endsWith('/rpc/start_match')) {
			startMatchBody = route.request().postDataJSON();
			return route.fulfill({ json: 'match-e2e-started' });
		}
		if (path.endsWith('/rpc/start_decider_set') || path.endsWith('/rpc/finish_tied_match')) {
			deciderCommand = { path, body: route.request().postDataJSON() };
			return route.fulfill({ json: path.endsWith('/rpc/start_decider_set') ? 'set-3' : null });
		}
		if (path.endsWith('/rpc/save_pairing_recommendation')) {
			savePairingBody = route.request().postDataJSON();
			return route.fulfill(
				failPairingAudit
					? { status: 503, json: { message: 'Unavailable' } }
					: { json: 'pairing-e2e' }
			);
		}
		return route.fulfill({ json: [] });
	});
	await page.route('**/auth/v1/token?grant_type=password', (route) =>
		route.fulfill({
			json: {
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
			}
		})
	);
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
	await page.route('**/api/live/complete-set', (route) =>
		route.fulfill(
			failScore
				? { status: 409, json: { message: 'Score save failed' } }
				: { json: { result: 'SET_2' } }
		)
	);
	if (authenticated) {
		await page.addInitScript(() => {
			localStorage.setItem(
				'sb-courtside-e2e-auth-token',
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
	}
	return {
		getPaidWriteCount: () => paidWriteCount,
		getFeeConfirmCount: () => feeConfirmCount,
		getStartSessionBody: () => startSessionBody,
		getDeciderCommand: () => deciderCommand,
		getStartMatchBody: () => startMatchBody,
		getSaveRecommendationBody: () => saveRecommendationBody,
		getSavePairingBody: () => savePairingBody,
		setPublicRatingValue: (value: number) => (publicRatingValue = value)
	};
}

test('keeps the admin access check visible after sign-in while permissions load', async ({
	page
}) => {
	await mockLiveBackend(page, false, false, false, false, 0, false, false, true, false);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Masuk sebagai admin', exact: true }).click();
	await page.getByLabel('Email').fill('admin@example.com');
	await page.getByLabel('Kata sandi').fill('password123');
	await page.getByRole('button', { name: 'Masuk', exact: true }).click();

	await expect(page.getByRole('status').filter({ hasText: 'Memeriksa akses klub' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Masuk sebagai admin' })).toHaveCount(0);
});

test('public visitor can open the read-only live view', async ({ page }) => {
	await page.route('**/rest/v1/**', (route) =>
		route.fulfill({
			json: route.request().url().includes('public_club_profile')
				? [{ id: 'club-e2e', name: 'PB NEWBIE' }]
				: []
		})
	);
	await page.goto('/clubs/club-e2e/live');
	await expect(page.getByText('PB NEWBIE', { exact: true })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Riwayat' })).toBeVisible();
	// Navigation label changed from Dana to Kas; preserve the public cash-page link check.
	await expect(page.getByRole('link', { name: 'Kas' })).toBeVisible();
});

test('Live returns from supporting pages with cached state at mobile widths', async ({ page }) => {
	await mockLiveBackend(page, false, false, false, true, 4);
	const liveSessionRequests: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.endsWith('/live_session'))
			liveSessionRequests.push(request.url());
	});

	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 360, height: 780 }
	]) {
		await page.setViewportSize(viewport);
		await page.goto('/clubs/club-e2e/live');
		await expect(page.getByRole('button', { name: 'Check in pemain', exact: true })).toBeVisible();
		await expect(page.getByLabel('Memeriksa sesi aktif')).toHaveCount(0);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);

		for (const route of ['/players', '/history', '/fund']) {
			const label = route === '/players' ? 'Pemain' : route === '/history' ? 'Riwayat' : 'Kas';
			await page.getByRole('link', { name: label, exact: true }).click();
			await expect(page).toHaveURL(new RegExp(`${route}$`));
			await page.getByRole('link', { name: 'Live', exact: true }).click();
			await expect(page).toHaveURL(/\/live$/);
			await expect(
				page.getByRole('button', { name: 'Check in pemain', exact: true })
			).toBeVisible();
			await expect(page.getByLabel('Memeriksa sesi aktif')).toHaveCount(0);
		}
	}

	expect(liveSessionRequests).toHaveLength(2);
});

test('admin checks in a selected group with one database request', async ({ page }) => {
	await mockLiveBackend(page, false, false, false, true);
	const batchRequests: { p_session_id: string; p_player_ids: string[] }[] = [];
	page.on('request', (request) => {
		if (request.url().endsWith('/rpc/check_in_players')) batchRequests.push(request.postDataJSON());
	});
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Check in pemain', exact: true }).click();
	const sheet = page.locator('.sve-sheet.court-sheet').first();
	const viewportHeight = page.viewportSize()!.height;
	const scrollState = await sheet.evaluate((element) => ({
		height: element.getBoundingClientRect().height,
		bottom: element.getBoundingClientRect().bottom
	}));
	expect(scrollState.height).toBeLessThanOrEqual(viewportHeight * 0.75 + 2);
	expect(scrollState.bottom).toBeCloseTo(viewportHeight, 0);
	// The scrollable content pane, rather than the fixed sheet shell, owns overflow.
	const contentScroll = await sheet.locator('.overflow-y-auto').evaluate((element) => ({
		scrollHeight: element.scrollHeight,
		clientHeight: element.clientHeight
	}));
	expect(contentScroll.scrollHeight).toBeGreaterThan(contentScroll.clientHeight);
	const pageScrollBeforeSelection = await page.evaluate(() => window.scrollY);
	await page.getByLabel('Pilih pemain yang datang').getByText('Ayu', { exact: true }).click();
	await page.getByLabel('Pilih pemain yang datang').getByText('Budi', { exact: true }).click();
	expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBeforeSelection);
	await page.getByRole('button', { name: 'Catat 2 pemain hadir' }).click();
	await expect.poll(() => batchRequests.length).toBe(1);
	expect(batchRequests[0]).toEqual({
		p_session_id: sessionId,
		p_player_ids: ['player-a', 'player-b']
	});
});

test('admin chooses the session court count before starting the session', async ({ page }) => {
	const backend = await mockLiveBackend(
		page,
		false,
		false,
		false,
		false,
		0,
		false,
		false,
		false,
		true,
		1,
		false
	);
	await page.goto('/clubs/club-e2e/live');
	await page.getByLabel('Jumlah court').fill('2');
	await page.getByRole('button', { name: 'Mulai sesi malam ini' }).click();

	await expect.poll(() => backend.getStartSessionBody()).not.toBeNull();
	expect(backend.getStartSessionBody()).toEqual({ p_club_id: 'club-e2e', p_court_count: 2 });
});

test('admin can end a session and continue on its dedicated close page', async ({ page }) => {
	const backend = await mockLiveBackend(page);
	await page.goto('/clubs/club-e2e/live');

	await page.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
	const confirm = page
		.getByRole('dialog')
		.getByRole('button', { name: 'Akhiri sesi', exact: true });
	await expect(confirm).toBeEnabled();
	await confirm.click();

	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}$`));
	// Current close page heading is the finalized session recap, not the older draft label.
	await expect(page.getByRole('heading', { name: 'Rekap sesi selesai' })).toBeVisible();
	await expect(page.getByText('2 pemain hadir · 0 match · sesi sudah ditutup')).toBeVisible();
	await page.getByRole('link', { name: 'Kembali ke Live' }).click();
	await expect(page.getByRole('heading', { name: 'Rekap sesi belum dikonfirmasi' })).toBeVisible();
	await page.getByRole('link', { name: 'Lanjutkan rekap' }).click();
	await expect(page.getByRole('link', { name: 'Konfirmasi rekap' })).toBeVisible();
	await expect(page.getByText('Jumlah pemain').locator('..')).toContainText('2');
	await expect(page.getByText('Iuran per orang').last().locator('..')).toContainText('Rp15.000');
	await expect(page.getByText('Total tagihan yang akan dibuat').locator('..')).toContainText(
		'Rp30.000'
	);
	expect(backend.getFeeConfirmCount()).toBe(0);
	await page.getByRole('button', { name: 'Konfirmasi iuran & buat tagihan' }).click();
	await expect.poll(() => backend.getFeeConfirmCount()).toBe(1);
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
	await page.getByRole('link', { name: 'Konfirmasi rekap' }).click();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}/confirm$`));
	await expect(
		page.getByRole('heading', { name: 'Sesi selesai. Lanjut ke riwayat?' })
	).toBeVisible();
	await page.getByRole('link', { name: 'Kembali edit iuran & pembayaran' }).click();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}$`));

	await page.getByRole('checkbox').nth(1).check();
	await page.getByRole('link', { name: 'Konfirmasi rekap' }).click();
	await expect(page.getByText('2 lunas · 0 belum', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Kembali edit iuran & pembayaran' }).click();
	await page.getByRole('checkbox').nth(1).uncheck();
	await page.getByRole('link', { name: 'Konfirmasi rekap' }).click();
	await expect(page.getByText('1 lunas · 1 belum', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Selesai & lihat riwayat' }).click();
	await expect(page).toHaveURL(new RegExp(`/history/${sessionId}$`));
	await expect(page.getByRole('heading', { name: 'Rekap dana sesi' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Hadir & pembayaran (2)' })).toBeVisible();
	// The recap now labels payment state explicitly rather than coloring the whole row.
	await expect(page.locator('li').filter({ hasText: 'Ayu' }).getByText('LUNAS')).toBeVisible();
	await expect(
		page.locator('li').filter({ hasText: 'Budi' }).getByText('BELUM BAYAR')
	).toBeVisible();
	await expect(page.getByText('Rp15.000', { exact: true })).toBeVisible();
});

test('active match prevents session close but keeps its action discoverable', async ({ page }) => {
	await mockLiveBackend(page, true);
	await page.goto('/clubs/club-e2e/live');

	await page.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByText(/Selesaikan atau batalkan match/)).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Akhiri sesi', exact: true })).toBeDisabled();
});

test('failed score save keeps the operator input available for retry', async ({ page }) => {
	await mockLiveBackend(page, true, true);
	await page.goto('/clubs/club-e2e/live');
	await page.getByLabel('Skor Tim A').fill('21');
	await page.getByLabel('Skor Tim B').fill('17');
	await page.getByRole('button', { name: 'Selesaikan Set 1' }).click();

	await expect(page.getByText('Score save failed')).toBeVisible();
	await expect(page.getByLabel('Skor Tim A')).toHaveValue('21');
	await expect(page.getByLabel('Skor Tim B')).toHaveValue('17');
});

test('score save gives delayed feedback and blocks duplicate submission until server confirmation', async ({
	page
}) => {
	await mockLiveBackend(page, true);
	let releaseSave!: () => void;
	let requests = 0;
	const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
	await page.route('**/api/live/complete-set', async (route) => {
		requests += 1;
		await saveGate;
		await route.fulfill({ json: { result: 'SET_2' } });
	});
	await page.goto('/clubs/club-e2e/live');
	await page.getByLabel('Skor Tim A').fill('21');
	await page.getByLabel('Skor Tim B').fill('17');
	await page.getByRole('button', { name: 'Selesaikan Set 1' }).click();
	const saveButton = page.getByRole('button', { name: 'Menyimpan skor…' });
	await expect(saveButton).toBeDisabled();
	await expect(
		page.getByRole('status').filter({ hasText: 'Menunggu konfirmasi server' })
	).toBeVisible();
	await expect(page.getByText('Penyimpanan masih berlangsung')).toBeVisible({ timeout: 5000 });
	await expect(page.getByRole('status').filter({ hasText: 'dikonfirmasi server' })).toHaveCount(0);
	releaseSave();
	await expect(page.getByRole('status').filter({ hasText: 'dikonfirmasi server' })).toBeVisible();
	expect(requests).toBe(1);
});

test('substitution remains on its confirmation step when save fails', async ({ page }) => {
	await mockLiveBackend(page, true, false, true);
	await page.goto('/clubs/club-e2e/live');
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

test('admin accepts the current four-player recommendation and continues to manual team assignment', async ({
	page
}) => {
	const backend = await mockLiveBackend(page, false, false, false, false, 6);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Siapkan match' }).click();

	const sheet = page.locator('.sve-sheet.court-sheet').last();
	await expect(sheet.getByRole('region', { name: 'Rekomendasi pemain Algorithm 1' })).toBeVisible();
	await expect(sheet.getByText('Prioritas tinggi', { exact: true }).first()).toBeVisible();
	const recommendation = backend.getSaveRecommendationBody()!;
	const recommendedIds = recommendation.p_recommended_player_ids as string[];
	await sheet.getByRole('button', { name: 'Lanjutkan dengan rekomendasi' }).click();
	await sheet.getByRole('button', { name: 'Mulai match' }).click();
	await expect.poll(() => backend.getStartMatchBody()).not.toBeNull();
	const started = backend.getStartMatchBody()!;
	expect(started.p_rotation_recommendation_id).toBe('recommendation-e2e');
	expect([...(started.p_team_a as string[]), ...(started.p_team_b as string[])]).toEqual(
		recommendedIds
	);
	await expect.poll(() => backend.getSavePairingBody()).not.toBeNull();
	expect(backend.getSavePairingBody()!.p_recommended_team_a).toEqual(started.p_team_a);
	expect(backend.getSavePairingBody()!.p_recommended_team_b).toEqual(started.p_team_b);
});

test('a free court can use READY players while another court is already playing', async ({
	page
}) => {
	const backend = await mockLiveBackend(
		page,
		true,
		false,
		false,
		false,
		8,
		false,
		false,
		false,
		true,
		2
	);
	await page.goto('/clubs/club-e2e/live');
	const freeCourt = page.getByRole('region', { name: 'Court 2' });
	await expect(freeCourt).toContainText('Siapkan match');
	await freeCourt.getByRole('button', { name: 'Siapkan match' }).click();
	const sheet = page.locator('.sve-sheet.court-sheet').last();
	await sheet.getByRole('button', { name: 'Lanjutkan dengan rekomendasi' }).click();
	await sheet.getByRole('button', { name: 'Mulai match' }).click();

	await expect.poll(() => backend.getStartMatchBody()).not.toBeNull();
	expect(backend.getStartMatchBody()!.p_court_number).toBe(2);
	expect(backend.getStartMatchBody()!.p_team_a).toHaveLength(2);
	expect(backend.getStartMatchBody()!.p_team_b).toHaveLength(2);
});

test('a 1–1 match asks whether to play Set 3 before the next pairing', async ({ page }) => {
	const backend = await mockLiveBackend(
		page,
		true,
		false,
		false,
		false,
		4,
		false,
		false,
		false,
		true,
		1,
		true,
		true
	);
	await page.goto('/clubs/club-e2e/live');
	const decision = page.getByRole('region', { name: 'Keputusan Set 3 untuk court 1' });
	await expect(decision.getByRole('heading', { name: 'Skor 1–1' })).toBeVisible();
	await expect(decision.getByRole('button', { name: 'Lanjut Set 3' })).toBeVisible();
	await expect(
		decision.getByRole('button', { name: 'Akhiri 1–1 dan lanjut ke pairing berikutnya' })
	).toBeVisible();
	await decision.getByRole('button', { name: 'Lanjut Set 3' }).click();
	await expect.poll(() => backend.getDeciderCommand()).not.toBeNull();
	expect(backend.getDeciderCommand()!.path).toContain('/rpc/start_decider_set');
	expect(backend.getDeciderCommand()!.body).toMatchObject({
		p_session_id: sessionId,
		p_match_id: 'match-e2e'
	});
});

test('Algorithm 2 offers exactly three legal pairings and deterministic recommendation', async ({
	page
}) => {
	await mockLiveBackend(page, false, false, false, false, 4);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Siapkan match' }).click();
	const sheet = page.locator('.sve-sheet.court-sheet').last();
	await sheet.getByRole('button', { name: 'Lanjutkan dengan rekomendasi' }).click();
	await expect(sheet.getByText('REKOMENDASI TIM')).toBeVisible();
	const options = sheet.locator('button').filter({ hasText: /Paling seimbang|Selisih/ });
	await expect(options).toHaveCount(3);
	await expect(options.first()).toContainText('Paling seimbang');
	await expect(options.first()).toContainText('Pemain 1 + Pemain 2 vs Pemain 3 + Pemain 4');
});

for (const [index, teamA, teamB] of [
	[1, ['p1', 'p3'], ['p2', 'p4']],
	[2, ['p1', 'p4'], ['p2', 'p3']]
] as const) {
	test(`admin can choose legal alternative pairing ${index}`, async ({ page }) => {
		const backend = await mockLiveBackend(page, false, false, false, false, 4);
		await page.goto('/clubs/club-e2e/live');
		await page.getByRole('button', { name: 'Siapkan match' }).click();
		const sheet = page.locator('.sve-sheet.court-sheet').last();
		await sheet.getByRole('button', { name: 'Lanjutkan dengan rekomendasi' }).click();
		const options = sheet.locator('button').filter({ hasText: /Paling seimbang|Selisih/ });
		await options.nth(index).click();
		await sheet.getByRole('button', { name: 'Mulai match' }).click();
		await expect.poll(() => backend.getStartMatchBody()).not.toBeNull();
		expect(backend.getStartMatchBody()!.p_team_a).toEqual(teamA);
		expect(backend.getStartMatchBody()!.p_team_b).toEqual(teamB);
	});
}

test('pairing audit failure does not prevent the manually selected match from starting', async ({
	page
}) => {
	const backend = await mockLiveBackend(page, false, false, false, false, 4, false, true);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Siapkan match' }).click();
	const sheet = page.locator('.sve-sheet.court-sheet').last();
	await sheet.getByRole('button', { name: 'Lanjutkan dengan rekomendasi' }).click();
	await sheet.getByRole('button', { name: 'Mulai match' }).click();
	await expect.poll(() => backend.getStartMatchBody()).not.toBeNull();
	await expect(
		page.getByText('Rekomendasi tidak tersimpan. Tim tetap dipilih dan match tetap berjalan.')
	).toBeVisible();
});

test('player detail displays authoritative rating and confidence state', async ({ page }) => {
	const backend = await mockLiveBackend(page, false, false, false, true);
	await page.goto('/clubs/club-e2e/players/p1');
	await expect(page.getByText('1248', { exact: true })).toBeVisible();
	await expect(page.getByText('Stabil', { exact: true })).toBeVisible();
	backend.setPublicRatingValue(1199.1);
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await expect(page.getByText('1199', { exact: true })).toBeVisible();
});

test('admin can override multiple recommended players; actual four are sent with the recommendation ID', async ({
	page
}) => {
	const backend = await mockLiveBackend(page, false, false, false, false, 6);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Siapkan match' }).click();
	const sheet = page.locator('.sve-sheet.court-sheet').last();
	const checkboxes = sheet
		.getByRole('group', { name: 'Pilih empat pemain untuk match' })
		.getByRole('checkbox');
	await expect(checkboxes).toHaveCount(6);
	const recommendation = backend.getSaveRecommendationBody()!;
	const recommendedIds = recommendation.p_recommended_player_ids as string[];
	await checkboxes.nth(0).click();
	await checkboxes.nth(1).click();
	await checkboxes.nth(4).click();
	await checkboxes.nth(5).click();
	await sheet.getByRole('button', { name: 'Lanjutkan dengan pilihan ini' }).click();
	await sheet.getByRole('button', { name: 'Mulai match' }).click();
	await expect.poll(() => backend.getStartMatchBody()).not.toBeNull();
	const started = backend.getStartMatchBody()!;
	const actualIds = [...(started.p_team_a as string[]), ...(started.p_team_b as string[])];
	expect(started.p_rotation_recommendation_id).toBe('recommendation-e2e');
	expect(actualIds).toHaveLength(4);
	expect(actualIds).not.toEqual(recommendedIds);
	expect(actualIds.filter((id) => recommendedIds.includes(id))).toHaveLength(2);
	await expect.poll(() => backend.getSavePairingBody()).not.toBeNull();
	const auditPlayers = [
		...(backend.getSavePairingBody()!.p_recommended_team_a as string[]),
		...(backend.getSavePairingBody()!.p_recommended_team_b as string[])
	];
	expect(auditPlayers.sort()).toEqual(actualIds.sort());
});

test('admin can override one recommended player', async ({ page }) => {
	const backend = await mockLiveBackend(page, false, false, false, false, 6);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Siapkan match' }).click();
	const sheet = page.locator('.sve-sheet.court-sheet').last();
	const checkboxes = sheet
		.getByRole('group', { name: 'Pilih empat pemain untuk match' })
		.getByRole('checkbox');
	const recommendedIds = backend.getSaveRecommendationBody()!.p_recommended_player_ids as string[];
	await checkboxes.nth(0).click();
	await checkboxes.nth(5).click();
	await sheet.getByRole('button', { name: 'Lanjutkan dengan pilihan ini' }).click();
	await sheet.getByRole('button', { name: 'Mulai match' }).click();
	await expect.poll(() => backend.getStartMatchBody()).not.toBeNull();
	const started = backend.getStartMatchBody()!;
	const actualIds = [...(started.p_team_a as string[]), ...(started.p_team_b as string[])];
	expect(actualIds).toHaveLength(4);
	expect(actualIds).not.toEqual(recommendedIds);
	expect(actualIds.filter((id) => recommendedIds.includes(id))).toHaveLength(3);
});

test('manual selection remains available when recommendation persistence fails', async ({
	page
}) => {
	const backend = await mockLiveBackend(page, false, false, false, false, 6, true);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Siapkan match' }).click();
	await expect(page.getByText('Recommendation unavailable')).toBeVisible();
	const sheet = page.locator('.sve-sheet.court-sheet').last();
	const checkboxes = sheet
		.getByRole('group', { name: 'Pilih empat pemain untuk match' })
		.getByRole('checkbox');
	for (let index = 0; index < 4; index++) await checkboxes.nth(index).check();
	await sheet.getByRole('button', { name: 'Lanjutkan dengan pilihan ini' }).click();
	await sheet.getByRole('button', { name: 'Mulai match' }).click();
	await expect.poll(() => backend.getStartMatchBody()).not.toBeNull();
	expect(backend.getStartMatchBody()!.p_rotation_recommendation_id).toBeNull();
});

test('fewer than four READY players have no actionable next-match recommendation', async ({
	page
}) => {
	await mockLiveBackend(page, false, false, false, false, 3);
	await page.goto('/clubs/club-e2e/live');
	await expect(page.getByRole('button', { name: 'Siapkan match' })).toHaveCount(0);
});

test('admin roster retains guests and offers promotion', async ({ page }) => {
	await mockLiveBackend(page);
	await page.route('**/rest/v1/rpc/club_roster', (route) =>
		route.fulfill({
			json: [
				{
					id: 'guest-1',
					display_name: 'Tamu Rafi',
					membership_type: 'GUEST',
					rating: 1200,
					uncertainty: 280
				}
			]
		})
	);
	await page.goto('/clubs/club-e2e/players');
	await expect(page.getByText('Tamu Rafi', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Jadikan anggota' })).toBeVisible();
});

test('confirmation waits for a replacement payment write after rapid toggles', async ({ page }) => {
	await mockLiveBackend(page);
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
	await page.getByRole('button', { name: 'Konfirmasi iuran & buat tagihan' }).click();
	let releaseFirst!: () => void;
	let releaseSecond!: () => void;
	const firstGate = new Promise<void>((resolve) => {
		releaseFirst = resolve;
	});
	const secondGate = new Promise<void>((resolve) => {
		releaseSecond = resolve;
	});
	let writes = 0;
	await page.route('**/rest/v1/rpc/set_session_attendee_paid', async (route) => {
		writes++;
		await (writes === 1 ? firstGate : secondGate);
		await route.fulfill({ json: null });
	});
	const toggle = page.getByRole('checkbox').first();
	await toggle.check();
	await expect.poll(() => writes).toBe(1);
	await toggle.uncheck();
	await page.getByRole('link', { name: 'Konfirmasi rekap' }).click();
	releaseFirst();
	await expect.poll(() => writes).toBe(2);
	await expect(page.getByText('Menyimpan pembayaran…', { exact: true })).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}$`));
	releaseSecond();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}/confirm$`));
});

test('new club guidance explains the first session without blocking guest play', async ({
	page
}) => {
	await mockLiveBackend(page);
	await page.route('**/rest/v1/live_session*', (route) => route.fulfill({ json: [] }));
	await page.goto('/clubs/club-e2e/live');
	await expect(page.getByRole('heading', { name: 'Sesi pertama klubmu' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Tambahkan pemain tetap' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Mulai sesi malam ini' })).toBeEnabled();
});

test('starting the first session immediately opens check-in from the saved session', async ({
	page
}) => {
	await mockLiveBackend(page, false, false, false, true);
	let started = false;
	let checkedSession = '';
	page.on('request', (request) => {
		if (request.url().endsWith('/rpc/check_in_players'))
			checkedSession = request.postDataJSON().p_session_id;
	});
	await page.route('**/rest/v1/live_session*', (route) =>
		route.fulfill({ json: started ? [session] : [] })
	);
	await page.route('**/rest/v1/rpc/start_session', (route) => {
		started = true;
		return route.fulfill({ json: sessionId });
	});
	await page.goto('/clubs/club-e2e/live');
	await page.getByRole('button', { name: 'Mulai sesi malam ini' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.getByLabel('Pilih pemain yang datang').getByText('Ayu', { exact: true }).click();
	await page.getByRole('button', { name: 'Catat 1 pemain hadir' }).click();
	await expect.poll(() => checkedSession).toBe(sessionId);
});

test('rotation preview is advisory and does not persist until the admin prepares a match', async ({
	page
}) => {
	const backend = await mockLiveBackend(page, false, false, false, false, 4);
	await page.goto('/clubs/club-e2e/live');
	const preview = page.getByRole('region', { name: 'Saran empat pemain' });
	await expect(preview).toBeVisible();
	await expect(preview.getByText('Pemain 1', { exact: true })).toBeVisible();
	expect(backend.getSaveRecommendationBody()).toBeNull();
	await expect(page.getByText('Sinkron terakhir', { exact: false })).toBeVisible();
	await page.context().setOffline(true);
	await expect(
		page.getByText('Offline · menampilkan data terakhir', { exact: true })
	).toBeVisible();
	await expect(preview).toBeVisible();
});

for (const width of [360, 390]) {
	test(`courtside preview fits a ${width}px phone`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 844 });
		await mockLiveBackend(page, false, false, false, false, 4);
		await page.goto('/clubs/club-e2e/live');
		await expect(page.getByRole('region', { name: 'Saran empat pemain' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Siapkan match', exact: true })).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			width
		);
		await page.screenshot({ path: testInfo.outputPath(`courtside-${width}.png`), fullPage: true });
	});
}

test('public viewer between sets cannot open substitution or start-set controls', async ({
	page
}) => {
	await mockLiveBackend(page, true, false, true, false, 0, false, false, false, false);
	await page.goto('/clubs/club-e2e/live');
	await expect(page.getByRole('heading', { name: 'Match 1', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Ganti pemain', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Mulai Set 2', exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Skor Tim A')).toHaveCount(0);
});

test('three configured courts can be reached horizontally on a phone without widening the page', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await mockLiveBackend(page, false, false, false, false, 8, false, false, false, true, 3);
	await page.goto('/clubs/club-e2e/live');
	const navigation = page.getByRole('navigation', { name: 'Pilih court' });
	await expect(navigation.getByRole('button')).toHaveCount(3);
	await navigation.getByRole('button', { name: 'Court 3', exact: true }).click();
	await expect(navigation.getByRole('button', { name: 'Court 3', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	const court = page.getByRole('group', { name: 'Papan Court 3', exact: true });
	await expect.poll(async () => (await court.boundingBox())?.x).toBeLessThan(50);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await court.getByRole('button', { name: 'Siapkan match' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
});

for (const admin of [true, false]) {
	for (const ready of [0, 3, 4]) {
		test(`empty Court 2 stays visible with ${ready} READY players for ${admin ? 'admin' : 'public'}`, async ({
			page
		}) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await mockLiveBackend(page, false, false, false, false, ready, false, false, false, admin, 2);
			await page.goto('/clubs/club-e2e/live');
			await page
				.getByRole('navigation', { name: 'Pilih court' })
				.getByRole('button', { name: 'Court 2', exact: true })
				.click();
			const court = page.getByRole('region', { name: 'Court 2', exact: true });
			await expect(court).toBeVisible();
			await expect(court.getByRole('heading')).toHaveText(
				ready === 0 ? 'Menunggu pemain.' : ready < 4 ? 'Pemain belum cukup.' : '4 pemain siap.'
			);
			const prepare = court.getByRole('button', { name: 'Siapkan match' });
			if (!admin) await expect(prepare).toHaveCount(0);
			else if (ready < 4) await expect(prepare).toBeDisabled();
			else await expect(prepare).toBeEnabled();
		});
	}
}

test('Court 2 explains the shortfall while Court 1 uses four of seven players', async ({
	page
}) => {
	await mockLiveBackend(page, true, false, false, false, 7, false, false, false, true, 2);
	await page.goto('/clubs/club-e2e/live');
	await page
		.getByRole('navigation', { name: 'Pilih court' })
		.getByRole('button', { name: 'Court 2', exact: true })
		.click();
	const court = page.getByRole('region', { name: 'Court 2', exact: true });
	await expect(court).toContainText('3 pemain READY — butuh 1 pemain lagi');
	await expect(court.getByRole('button', { name: 'Siapkan match' })).toBeDisabled();
});
