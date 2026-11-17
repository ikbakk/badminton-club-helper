<script lang="ts">
	import { onMount } from 'svelte';
	import LiveSessionPanel from '$lib/components/live/LiveSessionPanel.svelte';
	import CheckInSheet from '$lib/components/live/CheckInSheet.svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CourtDialog from '$lib/components/ui/CourtDialog.svelte';
	import type { Participant, ParticipantStatus } from '$lib/domain/types';
	import { kokShares } from '$lib/domain/finance/session-charges';
	import {
		DEMO_STORAGE_KEY,
		checkInDemoPlayers,
		completeDemoSet,
		correctDemoSet,
		demoRecommendation,
		finishDemoTie,
		freshDemoState,
		readDemoState,
		setDemoStatus,
		startDemoDecider,
		startDemoMatch,
		substituteDemoPlayer,
		type DemoState
	} from '$lib/features/demo/local-session';

	let demo = $state<DemoState>(freshDemoState());
	let view = $state('/live');
	let selected = $state<Participant | null>(null);
	let showPlayers = $state(false);
	let showEnd = $state(false);
	let kokMatchId = $state<string | null>(null);
	let kokCount = $state('');
	let base = $state('15000');
	let kokPrice = $state('0');
	let courtRent = $state('0');
	let expenseLabel = $state('');
	let expenseAmount = $state('');
	let pricingError = $state('');
	let storageAvailable = $state(true);
	let loaded = false;
	let recommendation = $derived(demoRecommendation(demo));
	let suggestedPlayers = $derived(
		recommendation.selectedPlayerIds.map(
			(id) => demo.participants.find((player) => player.id === id)?.name ?? id
		)
	);
	let feeParticipants = $derived(
		demo.participants.filter((player) => demo.attendeeIds.includes(player.id))
	);
	let roster = $derived(
		demo.participants.map((player) => ({
			id: player.id,
			display_name: player.name,
			membership_type: player.membership,
			rating: player.rating,
			uncertainty: player.uncertainty
		}))
	);
	let checkedInIds = $derived(new Set(demo.attendeeIds));
	let shares = $derived(
		kokShares(
			demo.completed.map((match) => ({
				id: match.id,
				kokCount: demo.kokByMatch[match.id] ?? null,
				sets: match.sets
					.filter((set) => set.status === 'COMPLETED')
					.map((set) => ({ players: set.players }))
			})),
			demo.countKok && Number.isSafeInteger(Number(kokPrice)) && Number(kokPrice) >= 0
				? Number(kokPrice)
				: 0
		)
	);
	let totalDue = $derived(
		feeParticipants.reduce(
			(sum, player) => sum + (Number(base) || 0) + (shares.get(player.id) ?? 0),
			0
		)
	);
	let totalKokUsed = $derived(
		demo.completed.reduce((sum, match) => sum + (demo.kokByMatch[match.id] ?? 0), 0)
	);
	let collected = $derived(
		demo.pricing
			? demo.paidIds
					.filter((id) => demo.attendeeIds.includes(id))
					.reduce(
						(sum, id) =>
							sum +
							demo.pricing!.base +
							(kokShares(
								demo.completed.map((match) => ({
									id: match.id,
									kokCount: demo.kokByMatch[match.id] ?? null,
									sets: match.sets
										.filter((set) => set.status === 'COMPLETED')
										.map((set) => ({ players: set.players }))
								})),
								demo.pricing!.kokPrice
							).get(id) ?? 0)
					)
			: 0
	);
	let kas = $derived(
		demo.openingKas +
			collected -
			(demo.pricing?.courtRent ?? 0) -
			demo.kasExpenses.reduce((sum, item) => sum + item.amount, 0)
	);

	onMount(() => {
		try {
			demo = readDemoState(localStorage);
			if (demo.pricing) {
				base = String(demo.pricing.base);
				kokPrice = String(demo.pricing.kokPrice);
				courtRent = String(demo.pricing.courtRent);
			}
		} catch {
			storageAvailable = false;
		}
		loaded = true;
	});

	function save() {
		if (!loaded) return;
		try {
			localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demo));
		} catch {
			storageAvailable = false;
		}
	}
	function confirmPricing() {
		if (!Number.isSafeInteger(Number(base)) || Number(base) <= 0) {
			pricingError = 'Masukkan iuran dasar per pemain yang lebih dari Rp0.';
			return;
		}
		if (demo.countKok && (!Number.isSafeInteger(Number(kokPrice)) || Number(kokPrice) < 0)) {
			pricingError = 'Masukkan harga kok yang valid.';
			return;
		}
		if (!Number.isSafeInteger(Number(courtRent)) || Number(courtRent) < 0) {
			pricingError = 'Masukkan jumlah sewa lapangan yang valid.';
			return;
		}
		if (
			demo.countKok &&
			demo.completed.some(
				(match) => !Number.isSafeInteger(demo.kokByMatch[match.id]) || demo.kokByMatch[match.id] < 0
			)
		) {
			pricingError = 'Catat jumlah kok untuk setiap match selesai sebelum mengonfirmasi.';
			return;
		}
		demo.pricing = {
			base: Number(base),
			kokPrice: demo.countKok ? Number(kokPrice) : 0,
			courtRent: Number(courtRent)
		};
		pricingError = '';
		save();
	}
	function reset() {
		demo = freshDemoState();
		selected = null;
		showPlayers = false;
		save();
	}
	function changeStatus(status: ParticipantStatus) {
		if (selected && setDemoStatus(demo, selected.id, status)) {
			if (demo.session && status === 'READY' && !demo.attendeeIds.includes(selected.id))
				demo.attendeeIds.push(selected.id);
			selected = null;
			save();
		}
	}
	function addGuest(rawName: string) {
		const name = rawName.trim();
		if (!name) return;
		const id = crypto.randomUUID();
		demo.participants.push({
			id,
			name,
			membership: 'GUEST',
			rating: 1200,
			uncertainty: 280,
			status: 'READY',
			readySince: new Date(),
			consecutiveMatches: 0,
			opportunities: 0,
			missedOpportunities: 0,
			currentOpportunityDebt: 0,
			rotationsPlayed: 0,
			setsPlayed: 0
		});
		if (demo.session) demo.attendeeIds.push(id);
		save();
	}
	function checkInPlayers(playerIds: string[]) {
		const success = checkInDemoPlayers(demo, playerIds);
		if (success) save();
		return Promise.resolve(success);
	}
	function beginMatch(
		teamA: string[],
		teamB: string[],
		_recommendationId: string | null,
		_pairingAudit?: unknown,
		courtNumber = 1
	) {
		const success = startDemoMatch(demo, teamA, teamB, courtNumber);
		if (success) save();
		return Promise.resolve(success);
	}
	function completeSet(matchId: string, a: number, b: number) {
		const success = completeDemoSet(demo, matchId, a, b);
		if (success && demo.countKok && demo.completed.some((match) => match.id === matchId)) {
			kokMatchId = matchId;
			kokCount = '';
		}
		if (success) save();
		return Promise.resolve(success);
	}
	function correctSet(matchId: string, setNumber: number, a: number, b: number) {
		const success = correctDemoSet(demo, matchId, setNumber, a, b);
		if (success) save();
		return Promise.resolve(success);
	}
	function substitute(
		matchId: string,
		outgoingId: string,
		replacementId: string,
		status: 'RESTING' | 'OUT' | 'LEFT'
	) {
		const success = substituteDemoPlayer(demo, matchId, outgoingId, replacementId, status);
		if (success) save();
		return Promise.resolve(success);
	}
	function decision(matchId: string, thirdSet: boolean) {
		const success = thirdSet ? startDemoDecider(demo, matchId) : finishDemoTie(demo, matchId);
		if (success && !thirdSet && demo.countKok) {
			kokMatchId = matchId;
			kokCount = '';
		}
		if (success) save();
		return Promise.resolve(success);
	}
	const statusLabels: Record<ParticipantStatus, string> = {
		READY: 'Siap',
		PLAYING: 'Sedang main',
		RESTING: 'Istirahat',
		AWAY: 'Sebentar pergi',
		OUT: 'Selesai malam ini',
		LEFT: 'Pulang'
	};
</script>

<svelte:head
	><title>Demo Courtside | Coba sesi klub</title><meta
		name="robots"
		content="noindex"
	/></svelte:head
>
<AppShell current={view} clubName="PB Newbie · Demo" demo ondemonavigate={(next) => (view = next)}>
	<div class="demo-page">
		<div class="demo-intro">
			<h1>Coba Courtside</h1>
			<p>
				Kelola contoh sesi tanpa login. Semua pemain dan skor di sini fiktif; perubahan hanya
				tersimpan di browser ini.
			</p>
			<div class="demo-actions">
				<AppButton variant="secondary" onclick={reset}>Ulangi demo</AppButton>
				<span>{demo.completedMatches} match selesai</span>
			</div>
			{#if !storageAvailable}<p role="status">
					Penyimpanan browser tidak tersedia. Demo tetap bisa dicoba selama halaman ini terbuka.
				</p>{/if}
		</div>
		<main>
			{#if view === '/players'}
				<section class="demo-recap">
					<h2>Pemain</h2>
					<p>Daftar dan status pemain sesi demo.</p>
					<AppButton disabled={!demo.session} onclick={() => (showPlayers = true)}
						>Check in pemain</AppButton
					>
					{#each demo.participants as player (player.id)}<div class="recap-person">
							<b>{player.name}</b><span
								>{statusLabels[player.status]} · {player.membership === 'GUEST'
									? 'Tamu'
									: 'Anggota'}</span
							>
						</div>{/each}
				</section>
			{:else if view === '/history'}
				<section class="demo-recap">
					<h2>Riwayat</h2>
					<p>{demo.completedMatches} match selesai dalam demo ini.</p>
					{#each demo.completed as match (match.id)}
						<details class="recap-person">
							<summary
								><b>Match {match.sequence_number}</b> · {match.sets.filter(
									(set) => set.status === 'COMPLETED'
								).length} set selesai</summary
							>
							{#each match.sets.filter((set) => set.status === 'COMPLETED') as set (set.id)}
								<div class="history-set">
									<b>Set {set.setNumber} · {set.teamAScore}–{set.teamBScore}</b>
									<div class="history-teams">
										<span
											>{set.players
												.filter((player) => player.team === 'A')
												.map((player) => player.name)
												.join(' + ')}</span
										>
										<b>vs</b>
										<span
											>{set.players
												.filter((player) => player.team === 'B')
												.map((player) => player.name)
												.join(' + ')}</span
										>
									</div>
								</div>
							{/each}
						</details>
					{/each}
				</section>
			{:else if view === '/settings'}
				<section class="demo-recap">
					<h2>Pengaturan demo</h2>
					<p>Semua data fiktif tersimpan di browser ini.</p>
					<AppButton variant="secondary" onclick={reset}>Ulangi demo</AppButton>
				</section>
			{:else}
				{#if view === '/fund' && demo.session}<section class="demo-recap">
						<h2>Kas klub</h2>
						<p>Tagihan ditetapkan setelah sesi berakhir.</p>
						<p>Saldo kas tercatat: <b>Rp{demo.openingKas.toLocaleString('id-ID')}</b></p>
					</section>{:else if !demo.session && demo.hasEndedSession}
					<section class="demo-recap">
						<h2>Rekap sesi demo</h2>
						<p>
							Harga ditetapkan setelah bermain. Sewa lapangan langsung dianggap dibayar saat tagihan
							dikonfirmasi.
						</p>
						{#if feeParticipants.length === 0}
							<p>Tidak ada pemain yang check in, jadi tidak ada tagihan.</p>
							<AppButton
								onclick={() => {
									demo.hasEndedSession = false;
									save();
								}}>Mulai sesi baru</AppButton
							>
						{:else if !demo.pricing}
							{#if demo.countKok && demo.completed.length && Object.keys(demo.kokByMatch).length < demo.completed.length}
								<p role="alert">Catat kok untuk semua match sebelum membuat tagihan.</p>
							{/if}
							<div class="preset-row">
								{#each [10000, 15000, 20000] as preset (preset)}<AppButton
										variant="secondary"
										onclick={() => (base = String(preset))}
										>Rp{preset.toLocaleString('id-ID')}</AppButton
									>{/each}
							</div>
							<div class="recap-fields">
								<label>
									Iuran dasar per pemain (Rp)
									<input type="number" min="1" bind:value={base} />
								</label>
								{#if demo.countKok}
									<label
										>Harga per kok (Rp)<input type="number" min="0" bind:value={kokPrice} /></label
									>
								{/if}
								<label>
									Sewa lapangan dibayar (Rp)
									<input type="number" min="0" bind:value={courtRent} />
								</label>
							</div>
							{#if demo.countKok && demo.completed.length}
								<h3>Kok per match</h3>
								{#each demo.completed as match (match.id)}<label
										>Match {match.sequence_number}<input
											type="number"
											min="0"
											value={demo.kokByMatch[match.id] ?? ''}
											oninput={(event) => {
												if (event.currentTarget.value === '') {
													delete demo.kokByMatch[match.id];
													save();
													return;
												}
												const count = Number(event.currentTarget.value);
												if (
													event.currentTarget.value !== '' &&
													Number.isSafeInteger(count) &&
													count >= 0
												) {
													demo.kokByMatch[match.id] = count;
													save();
												}
											}}
										/></label
									>{/each}
							{/if}
							<h3>Tagihan tiap pemain</h3>
							{#each feeParticipants as player (player.id)}<div class="recap-person">
									<b>{player.name}</b>
									<span
										>Dasar Rp{(Number(base) || 0).toLocaleString('id-ID')}{#if demo.countKok}
											+ bagian kok Rp{(shares.get(player.id) ?? 0).toLocaleString('id-ID')} ({totalKokUsed}
											kok @ Rp{Number(kokPrice || 0).toLocaleString('id-ID')}){/if}</span
									>
									<strong
										>Rp{((Number(base) || 0) + (shares.get(player.id) ?? 0)).toLocaleString(
											'id-ID'
										)}</strong
									>
								</div>{/each}
							<p>Total tagihan: <b>Rp{totalDue.toLocaleString('id-ID')}</b></p>
							{#if demo.countKok && demo.completed.length > 0}
								<p>
									Penggunaan sesi: <b
										>{totalKokUsed} kok × Rp{Number(kokPrice || 0).toLocaleString('id-ID')}</b
									>; bagian tiap pemain dihitung dari jumlah set yang dimainkan.
								</p>
							{/if}
							{#if pricingError}<p role="alert">{pricingError}</p>{/if}
							<AppButton onclick={confirmPricing}>Konfirmasi tagihan dan sewa</AppButton>
						{:else}
							<p>
								Total tagihan: Rp{feeParticipants
									.reduce(
										(sum, player) =>
											sum +
											demo.pricing!.base +
											(kokShares(
												demo.completed.map((match) => ({
													id: match.id,
													kokCount: demo.kokByMatch[match.id] ?? null,
													sets: match.sets
														.filter((set) => set.status === 'COMPLETED')
														.map((set) => ({ players: set.players }))
												})),
												demo.pricing!.kokPrice
											).get(player.id) ?? 0),
										0
									)
									.toLocaleString('id-ID')}
							</p>
							{#each feeParticipants as player (player.id)}<label class="paid-row"
									><input
										type="checkbox"
										checked={demo.paidIds.includes(player.id)}
										onchange={(event) => {
											demo.paidIds = event.currentTarget.checked
												? [...demo.paidIds, player.id]
												: demo.paidIds.filter((id) => id !== player.id);
											save();
										}}
									/>
									{player.name} · Rp{(
										demo.pricing!.base +
										(kokShares(
											demo.completed.map((match) => ({
												id: match.id,
												kokCount: demo.kokByMatch[match.id] ?? null,
												sets: match.sets
													.filter((set) => set.status === 'COMPLETED')
													.map((set) => ({ players: set.players }))
											})),
											demo.pricing!.kokPrice
										).get(player.id) ?? 0)
									).toLocaleString('id-ID')} · {demo.paidIds.includes(player.id)
										? 'Lunas'
										: 'Belum bayar'}</label
								>{/each}
							<p>
								Terkumpul: Rp{collected.toLocaleString('id-ID')} · Belum dibayar: Rp{(
									totalDue - collected
								).toLocaleString('id-ID')}
							</p>
							<p><b>Kas klub tercatat: Rp{kas.toLocaleString('id-ID')}</b></p>
							<form
								onsubmit={(event) => {
									event.preventDefault();
									const amount = Number(expenseAmount);
									if (Number.isSafeInteger(amount) && amount > 0) {
										demo.kasExpenses.push({
											amount,
											label: expenseLabel.trim() || 'Pengeluaran lain'
										});
										expenseLabel = '';
										expenseAmount = '';
										save();
									}
								}}
							>
								<h3>Belanja dari Kas</h3>
								<label
									>Catatan (opsional)<input
										bind:value={expenseLabel}
										placeholder="Beli 2 tabung kok"
									/></label
								><label>Jumlah (Rp)<input type="number" min="1" bind:value={expenseAmount} /></label
								><AppButton
									type="submit"
									disabled={!Number.isSafeInteger(Number(expenseAmount)) ||
										Number(expenseAmount) <= 0}>Catat pengeluaran</AppButton
								>
							</form>
							{#each demo.kasExpenses as expense, index (index)}<p>
									{expense.label} · −Rp{expense.amount.toLocaleString('id-ID')}
								</p>{/each}
						{/if}
					</section>
				{/if}
				{#if view === '/live' && (demo.session || !demo.hasEndedSession || demo.pricing)}<LiveSessionPanel
						demo
						headingLevel={2}
						session={demo.session}
						participants={demo.participants}
						activeMatches={demo.activeMatches}
						{suggestedPlayers}
						canManage
						onadminlogin={() => {}}
						onstartsession={(courtCount, mode, countKok) => {
							demo.countKok = countKok;
							if (!demo.session && demo.pricing) demo.openingKas = kas;
							demo.hasEndedSession = false;
							demo.attendeeIds = [];
							demo.completed = [];
							demo.kokByMatch = {};
							demo.pricing = null;
							demo.adjustments = {};
							demo.paidIds = [];
							demo.kasExpenses = [];
							demo.completedMatches = 0;
							demo.session = {
								id: 'demo-session',
								club_id: 'demo-club',
								started_at: new Date().toISOString(),
								court_count: courtCount,
								match_mode: mode,
								count_kok: countKok
							};
							demo.participants = demo.participants.map((player) => ({
								...player,
								status: 'OUT',
								readySince: undefined
							}));
							showPlayers = true;
							save();
						}}
						oncheckin={() => (showPlayers = true)}
						onendsession={() => (showEnd = true)}
						onselect={(participant) => (selected = participant)}
						onstartmatch={beginMatch}
						onpreparenext={async () => ({ id: 'local-recommendation', recommendation })}
						oncompleteset={completeSet}
						oncorrectset={correctSet}
						onabandonmatch={(matchId) => {
							if (!confirm('Batalkan match demo ini?')) return;
							const match = demo.activeMatches.find((item) => item.id === matchId);
							if (!match) return;
							for (const player of match.sets.at(-1)?.players ?? []) {
								const participant = demo.participants.find((item) => item.id === player.id);
								if (participant?.status === 'PLAYING') {
									participant.status = 'READY';
									participant.readySince = new Date();
								}
							}
							demo.activeMatches = demo.activeMatches.filter((item) => item.id !== matchId);
							save();
						}}
						onsubstitute={substitute}
						onstartdecider={(matchId) => decision(matchId, true)}
						onskiptiedmatch={(matchId) => decision(matchId, false)}
					/>{/if}
			{/if}
		</main>
	</div>
</AppShell>

{#if showPlayers}
	<CheckInSheet
		{roster}
		{checkedInIds}
		oncheckin={checkInPlayers}
		onaddguest={(name) => {
			addGuest(name);
			return Promise.resolve();
		}}
		onclose={() => (showPlayers = false)}
	/>
{/if}

{#if selected}
	<CourtDialog
		open
		title={`Status ${selected.name}`}
		onOpenChange={(open) => !open && (selected = null)}
	>
		<div class="dialog-body">
			<h2>{selected.name}</h2>
			<p>Status sekarang: {statusLabels[selected.status]}</p>
			{#if selected.status === 'PLAYING'}<p>Ubah status setelah match selesai.</p>{:else}
				<div class="status-actions">
					{#each (['READY', 'RESTING', 'AWAY', 'OUT', 'LEFT'] as ParticipantStatus[]).filter((status) => status !== selected?.status) as status (status)}
						<AppButton variant="secondary" onclick={() => changeStatus(status)}
							>{statusLabels[status]}</AppButton
						>
					{/each}
				</div>
			{/if}
			<AppButton variant="ghost" onclick={() => (selected = null)}>Tutup</AppButton>
		</div>
	</CourtDialog>
{/if}

{#if kokMatchId}
	<CourtDialog open title="Kok yang dipakai" onOpenChange={(open) => !open && (kokMatchId = null)}>
		<div class="dialog-body">
			<h2>Berapa kok dipakai?</h2>
			<p>Catat total kok dalam match ini. Nol berarti tidak ada kok baru.</p>
			<label>Jumlah kok<input type="number" min="0" step="1" bind:value={kokCount} /></label>
			<div class="status-actions">
				<AppButton variant="secondary" onclick={() => (kokMatchId = null)}>Nanti saja</AppButton
				><AppButton
					disabled={kokCount === '' ||
						!Number.isSafeInteger(Number(kokCount)) ||
						Number(kokCount) < 0}
					onclick={() => {
						demo.kokByMatch[kokMatchId!] = Number(kokCount);
						kokMatchId = null;
						save();
					}}>Simpan jumlah kok</AppButton
				>
			</div>
		</div>
	</CourtDialog>
{/if}

{#if showEnd}
	<CourtDialog open title="Akhiri sesi demo" onOpenChange={(open) => (showEnd = open)}>
		<div class="dialog-body">
			<h2>Akhiri sesi demo?</h2>
			<p>
				Anda bisa memulai sesi baru di halaman ini. Riwayat match demo hanya berupa jumlah match
				selesai.
			</p>
			<div class="status-actions">
				<AppButton variant="secondary" onclick={() => (showEnd = false)}>Batal</AppButton>
				<AppButton
					disabled={demo.activeMatches.length > 0}
					onclick={() => {
						demo.session = null;
						demo.hasEndedSession = true;
						showEnd = false;
						save();
					}}>Akhiri sesi</AppButton
				>
			</div>
		</div>
	</CourtDialog>
{/if}

<style>
	.demo-page {
		max-width: 600px;
		margin: auto;
		padding: 20px 20px 48px;
	}
	.demo-intro {
		padding: 32px 0 24px;
	}
	.demo-intro h1 {
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.035em;
	}
	.demo-intro p {
		font-size: 13px;
		line-height: 1.8;
		margin-top: 12px;
		color: var(--court-muted);
	}
	.demo-actions {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 16px;
		font-size: 12px;
		color: var(--court-muted);
	}
	.dialog-body {
		padding: 24px;
		max-height: 80vh;
		overflow: auto;
		color: #163630;
	}
	.dialog-body h2 {
		font-size: 22px;
		font-weight: 800;
	}
	.dialog-body p {
		margin: 8px 0 20px;
		font-size: 14px;
	}
	.dialog-body label {
		display: block;
		font-size: 13px;
		font-weight: 700;
		margin-bottom: 6px;
	}
	.status-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.status-actions {
		margin: 16px 0;
	}
	.demo-recap {
		border: 1px solid #b9c5bb;
		padding: 20px;
		margin-bottom: 24px;
		background: #fffaf0;
	}
	.demo-recap h2 {
		font-size: 24px;
		font-weight: 800;
	}
	.demo-recap h3 {
		margin-top: 20px;
		font-size: 18px;
		font-weight: 700;
	}
	.demo-recap p {
		margin: 10px 0;
		font-size: 14px;
		line-height: 1.6;
	}
	.demo-recap label {
		display: block;
		margin: 10px 0;
		font-size: 13px;
		font-weight: 700;
	}
	.demo-recap input,
	.dialog-body input {
		display: block;
		min-height: 44px;
		width: 100%;
		padding: 8px;
		border: 1px solid #b9c5bb;
		background: #fff;
	}
	.demo-recap input[type='checkbox'] {
		display: inline-block;
		min-height: 20px;
		width: 20px;
	}
	.preset-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 16px 0;
	}
	.recap-fields {
		display: grid;
		gap: 8px;
	}
	.recap-person {
		border-top: 1px solid #d6ddd3;
		padding: 12px 0;
	}
	.demo-recap details summary {
		cursor: pointer;
	}
	.history-set {
		border-top: 1px solid #d6ddd3;
		margin-top: 12px;
		padding-top: 12px;
	}
	.history-teams {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		font-size: 13px;
	}
	.history-teams span:last-child {
		text-align: right;
	}
	.recap-person span {
		display: block;
		font-size: 12px;
	}
	.paid-row {
		display: flex !important;
		align-items: center;
		gap: 8px;
	}
</style>
