<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LiveSessionPanel from '$lib/components/live/LiveSessionPanel.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CheckInSheet from '$lib/components/live/CheckInSheet.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import CourtDialog from '$lib/components/ui/CourtDialog.svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import { currentUser, signInWithPassword } from '$lib/auth';
	import { setCachedClub } from '$lib/auth-state.svelte';
	import {
		addPlayer,
		bootstrapClub,
		getClub,
		getPublicClub,
		getPublicFundSummary,
		getPublicRoster,
		getPublicSessionHistory,
		invalidatePublicData,
		getRoster,
		startSession,
		type Club,
		type PublicFundSummary,
		type PublicSessionHistory,
		type RosterPlayer
	} from '$lib/data/dashboard';
	import { LiveController } from '$lib/features/live/live-controller.svelte';
	import { subscribeToLiveUpdates } from '$lib/data/live';
	import type { Participant, ParticipantStatus } from '$lib/domain/types';
	import { supabase } from '$lib/supabase';
	import { toast } from 'sve-ui';

	type Tab = 'live' | 'players' | 'history' | 'fund';
	let tab = $state<Tab>('live');
	let email = $state('');
	let password = $state('');
	let userEmail = $state<string | null>(null);
	let club = $state<Club | null>(null);
	let publicClub = $state<{ id: string; name: string } | null>(null);
	let publicRoster = $state<{ id: string; display_name: string }[]>([]);
	let publicHistory = $state<PublicSessionHistory[]>([]);
	let fundSummary = $state<PublicFundSummary | null>(null);
	let roster = $state<RosterPlayer[]>([]);
	let live = new LiveController((message) => toast.error(message));
	let session = $derived(live.session);
	let participants = $derived(live.participants);
	let activeMatch = $derived(live.activeMatch);
	let loading = $state(true);
	let online = $state(true);
	let clubName = $state('');
	let playerName = $state('');
	let adminLoginOpen = $state(false);
	let showCheckIn = $state(false);
	let showEndSession = $state(false);
	let selectedParticipant = $state<Participant | null>(null);
	let pending = $derived(live.pending);

	function notify(message: string) {
		toast(message);
	}

	function notifyError(error: unknown, fallback: string) {
		const message =
			error instanceof Error
				? error.message
				: error &&
					  typeof error === 'object' &&
					  'message' in error &&
					  typeof error.message === 'string'
					? error.message
					: fallback;
		toast.error(message);
	}

	let displayName = $derived(club?.name ?? publicClub?.name ?? 'PB NEWBIE');
	let canManageLive = $derived(Boolean(userEmail && club?.is_club_admin));
	let checkedInIds = $derived(new Set(participants.map((participant) => participant.id)));
	const participantStatusLabel: Record<ParticipantStatus, string> = {
		READY: 'Siap',
		PLAYING: 'Sedang main',
		RESTING: 'Istirahat',
		AWAY: 'Sebentar pergi',
		OUT: 'Selesai main',
		LEFT: 'Sudah pulang'
	};
	async function refreshLive() {
		await live.refresh();
	}

	function syncConnection() {
		if (!browser) return;
		online = navigator.onLine;
		live.setOnline(online);
		if (online) {
			notify('Koneksi kembali. Memperbarui kondisi lapangan…');
			void refreshLive();
		} else {
			notify('Koneksi terputus. Menampilkan kondisi sesi terakhir yang tersimpan.');
		}
	}

	function refreshWhenVisible() {
		if (browser && document.visibilityState === 'visible' && navigator.onLine) {
			void refreshLive();
		}
	}

	$effect(() => {
		if (!session || !online) return;
		const interval = window.setInterval(() => void refreshLive(), 15_000);
		return () => window.clearInterval(interval);
	});

	$effect(() => {
		const activeSession = session;
		if (!activeSession || !online) return;
		return subscribeToLiveUpdates(activeSession.id, () => void refreshLive());
	});

	async function refreshAccount() {
		loading = true;
		try {
			club = await getClub();
			setCachedClub(club);
			roster = club ? await getRoster(club.id) : [];
			live.setAdminAuthorized(Boolean(club?.is_club_admin));
		} catch (error) {
			notifyError(error, 'Data klub belum bisa dimuat. Coba lagi.');
		} finally {
			loading = false;
		}
	}

	async function refreshPublic() {
		publicClub = await getPublicClub();
		publicRoster = publicClub ? await getPublicRoster(publicClub.id) : [];
		[publicHistory, fundSummary] = await Promise.all([
			getPublicSessionHistory(),
			getPublicFundSummary()
		]);
		await refreshLive();
	}

	async function passwordLogin() {
		pending = 'Sedang masuk…';
		try {
			await signInWithPassword(email, password);
			adminLoginOpen = false;
			notify('Berhasil masuk.');
		} catch (error) {
			notifyError(error, 'Tidak bisa masuk. Periksa email dan kata sandi, lalu coba lagi.');
		} finally {
			pending = '';
		}
	}

	async function createClub() {
		try {
			await bootstrapClub(clubName);
			clubName = '';
			notify('Klub siap. Tambahkan pemain dulu, lalu mulai sesi.');
			await refreshAccount();
		} catch (error) {
			notifyError(error, 'Klub belum bisa dibuat. Coba lagi sebentar.');
		}
	}

	async function createPlayer() {
		if (!club || !playerName.trim()) return;
		try {
			await addPlayer(club.id, playerName);
			playerName = '';
			await refreshAccount();
		} catch (error) {
			notifyError(error, 'Pemain belum bisa ditambahkan. Coba lagi.');
		}
	}

	async function createSession() {
		if (!club) return;
		try {
			await startSession(club.id);
			notify('Sesi dimulai.');
			await refreshLive();
			showCheckIn = true;
		} catch (error) {
			notifyError(error, 'Sesi belum bisa dimulai. Coba lagi.');
		}
	}

	async function checkInPlayers(playerIds: string[]) {
		return live.checkInMany(playerIds);
	}

	async function addGuest(name: string) {
		await live.addGuest(name);
	}

	async function substitute(
		outgoingPlayerId: string,
		replacementPlayerId: string,
		outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
	) {
		return live.substitute(outgoingPlayerId, replacementPlayerId, outgoingStatus);
	}

	async function setStatus(status: ParticipantStatus) {
		if (!selectedParticipant?.sessionParticipantId) return;
		if (await live.setStatus(selectedParticipant.sessionParticipantId, status))
			selectedParticipant = null;
	}

	async function beginMatch(
		teamA: string[],
		teamB: string[],
		recommendationId: string | null,
		pairingAudit?: Parameters<typeof live.startMatch>[3]
	) {
		return live.startMatch(teamA, teamB, recommendationId, pairingAudit);
	}

	async function prepareNextMatch() {
		return live.prepareNextMatch();
	}

	async function saveSet(teamA: number, teamB: number) {
		return live.completeSet(teamA, teamB);
	}

	async function correctSet(setNumber: 1 | 2, teamA: number, teamB: number) {
		return live.correctSet(setNumber, teamA, teamB);
	}

	async function stopMatch() {
		if (!confirm('Batalkan match ini? Set yang sudah selesai tetap tersimpan di riwayat.'))
			return false;
		return live.abandon();
	}

	async function endSession() {
		if (await live.close()) {
			showEndSession = false;
			invalidatePublicData();
			if (session) await goto(resolve('/session-close/[id]', { id: session.id }));
		}
	}

	function signOut() {
		setCachedClub(null);
		void supabase?.auth.signOut();
	}

	if (browser) {
		void (async () => {
			online = navigator.onLine;
			live.setOnline(online);
			await refreshPublic();
			userEmail = (await currentUser())?.email ?? null;
			if (userEmail) await refreshAccount();
			else {
				live.setAdminAuthorized(false);
				loading = false;
			}
			supabase?.auth.onAuthStateChange(async (_event, authSession) => {
				userEmail = authSession?.user.email ?? null;
				if (userEmail) await refreshAccount();
				else {
					setCachedClub(null);
					club = null;
					roster = [];
					live.setAdminAuthorized(false);
					loading = false;
				}
			});
		})();
	}
</script>

<svelte:window ononline={syncConnection} onoffline={syncConnection} />
<svelte:document onvisibilitychange={refreshWhenVisible} />

<svelte:head
	><title>{displayName} — Courtside</title><meta
		name="theme-color"
		content="#163630"
	/></svelte:head
>

{#snippet headerActions()}
	{#if userEmail}<AppButton class="w-full justify-center" variant="ghost" onclick={signOut}
			>Keluar</AppButton
		>{/if}
{/snippet}

<AppShell current="/live" clubName={displayName} {headerActions}>
	{#if adminLoginOpen}
		<CourtDialog
			open={adminLoginOpen}
			title="Masuk sebagai admin"
			onOpenChange={(open) => (adminLoginOpen = open)}
			onOpenAutoFocus={(event) => event.preventDefault()}
		>
			<form
				class="p-6 text-[#163630]"
				onsubmit={(event) => {
					event.preventDefault();
					void passwordLogin();
				}}
			>
				<h2 class="text-2xl font-black tracking-[-0.04em]">Masuk sebagai admin</h2>
				<p class="mt-2 text-sm leading-6 text-[#527169]">
					Gunakan akun admin klub untuk mengelola sesi.
				</p>
				<label class="mt-5 block text-sm font-bold"
					>Email<input
						class="mt-2 min-h-11 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3 outline-none focus:border-[#38675b] focus:ring-4 focus:ring-[#dceadf]"
						type="email"
						bind:value={email}
						autocomplete="email"
						placeholder="nama@email.com"
					/></label
				><label class="mt-4 block text-sm font-bold"
					>Kata sandi<input
						class="mt-2 min-h-11 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3 outline-none focus:border-[#38675b] focus:ring-4 focus:ring-[#dceadf]"
						type="password"
						bind:value={password}
						autocomplete="current-password"
					/></label
				>
				<div class="mt-6">
					<AppButton class="w-full justify-center" type="submit" disabled={!email || !password}
						>{pending || 'Masuk'}</AppButton
					>
				</div>
			</form>
		</CourtDialog>
	{/if}

	{#if loading}
		{#if session}
			<section
				class="overflow-hidden border border-[#163630] bg-[#163630] text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.17)] sm:p-1"
			>
				<div
					class="flex items-center justify-between border-b border-[#85a097]/55 px-5 py-3 text-[11px] font-black tracking-[0.14em]"
				>
					<span class="text-[#d4e1db]">MALAM INI · MULAI</span>
					<span class="inline-flex items-center gap-2 text-[#f5bb61]">
						<span class="size-2 rounded-full bg-[#f5bb61]"></span>{canManageLive
							? 'ADMIN AKTIF'
							: 'BERLANGSUNG'}
					</span>
				</div>
				<div
					class="relative overflow-hidden px-5 pt-7 pb-5 sm:px-6"
					role="status"
					aria-busy="true"
					aria-label="Memuat kondisi lapangan"
				>
					<div
						aria-hidden="true"
						class="pointer-events-none absolute inset-x-[12%] top-4 bottom-0 border-x border-t border-[#85a097]/25"
					></div>
					<div class="relative">
						<p class="text-xs font-black tracking-[0.16em] text-[#a7c5b9]">LAPANGAN</p>
						<div class={`mt-2 ${activeMatch ? 'max-w-sm' : 'max-w-lg'}`}>
							<LoadingSkeleton height="2.25rem" />
						</div>
						<div class="mt-6 border-y border-[#85a097]/45 py-4">
							<div class="max-w-md"><LoadingSkeleton height="1.5rem" /></div>
						</div>
						<div class="mt-5 flex flex-col items-start gap-2">
							<AppButton disabled
								>{canManageLive ? 'Check in pemain' : 'Masuk sebagai admin'}</AppButton
							>
						</div>
					</div>
				</div>
			</section>
		{:else}
			<section
				class="border border-[#b9c5bb] bg-[#fffaf0] px-6 py-8 shadow-[0_12px_28px_rgba(22,54,48,0.09)]"
				role="status"
				aria-busy="true"
				aria-label="Memeriksa sesi aktif"
			>
				<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">PB NEWBIE / LIVE</p>
				<div class="mt-3 max-w-lg"><LoadingSkeleton height="2.25rem" /></div>
				<div class="mt-3 max-w-sm"><LoadingSkeleton height="1.5rem" /></div>
			</section>
		{/if}
	{:else if userEmail && !club}
		<section class=" bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15">
			<h1 class="mt-3 text-3xl font-black tracking-tight">Buat klubmu.</h1>
			<p class="mt-3 text-sm leading-6 text-slate-300">
				Kamu akan menjadi admin klub. Setelah itu, tambahkan pemain dan mulai sesi pertama.
			</p>
			<label class="mt-6 block text-sm font-bold"
				>Nama klub<input
					class="mt-2 min-h-12 w-full border border-white/15 bg-white/10 px-3 text-white outline-none placeholder:text-slate-400 focus:border-lime-300"
					bind:value={clubName}
					placeholder="PB NEWBIE"
				/></label
			>
			<div class="mt-5">
				<AppButton onclick={createClub} disabled={clubName.trim().length < 2}>Buat klub</AppButton>
			</div>
		</section>
	{:else if tab === 'live'}
		<LiveSessionPanel
			{session}
			{participants}
			{activeMatch}
			canManage={canManageLive}
			{online}
			{pending}
			recentSessions={publicHistory}
			onadminlogin={() => (adminLoginOpen = true)}
			onstartsession={createSession}
			oncheckin={() => (showCheckIn = true)}
			onendsession={() => (showEndSession = true)}
			onselect={(participant) => (selectedParticipant = participant)}
			onstartmatch={beginMatch}
			onpreparenext={prepareNextMatch}
			oncompleteset={saveSet}
			oncorrectset={correctSet}
			onabandonmatch={stopMatch}
			onsubstitute={substitute}
		/>
		{#if canManageLive && publicHistory.some((item) => item.closed_at && item.fee_per_person === null)}
			<section class="mt-5 border-y border-[#b9c5bb] py-5">
				<h2 class="text-xl font-black">Rekap sesi belum dikonfirmasi</h2>
				<p class="mt-1 text-sm leading-5 text-[#527169]">
					Sesi yang belum ditetapkan iurannya bisa dilanjutkan di sini.
				</p>
				<ul class="mt-3 divide-y divide-[#d6ddd5] border-y border-[#b9c5bb]">
					{#each publicHistory.filter((item) => item.closed_at && item.fee_per_person === null) as item (item.id)}
						<li class="flex items-center justify-between gap-3 py-3">
							<span class="min-w-0">
								<b class="block"
									>{new Intl.DateTimeFormat('id-ID', {
										day: 'numeric',
										month: 'long',
										year: 'numeric'
									}).format(new Date(item.started_at))}</b
								>
								<span class="text-xs text-[#527169]"
									>{item.attendance} pemain hadir · iuran belum ditetapkan</span
								>
							</span>
							<a
								class="inline-flex min-h-11 shrink-0 items-center bg-[#163630] px-4 text-sm font-black text-[#fffaf0]"
								href={resolve('/session-close/[id]', { id: item.id })}>Lanjutkan rekap</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{:else if tab === 'players'}
		<section class=" bg-slate-950 p-6 text-white">
			<p class="text-xs font-black tracking-[0.16em] text-lime-300">ROSTER</p>
			<h1 class="mt-2 text-3xl font-black tracking-tight">
				{publicRoster.length ? `${publicRoster.length} pemain terdaftar` : 'Belum ada pemain.'}
			</h1>
			<p class="mt-3 text-sm leading-6 text-slate-300">
				Daftarkan pemain tetap di sini. Pemain tamu bisa ditambahkan langsung dari halaman Live.
			</p>
		</section>
		{#if userEmail && club?.is_club_admin}<section
				class="mt-4 border border-slate-200 bg-white p-4 shadow-sm"
			>
				<label class="block text-sm font-bold"
					>Tambah pemain<input
						class="mt-2 min-h-11 w-full border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
						bind:value={playerName}
						placeholder="Nama pemain"
					/></label
				>
				<div class="mt-4">
					<AppButton onclick={createPlayer} disabled={!playerName.trim()}>Tambah pemain</AppButton>
				</div>
			</section>{/if}
		<section class="mt-4 overflow-hidden border border-slate-200 bg-white shadow-sm">
			<ul class="divide-y divide-slate-100">
				{#each userEmail ? roster : publicRoster as player (player.id)}<li
						class="flex min-h-14 items-center gap-3 px-4 py-3"
					>
						<span
							class="grid size-9 place-items-center bg-lime-200 text-sm font-black text-lime-950"
							>{player.display_name.slice(0, 1)}</span
						><span class="font-bold">{player.display_name}</span>
					</li>{:else}<li class="px-4 py-8 text-center text-sm text-slate-500">
						Belum ada pemain terdaftar.
					</li>{/each}
			</ul>
		</section>
	{:else if tab === 'history'}
		<section class=" bg-slate-950 p-6 text-white">
			<h1 class="text-3xl font-black tracking-tight">Riwayat sesi</h1>
			<p class="mt-3 text-sm leading-6 text-slate-300">
				Sesi yang sudah selesai bisa dilihat semua orang. Rincian pembayaran tiap pemain hanya untuk
				admin.
			</p>
		</section>
		<section class="mt-4 overflow-hidden border border-slate-200 bg-white shadow-sm">
			<ul class="divide-y divide-slate-100">
				{#each publicHistory.filter((item) => item.closed_at) as item (item.id)}<li
						class="flex items-center justify-between gap-4 px-4 py-4"
					>
						<div>
							<p class="font-black">
								{new Intl.DateTimeFormat(undefined, {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								}).format(new Date(item.started_at))}
							</p>
							<p class="mt-1 text-sm text-slate-500">
								{item.attendance} pemain · Iuran {item.fee_per_person
									? `Rp${item.fee_per_person.toLocaleString('id-ID')}`
									: 'belum ditetapkan'}
							</p>
						</div>
						<span class="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800"
							>Selesai</span
						>
					</li>{:else}<li class="px-4 py-8 text-center text-sm text-slate-500">
						Belum ada sesi yang selesai.
					</li>{/each}
			</ul>
		</section>
	{:else}
		<section class=" bg-slate-950 p-6 text-white">
			<h1 class="text-3xl font-black tracking-tight">Dana klub</h1>
			<p class="mt-3 text-sm leading-6 text-slate-300">
				Ringkasan iuran yang tercatat dan pengeluaran yang disetujui. Saldo per pemain hanya
				terlihat oleh admin.
			</p>
			<div class="mt-6 grid grid-cols-3 gap-2 text-center">
				<div>
					<p class="text-xs font-bold text-slate-400">MASUK</p>
					<p class="mt-1 font-black">Rp{(fundSummary?.received ?? 0).toLocaleString('id-ID')}</p>
				</div>
				<div>
					<p class="text-xs font-bold text-slate-400">KELUAR</p>
					<p class="mt-1 font-black">Rp{(fundSummary?.expenses ?? 0).toLocaleString('id-ID')}</p>
				</div>
				<div>
					<p class="text-xs font-bold text-lime-300">SALDO</p>
					<p class="mt-1 font-black text-lime-300">
						Rp{(fundSummary?.balance ?? 0).toLocaleString('id-ID')}
					</p>
				</div>
			</div>
		</section>
	{/if}
</AppShell>

{#if showCheckIn}
	<CheckInSheet
		{roster}
		{checkedInIds}
		{pending}
		oncheckin={checkInPlayers}
		onaddguest={addGuest}
		onclose={() => (showCheckIn = false)}
	/>
{/if}

{#if selectedParticipant}
	<CourtDialog
		open={Boolean(selectedParticipant)}
		title={`${selectedParticipant.name} status`}
		onOpenChange={(open) => !open && (selectedParticipant = null)}
	>
		<div class="p-6 text-[#163630]">
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-xs font-black tracking-[0.15em] text-slate-500">PLAYER STATUS</p>
					<h2 id="player-title" class="mt-1 text-2xl font-black">{selectedParticipant.name}</h2>
					<p class="mt-1 text-sm text-slate-600">
						Status sekarang: {participantStatusLabel[selectedParticipant.status]}. Pilih status
						berikutnya.
					</p>
				</div>
				<button
					class="grid size-11 shrink-0 place-items-center text-xl text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163630]"
					onclick={() => (selectedParticipant = null)}
					aria-label="Close">×</button
				>
			</div>
			<div class="mt-6 grid grid-cols-2 gap-3">
				{#each (['READY', 'RESTING', 'AWAY', 'OUT', 'LEFT'] as ParticipantStatus[]).filter((status) => status !== selectedParticipant?.status) as status (status)}<AppButton
						variant={status === 'OUT' || status === 'LEFT' ? 'danger' : 'secondary'}
						onclick={() => setStatus(status)}
						disabled={Boolean(pending)}
						>{status === 'READY' ? 'Tandai siap' : participantStatusLabel[status]}</AppButton
					>{/each}
			</div>
			{#if selectedParticipant.status === 'READY' || selectedParticipant.status === 'PLAYING'}
				<label
					class="mt-5 flex min-h-12 items-center gap-3 border-t border-[#b9c5bb] pt-4 text-sm font-bold text-[#163630]"
				>
					<input
						type="checkbox"
						checked={selectedParticipant.leaveAfterMatch}
						disabled={Boolean(pending)}
						onchange={(event) =>
							void live.setLeaveAfterMatch(
								selectedParticipant!.sessionParticipantId!,
								(event.currentTarget as HTMLInputElement).checked
							)}
					/>
					Pulang setelah match berikutnya
				</label>
			{/if}
		</div>
	</CourtDialog>
{/if}

{#if showEndSession}
	<CourtDialog
		open={showEndSession}
		title="Malam ini selesai?"
		onOpenChange={(open) => (showEndSession = open)}
	>
		<div class="p-6 text-[#163630]">
			<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">AKHIRI SESI?</p>
			<h2 id="end-session-title" class="mt-2 text-2xl font-black tracking-[-0.04em] text-[#163630]">
				Malam ini selesai?
			</h2>
			<p class="mt-3 text-sm leading-6 text-[#527169]">
				{participants.length} pemain tercatat.
				{#if activeMatch}
					Selesaikan atau batalkan match yang sedang berjalan sebelum mengakhiri sesi.
				{:else}
					Pastikan malam ini benar-benar selesai sebelum ditutup.
				{/if}
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<AppButton variant="secondary" onclick={() => (showEndSession = false)}
					>Lanjut bermain</AppButton
				><AppButton
					variant="danger"
					disabled={Boolean(pending) || Boolean(activeMatch)}
					onclick={endSession}>{pending || 'Akhiri sesi'}</AppButton
				>
			</div>
		</div>
	</CourtDialog>
{/if}
