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
	withRoster = false,
	readyCount = 0,
	failRecommendation = false,
	failPairingAudit = false
) {
	let closed = false;
	let feeConfirmed = false;
	let paidWriteCount = 0;
	let startMatchBody: Record<string, unknown> | null = null;
	let saveRecommendationBody: Record<string, unknown> | null = null;
	let savePairingBody: Record<string, unknown> | null = null;
	let publicRatingValue = 1248.4;
	const paidPlayers = new Set<string>();
	await page.route('**/rest/v1/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname;
		if (path.endsWith('/live_session'))
			return route.fulfill({
				json: closed ? [] : [session],
				headers: { 'content-range': closed ? '*/*' : '0-0/1' }
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
								status: 'READY',
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
	return {
		getPaidWriteCount: () => paidWriteCount,
		getStartMatchBody: () => startMatchBody,
		getSaveRecommendationBody: () => saveRecommendationBody,
		getSavePairingBody: () => savePairingBody,
		setPublicRatingValue: (value: number) => (publicRatingValue = value)
	};
}

test('public visitor can open the read-only live view', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('PB NEWBIE', { exact: true })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Riwayat' })).toBeVisible();
	// Navigation label changed from Dana to Kas; preserve the public cash-page link check.
	await expect(page.getByRole('link', { name: 'Kas' })).toBeVisible();
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
	// Current close page heading is the finalized session recap, not the older draft label.
	await expect(page.getByRole('heading', { name: 'Rekap sesi selesai' })).toBeVisible();
	await expect(page.getByText('2 pemain hadir · 0 match · sesi sudah ditutup')).toBeVisible();
	await page.getByRole('link', { name: 'Kembali ke Live' }).click();
	await expect(page.getByRole('heading', { name: 'Rekap sesi belum dikonfirmasi' })).toBeVisible();
	await page.getByRole('link', { name: 'Lanjutkan rekap' }).click();
	await expect(page.getByRole('link', { name: 'Konfirmasi rekap' })).toBeVisible();
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
	await page.getByRole('link', { name: 'Konfirmasi rekap' }).click();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}/confirm$`));
	await expect(
		page.getByRole('heading', { name: 'Sesi selesai. Lanjut ke riwayat?' })
	).toBeVisible();
	await page.getByRole('link', { name: 'Kembali edit iuran & pembayaran' }).click();
	await expect(page).toHaveURL(new RegExp(`/session-close/${sessionId}$`));
	await page.getByRole('link', { name: 'Konfirmasi rekap' }).click();
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

test('admin accepts the current four-player recommendation and continues to manual team assignment', async ({
	page
}) => {
	const backend = await mockLiveBackend(page, false, false, false, false, 6);
	await page.goto('/live');
	await page.getByRole('button', { name: 'Siapkan match' }).click();

	const sheet = page.locator('.sve-sheet.court-sheet').last();
	await expect(sheet.getByRole('region', { name: 'Rekomendasi pemain Algorithm 1' })).toBeVisible();
	await expect(sheet.getByText('SHOULD PLAY', { exact: true }).first()).toBeVisible();
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

test('Algorithm 2 offers exactly three legal pairings and deterministic recommendation', async ({
	page
}) => {
	await mockLiveBackend(page, false, false, false, false, 4);
	await page.goto('/live');
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
		await page.goto('/live');
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
	await page.goto('/live');
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
	const backend = await mockLiveBackend(page);
	await page.goto('/players/p1');
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
	await page.goto('/live');
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
	await page.goto('/live');
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
	await page.goto('/live');
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
	await page.goto('/live');
	await expect(page.getByRole('button', { name: 'Siapkan match' })).toHaveCount(0);
});
