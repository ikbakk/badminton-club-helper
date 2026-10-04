<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LiveSessionPanel from '$lib/components/live/LiveSessionPanel.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CheckInSheet from '$lib/components/live/CheckInSheet.svelte';
	import CourtSheet from '$lib/components/ui/CourtSheet.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import CourtDialog from '$lib/components/ui/CourtDialog.svelte';
	import { currentUser, signInWithPassword } from '$lib/auth';
	import {
		addPlayer,
		bootstrapClub,
		getClub,
		getPublicClub,
		getPublicFundSummary,
		getPublicRoster,
		getPublicSessionHistory,
		invalidatePublicData,
		prefetchPublicSurface,
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
	import { Ellipsis, History, House, Settings, UsersRound, Wallet } from '@lucide/svelte';

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
	let showSessionMenu = $state(false);
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
			notify('Offline — menampilkan kondisi sesi terakhir yang tersinkron.');
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
			roster = club ? await getRoster(club.id) : [];
			live.setAdminAuthorized(Boolean(club?.is_club_admin));
		} catch (error) {
			notifyError(error, 'Could not load club settings.');
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
		pending = 'Signing in…';
		try {
			await signInWithPassword(email, password);
			adminLoginOpen = false;
			notify('Signed in.');
		} catch (error) {
			notifyError(error, 'Could not sign in.');
		} finally {
			pending = '';
		}
	}

	async function createClub() {
		try {
			await bootstrapClub(clubName);
			clubName = '';
			notify('Club created. Add your first players.');
			await refreshAccount();
		} catch (error) {
			notifyError(error, 'Could not create club.');
		}
	}

	async function createPlayer() {
		if (!club || !playerName.trim()) return;
		try {
			await addPlayer(club.id, playerName);
			playerName = '';
			await refreshAccount();
		} catch (error) {
			notifyError(error, 'Could not add player.');
		}
	}

	async function createSession() {
		if (!club) return;
		try {
			await startSession(club.id);
			notify('Sesi dimulai.');
			await refreshLive();
		} catch (error) {
			notifyError(error, 'Could not start the session.');
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

	async function beginMatch(teamA: string[], teamB: string[]) {
		return live.startMatch(teamA, teamB);
	}

	async function saveSet(teamA: number, teamB: number) {
		return live.completeSet(teamA, teamB);
	}

	async function correctSet(setNumber: 1 | 2, teamA: number, teamB: number) {
		return live.correctSet(setNumber, teamA, teamB);
	}

	async function stopMatch() {
		if (!confirm('Abandon this match? Completed sets remain in history.')) return false;
		return live.abandon();
	}

	async function endSession() {
		if (await live.close()) {
			showEndSession = false;
			showSessionMenu = false;
			invalidatePublicData();
			if (session) await goto(resolve('/session-close/[id]', { id: session.id }));
		}
	}

	function signOut() {
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

<main class="min-h-dvh bg-[#f4f1e8] pb-28 text-[#163630]">
	<div class="mx-auto max-w-2xl px-4 py-5 sm:px-6">
		<header class="mb-5 flex items-center justify-between gap-4 border-b border-[#b9c5bb] pb-4">
			<div class="flex min-w-0 items-center gap-3">
				<span
					class="grid size-11 shrink-0 place-items-center bg-[#163630] text-xl text-[#f5bb61] shadow-[0_6px_14px_rgba(22,54,48,0.18)]"
					>⌁</span
				><span class="min-w-0"
					><span class="block truncate text-lg font-black tracking-tight">{displayName}</span><span
						class="block text-[10px] font-black tracking-[0.17em] text-[#527169]"
						>KLUB BULUTANGKIS</span
					></span
				>
			</div>
			{#if session}
				<div class="flex shrink-0 items-center gap-2">
					{#if canManageLive}<span
							class="inline-flex items-center gap-2 bg-[#e5ece5] px-3 py-2 text-xs font-black text-[#163630]"
							><span class="size-2 rounded-full bg-[#e2653e]"></span>ADMIN AKTIF</span
						>{/if}
					<button
						class="grid size-11 place-items-center border border-[#b9c5bb] bg-[#fffaf0] text-xl text-[#163630]"
						onclick={() => (showSessionMenu = true)}
						aria-label="Menu sesi"><Ellipsis size={21} /></button
					>
				</div>
			{:else if userEmail}<AppButton variant="ghost" onclick={signOut}>Keluar</AppButton>
			{:else}<AppButton variant="secondary" onclick={() => (adminLoginOpen = true)}
					>Kelola</AppButton
				>{/if}
		</header>

		{#if adminLoginOpen}
			<section class="mb-5 border border-slate-200 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs font-black tracking-[0.15em] text-slate-500">AKSES ADMIN</p>
						<h2 class="mt-1 text-xl font-black">Masuk untuk mengelola klub</h2>
					</div>
					<button
						class="text-lg text-slate-400"
						onclick={() => (adminLoginOpen = false)}
						aria-label="Tutup login">×</button
					>
				</div>
				<label class="mt-5 block text-sm font-bold"
					>Email<input
						class="mt-2 min-h-11 w-full border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
						type="email"
						bind:value={email}
						autocomplete="email"
						placeholder="you@example.com"
					/></label
				><label class="mt-4 block text-sm font-bold"
					>Password<input
						class="mt-2 min-h-11 w-full border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
						type="password"
						bind:value={password}
						autocomplete="current-password"
					/></label
				>
				<div class="mt-5">
					<AppButton onclick={passwordLogin} disabled={!email || !password}
						>{pending || 'Masuk'}</AppButton
					>
				</div>
			</section>
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
				<p class="text-xs font-black tracking-[0.16em] text-lime-300">FIRST TIME SETUP</p>
				<h1 class="mt-3 text-3xl font-black tracking-tight">Set up your club.</h1>
				<p class="mt-3 text-sm leading-6 text-slate-300">
					You’ll become Club Admin. Add players next, then start your first session.
				</p>
				<label class="mt-6 block text-sm font-bold"
					>Club name<input
						class="mt-2 min-h-12 w-full border border-white/15 bg-white/10 px-3 text-white outline-none placeholder:text-slate-400 focus:border-lime-300"
						bind:value={clubName}
						placeholder="Friday Shuttle Club"
					/></label
				>
				<div class="mt-5">
					<AppButton onclick={createClub} disabled={clubName.trim().length < 2}
						>Create club</AppButton
					>
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
				onadminlogin={() => (adminLoginOpen = true)}
				oncheckin={() => (showCheckIn = true)}
				onendsession={() => (showEndSession = true)}
				onselect={(participant) => (selectedParticipant = participant)}
				onstartmatch={beginMatch}
				oncompleteset={saveSet}
				oncorrectset={correctSet}
				onabandonmatch={stopMatch}
				onsubstitute={substitute}
			/>
			{#if userEmail && club?.is_club_admin && !session}<section
					class="mt-5 border border-slate-200 bg-white p-5 shadow-sm"
				>
					<p class="text-xs font-black tracking-[0.15em] text-slate-500">CLUB ADMIN</p>
					<h2 class="mt-1 text-xl font-black">Mulai sesi malam ini</h2>
					<p class="mt-2 text-sm leading-6 text-slate-600">
						Sesi dikelola oleh Club Admin yang masuk dengan akun.
					</p>
					<div class="mt-5">
						<AppButton onclick={createSession}>Mulai sesi</AppButton>
					</div>
				</section>{/if}
		{:else if tab === 'players'}
			<section class=" bg-slate-950 p-6 text-white">
				<p class="text-xs font-black tracking-[0.16em] text-lime-300">ROSTER</p>
				<h1 class="mt-2 text-3xl font-black tracking-tight">
					{publicRoster.length ? `${publicRoster.length} club players` : 'The roster is waiting.'}
				</h1>
				<p class="mt-3 text-sm leading-6 text-slate-300">
					Members are permanent club players. Session guests stay on the courtside flow.
				</p>
			</section>
			{#if userEmail && club?.is_club_admin}<section
					class="mt-4 border border-slate-200 bg-white p-4 shadow-sm"
				>
					<label class="block text-sm font-bold"
						>Add a member<input
							class="mt-2 min-h-11 w-full border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
							bind:value={playerName}
							placeholder="Player name"
						/></label
					>
					<div class="mt-4">
						<AppButton onclick={createPlayer} disabled={!playerName.trim()}>Add member</AppButton>
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
							No players have been added yet.
						</li>{/each}
				</ul>
			</section>
		{:else if tab === 'history'}
			<section class=" bg-slate-950 p-6 text-white">
				<h1 class="text-3xl font-black tracking-tight">Session history</h1>
				<p class="mt-3 text-sm leading-6 text-slate-300">
					Closed nights remain visible to everyone. Individual payment details stay private.
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
									{item.attendance} players · Fee {item.fee_per_person
										? `Rp${item.fee_per_person.toLocaleString('id-ID')}`
										: 'not confirmed'}
								</p>
							</div>
							<span class="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800"
								>CLOSED</span
							>
						</li>{:else}<li class="px-4 py-8 text-center text-sm text-slate-500">
							No completed sessions yet.
						</li>{/each}
				</ul>
			</section>
		{:else}
			<section class=" bg-slate-950 p-6 text-white">
				<h1 class="text-3xl font-black tracking-tight">Club fund</h1>
				<p class="mt-3 text-sm leading-6 text-slate-300">
					A public total of recorded payments and approved expenses. Individual balances stay
					private.
				</p>
				<div class="mt-6 grid grid-cols-3 gap-2 text-center">
					<div>
						<p class="text-xs font-bold text-slate-400">RECEIVED</p>
						<p class="mt-1 font-black">Rp{(fundSummary?.received ?? 0).toLocaleString('id-ID')}</p>
					</div>
					<div>
						<p class="text-xs font-bold text-slate-400">EXPENSES</p>
						<p class="mt-1 font-black">Rp{(fundSummary?.expenses ?? 0).toLocaleString('id-ID')}</p>
					</div>
					<div>
						<p class="text-xs font-bold text-lime-300">BALANCE</p>
						<p class="mt-1 font-black text-lime-300">
							Rp{(fundSummary?.balance ?? 0).toLocaleString('id-ID')}
						</p>
					</div>
				</div>
			</section>
		{/if}
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 z-20 border-t border-[#b9c5bb] bg-[#fffaf0]/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
		aria-label="Navigasi utama"
	>
		<div class="mx-auto grid max-w-2xl grid-cols-5 gap-1">
			<a
				href={resolve('/live')}
				data-sveltekit-preload-data="hover"
				aria-current="page"
				class="flex min-h-12 items-center justify-center bg-[#163630] px-1 text-center text-[11px] font-black text-[#fffaf0]"
				><span class="flex flex-col items-center gap-1"><House size={16} /><span>Live</span></span
				></a
			>
			<a
				href={resolve('/players')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/players')}
				onfocus={() => void prefetchPublicSurface('/players')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				><span class="flex flex-col items-center gap-1"
					><UsersRound size={16} /><span>Pemain</span></span
				></a
			>
			<a
				href={resolve('/history')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/history')}
				onfocus={() => void prefetchPublicSurface('/history')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				><span class="flex flex-col items-center gap-1"
					><History size={16} /><span>Riwayat</span></span
				></a
			>
			<a
				href={resolve('/fund')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/fund')}
				onfocus={() => void prefetchPublicSurface('/fund')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				><span class="flex flex-col items-center gap-1"><Wallet size={16} /><span>Dana</span></span
				></a
			>
			<a
				href={resolve('/settings')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/settings')}
				onfocus={() => void prefetchPublicSurface('/settings')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				><span class="flex flex-col items-center gap-1"
					><Settings size={16} /><span>Atur</span></span
				></a
			>
		</div>
	</nav>
</main>

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
						{selectedParticipant.status} · choose the next availability.
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
						>{status === 'READY'
							? 'Mark ready'
							: status[0] + status.slice(1).toLowerCase()}</AppButton
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

{#if showSessionMenu}
	<CourtSheet
		open={showSessionMenu}
		title="Sesi malam ini"
		onOpenChange={(open) => (showSessionMenu = open)}
	>
		<div class="w-full max-w-md p-5">
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-black tracking-[-0.04em] text-[#163630]">Sesi malam ini</h2>
				<button
					class="grid size-11 shrink-0 place-items-center text-xl text-[#527169] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163630]"
					onclick={() => (showSessionMenu = false)}
					aria-label="Tutup">×</button
				>
			</div>
			<div class="mt-5 grid gap-2">
				{#if canManageLive}
					<button
						class="min-h-12 border border-[#b9c5bb] px-4 text-left font-bold text-[#163630]"
						onclick={() => {
							showCheckIn = true;
							showSessionMenu = false;
						}}>Check in pemain</button
					>
				{:else if !userEmail}
					<button
						class="min-h-12 border border-[#b9c5bb] px-4 text-left font-bold text-[#163630]"
						onclick={() => {
							adminLoginOpen = true;
							showSessionMenu = false;
						}}>Masuk sebagai admin</button
					>
				{/if}
				{#if userEmail}
					<button
						class="min-h-12 border border-[#b9c5bb] px-4 text-left font-bold text-[#163630]"
						onclick={() => {
							signOut();
							showSessionMenu = false;
						}}>Keluar dari akun</button
					>
				{/if}
			</div>
		</div>
	</CourtSheet>
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
