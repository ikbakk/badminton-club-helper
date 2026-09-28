<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import LiveSessionPanel from '$lib/components/live/LiveSessionPanel.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CheckInSheet from '$lib/components/live/CheckInSheet.svelte';
	import CourtLoading from '$lib/components/ui/CourtLoading.svelte';
	import { currentUser, signInWithPassword } from '$lib/auth';
	import {
		addPlayer,
		bootstrapClub,
		getClub,
		getPublicClub,
		getPublicFundSummary,
		getPublicRoster,
		getPublicSessionHistory,
		prefetchPublicSurface,
		getRoster,
		startSession,
		type Club,
		type PublicFundSummary,
		type PublicSessionHistory,
		type RosterPlayer
	} from '$lib/data/dashboard';
	import { LiveController } from '$lib/features/live/live-controller.svelte';
	import type { Participant, ParticipantStatus } from '$lib/domain/types';
	import { supabase } from '$lib/supabase';

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
	let live = new LiveController((message) => (notice = message));
	let session = $derived(live.session);
	let participants = $derived(live.participants);
	let activeMatch = $derived(live.activeMatch);
	let loading = $state(true);
	let notice = $state('');
	let clubName = $state('');
	let playerName = $state('');
	let sessionPin = $state('');
	let adminLoginOpen = $state(false);
	let operatorPin = $state('');
	let showOperatorSheet = $state(false);
	let showTakeover = $state(false);
	let showCheckIn = $state(false);
	let showSessionMenu = $state(false);
	let showEndSession = $state(false);
	let showFeeSheet = $state(false);
	let showRecap = $state(false);
	let fee = $state('15000');
	let selectedParticipant = $state<Participant | null>(null);
	let pending = $derived(live.pending);

	let displayName = $derived(club?.name ?? publicClub?.name ?? 'PB NEWBIE');
	let isOperator = $derived(live.isOperator);
	let checkedInIds = $derived(new Set(participants.map((participant) => participant.id)));

	async function refreshLive() {
		await live.refresh();
	}

	async function refreshAccount() {
		loading = true;
		try {
			club = await getClub();
			roster = club ? await getRoster(club.id) : [];
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Could not load club settings.';
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
			notice = 'Signed in.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Could not sign in.';
		} finally {
			pending = '';
		}
	}

	async function createClub() {
		try {
			await bootstrapClub(clubName);
			clubName = '';
			notice = 'Club created. Add your first players.';
			await refreshAccount();
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Could not create club.';
		}
	}

	async function createPlayer() {
		if (!club || !playerName.trim()) return;
		try {
			await addPlayer(club.id, playerName);
			playerName = '';
			await refreshAccount();
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Could not add player.';
		}
	}

	async function createSession() {
		if (!club) return;
		try {
			await startSession(club.id, sessionPin);
			sessionPin = '';
			notice = 'Session started. Share the PIN only with tonight’s operator.';
			await refreshLive();
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Could not start the session.';
		}
	}

	async function claimOperator(takeover = false) {
		const result = await live.claim(operatorPin, takeover);
		if (result.requiresTakeover) {
			showTakeover = true;
			return;
		}
		if (result.ok) {
			operatorPin = '';
			showOperatorSheet = false;
			showTakeover = false;
		}
	}

	async function checkIn(player: RosterPlayer) {
		await live.checkIn(player.id);
	}

	async function addGuest(name: string) {
		await live.addGuest(name);
	}

	async function substitute(
		outgoingPlayerId: string,
		replacementPlayerId: string,
		outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
	) {
		await live.substitute(outgoingPlayerId, replacementPlayerId, outgoingStatus);
	}

	async function setStatus(status: ParticipantStatus) {
		if (!selectedParticipant?.sessionParticipantId) return;
		if (await live.setStatus(selectedParticipant.sessionParticipantId, status))
			selectedParticipant = null;
	}

	async function beginMatch(teamA: string[], teamB: string[]) {
		await live.startMatch(teamA, teamB);
	}

	async function saveSet(teamA: number, teamB: number) {
		await live.completeSet(teamA, teamB);
	}

	async function stopMatch() {
		if (!confirm('Abandon this match? Completed sets remain in history.')) return;
		await live.abandon();
	}

	async function endSession() {
		if (await live.close()) {
			showEndSession = false;
			showSessionMenu = false;
			showFeeSheet = true;
		}
	}

	async function saveFee() {
		const amount = Number(fee);
		if (Number.isInteger(amount) && amount > 0 && (await live.confirmFee(amount))) {
			showFeeSheet = false;
			showRecap = true;
		}
	}

	async function shareRecap() {
		if (!live.closedSummary || !browser) return;
		const text = `${displayName}\n${live.closedSummary.attendance} pemain · ${live.closedSummary.sets} set\nBiaya Rp${Number(fee).toLocaleString('id-ID')} / orang`;
		if (navigator.share) await navigator.share({ title: `${displayName} — Recap`, text });
		else {
			await navigator.clipboard?.writeText(text);
			notice = 'Ringkasan disalin. Tempelkan ke WhatsApp.';
		}
	}

	function signOut() {
		void supabase?.auth.signOut();
	}

	if (browser) {
		void (async () => {
			await refreshPublic();
			userEmail = (await currentUser())?.email ?? null;
			if (userEmail) await refreshAccount();
			else loading = false;
			supabase?.auth.onAuthStateChange(async (_event, authSession) => {
				userEmail = authSession?.user.email ?? null;
				if (userEmail) await refreshAccount();
				else {
					club = null;
					roster = [];
					loading = false;
				}
			});
		})();
	}
</script>

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
			{#if isOperator}<span
					class="inline-flex shrink-0 items-center gap-2 bg-[#e5ece5] px-3 py-2 text-xs font-black text-[#163630]"
					><span class="size-2 rounded-full bg-[#e2653e]"></span>MENGOPERASIKAN</span
				>
			{:else if session}<button
					class="grid size-11 place-items-center border border-[#b9c5bb] bg-[#fffaf0] text-xl text-[#163630]"
					onclick={() => (showSessionMenu = true)}
					aria-label="Menu sesi">•••</button
				>
			{:else if userEmail}<AppButton variant="ghost" onclick={signOut}>Keluar</AppButton>
			{:else}<AppButton variant="secondary" onclick={() => (adminLoginOpen = true)}
					>Kelola</AppButton
				>{/if}
		</header>

		{#if adminLoginOpen}
			<section class="mb-5 border border-slate-200 bg-white p-5 shadow-sm">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs font-black tracking-[0.15em] text-slate-500">ADMIN ACCESS</p>
						<h2 class="mt-1 text-xl font-black">Sign in to manage the club</h2>
					</div>
					<button
						class="text-lg text-slate-400"
						onclick={() => (adminLoginOpen = false)}
						aria-label="Close sign in">×</button
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
						>{pending || 'Sign in'}</AppButton
					>
				</div>
			</section>
		{/if}

		{#if loading}<div class="grid gap-4">
				<CourtLoading label="Membaca kondisi lapangan…" />
				<CourtLoading label="Menyusun daftar pemain…" compact />
			</div>
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
				{isOperator}
				{pending}
				onoperate={() => (showOperatorSheet = true)}
				oncheckin={() => (showCheckIn = true)}
				onselect={(participant) => (selectedParticipant = participant)}
				onstartmatch={beginMatch}
				oncompleteset={saveSet}
				onabandonmatch={stopMatch}
				onsubstitute={substitute}
			/>
			{#if userEmail && club?.is_club_admin && !session}<section
					class="mt-5 border border-slate-200 bg-white p-5 shadow-sm"
				>
					<p class="text-xs font-black tracking-[0.15em] text-slate-500">CLUB ADMIN</p>
					<h2 class="mt-1 text-xl font-black">Start tonight’s session</h2>
					<p class="mt-2 text-sm leading-6 text-slate-600">
						The PIN gives one device courtside control. Don’t share it publicly.
					</p>
					<label class="mt-4 block text-sm font-bold"
						>Session PIN<input
							class="mt-2 min-h-11 w-full border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
							type="password"
							inputmode="numeric"
							bind:value={sessionPin}
							placeholder="At least 4 characters"
						/></label
					>
					<div class="mt-5">
						<AppButton onclick={createSession} disabled={sessionPin.length < 4}
							>Start session</AppButton
						>
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
				>Live</a
			>
			<a
				href={resolve('/players')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/players')}
				onfocus={() => void prefetchPublicSurface('/players')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				>Pemain</a
			>
			<a
				href={resolve('/history')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/history')}
				onfocus={() => void prefetchPublicSurface('/history')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				>Riwayat</a
			>
			<a
				href={resolve('/fund')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/fund')}
				onfocus={() => void prefetchPublicSurface('/fund')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				>Dana</a
			>
			<a
				href={resolve('/settings')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/settings')}
				onfocus={() => void prefetchPublicSurface('/settings')}
				class="flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black text-[#527169] hover:bg-[#e5ece5]"
				>Atur</a
			>
		</div>
	</nav>
</main>

{#if showOperatorSheet}
	<div
		class="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md bg-white p-6 shadow-2xl"
			role="document"
			aria-labelledby="operator-title"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-black tracking-[0.15em] text-slate-500">COURTSIDE CONTROL</p>
					<h2 id="operator-title" class="mt-1 text-2xl font-black">Operate this session</h2>
				</div>
				<button
					class="text-xl text-slate-400"
					onclick={() => {
						showOperatorSheet = false;
						operatorPin = '';
					}}
					aria-label="Close">×</button
				>
			</div>
			<p class="mt-3 text-sm leading-6 text-slate-600">
				Anyone with the PIN can check players in and manage tonight’s session.
			</p>
			<label class="mt-5 block text-sm font-bold"
				>Enter session PIN<input
					class="mt-2 min-h-12 w-full border border-slate-200 px-3 text-center text-lg tracking-[0.35em] outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
					type="password"
					inputmode="numeric"
					autocomplete="one-time-code"
					bind:value={operatorPin}
				/></label
			>
			<div class="mt-6">
				<AppButton onclick={() => claimOperator()} disabled={!operatorPin || Boolean(pending)}
					>{pending || 'Continue'}</AppButton
				>
			</div>
		</section>
	</div>
{/if}

{#if showTakeover}
	<div
		class="fixed inset-0 z-40 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md bg-white p-6 shadow-2xl"
			role="document"
			aria-labelledby="takeover-title"
		>
			<p class="text-xs font-black tracking-[0.15em] text-amber-600">SESSION IN USE</p>
			<h2 id="takeover-title" class="mt-1 text-2xl font-black">Another device is operating.</h2>
			<p class="mt-3 text-sm leading-6 text-slate-600">
				Taking over will make that device read-only. Are you sure you want to continue?
			</p>
			<div class="mt-6 flex flex-wrap justify-end gap-3">
				<AppButton variant="secondary" onclick={() => (showTakeover = false)}>Cancel</AppButton
				><AppButton variant="danger" onclick={() => claimOperator(true)} disabled={Boolean(pending)}
					>{pending || 'Take over'}</AppButton
				>
			</div>
		</section>
	</div>
{/if}

{#if showCheckIn}
	<CheckInSheet
		{roster}
		{checkedInIds}
		{pending}
		oncheckin={checkIn}
		onaddguest={addGuest}
		onclose={() => (showCheckIn = false)}
	/>
{/if}

{#if selectedParticipant}
	<div
		class="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md bg-white p-6 shadow-2xl"
			role="document"
			aria-labelledby="player-title"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-xs font-black tracking-[0.15em] text-slate-500">PLAYER STATUS</p>
					<h2 id="player-title" class="mt-1 text-2xl font-black">{selectedParticipant.name}</h2>
					<p class="mt-1 text-sm text-slate-600">
						{selectedParticipant.status} · choose the next availability.
					</p>
				</div>
				<button
					class="text-xl text-slate-400"
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
		</section>
	</div>
{/if}

{#if showSessionMenu}
	<div
		class="fixed inset-0 z-30 flex items-end bg-[#163630]/55 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md border border-[#b9c5bb] bg-[#fffaf0] p-5 shadow-2xl"
			role="document"
			aria-label="Menu sesi"
		>
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-black tracking-[-0.04em] text-[#163630]">Sesi malam ini</h2>
				<button
					class="text-xl text-[#527169]"
					onclick={() => (showSessionMenu = false)}
					aria-label="Tutup">×</button
				>
			</div>
			<div class="mt-5 grid gap-2">
				{#if isOperator}<button
						class="min-h-12 border border-[#b9c5bb] px-4 text-left font-bold text-[#163630]"
						onclick={() => {
							showCheckIn = true;
							showSessionMenu = false;
						}}>Check in pemain</button
					><button
						class="min-h-12 border border-[#e7b8aa] bg-[#fff1ec] px-4 text-left font-bold text-[#9a3d25]"
						onclick={() => (showEndSession = true)}>Akhiri sesi</button
					>
				{:else}<button
						class="min-h-12 border border-[#b9c5bb] px-4 text-left font-bold text-[#163630]"
						onclick={() => {
							showOperatorSheet = true;
							showSessionMenu = false;
						}}>Operasikan sesi</button
					>{/if}
				{#if !userEmail}<button
						class="min-h-12 border border-[#b9c5bb] px-4 text-left font-bold text-[#163630]"
						onclick={() => {
							adminLoginOpen = true;
							showSessionMenu = false;
						}}>Masuk sebagai admin</button
					>{/if}
			</div>
		</section>
	</div>
{/if}

{#if showEndSession}
	<div
		class="fixed inset-0 z-40 flex items-end bg-[#163630]/55 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md border border-[#b9c5bb] bg-[#fffaf0] p-6 shadow-2xl"
			role="document"
			aria-labelledby="end-session-title"
		>
			<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">AKHIRI SESI?</p>
			<h2 id="end-session-title" class="mt-2 text-2xl font-black tracking-[-0.04em] text-[#163630]">
				Malam ini selesai?
			</h2>
			<p class="mt-3 text-sm leading-6 text-[#527169]">
				{participants.length} pemain tercatat. Pastikan tidak ada match yang masih berjalan.
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<AppButton variant="secondary" onclick={() => (showEndSession = false)}
					>Lanjut bermain</AppButton
				><AppButton variant="danger" disabled={Boolean(pending)} onclick={endSession}
					>{pending || 'Akhiri sesi'}</AppButton
				>
			</div>
		</section>
	</div>
{/if}

{#if showFeeSheet && live.closedSummary}
	<div
		class="fixed inset-0 z-40 flex items-end bg-[#163630]/55 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md border border-[#b9c5bb] bg-[#fffaf0] p-6 shadow-2xl"
			role="document"
			aria-labelledby="fee-title"
		>
			<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">SESI SELESAI</p>
			<h2 id="fee-title" class="mt-2 text-2xl font-black tracking-[-0.04em] text-[#163630]">
				Biaya hari ini
			</h2>
			<p class="mt-3 text-sm text-[#527169]">
				{live.closedSummary.attendance} pemain · {live.closedSummary.sets} set
			</p>
			<label class="mt-6 block text-sm font-bold text-[#163630]"
				>Biaya per orang<input
					class="mt-2 min-h-14 w-full border border-[#163630] bg-[#fffaf0] px-4 text-xl font-black"
					inputmode="numeric"
					bind:value={fee}
				/></label
			>
			<p class="mt-3 text-sm font-bold text-[#527169]">
				Perkiraan Rp{(Number(fee || 0) * live.closedSummary.attendance).toLocaleString('id-ID')}
			</p>
			<div class="mt-6">
				<AppButton disabled={Boolean(pending) || Number(fee) <= 0} onclick={saveFee}
					>{pending || 'Konfirmasi biaya'}</AppButton
				>
			</div>
		</section>
	</div>
{/if}

{#if showRecap && live.closedSummary}
	<div
		class="fixed inset-0 z-40 flex items-end bg-[#163630]/55 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md border border-[#b9c5bb] bg-[#163630] p-6 text-[#fffaf0] shadow-2xl"
			role="document"
			aria-labelledby="recap-title"
		>
			<p class="text-xs font-black tracking-[0.14em] text-[#a7c5b9]">PB NEWBIE</p>
			<h2 id="recap-title" class="mt-2 text-3xl font-black tracking-[-0.05em]">Sesi selesai.</h2>
			<div class="mt-6 grid grid-cols-2 gap-px bg-[#85a097]/45">
				<p class="bg-[#163630] p-4 text-sm">
					<b class="block text-2xl">{live.closedSummary.attendance}</b>pemain
				</p>
				<p class="bg-[#163630] p-4 text-sm">
					<b class="block text-2xl">{live.closedSummary.sets}</b>set
				</p>
			</div>
			<p class="mt-5 text-sm text-[#d4e1db]">
				Biaya Rp{Number(fee).toLocaleString('id-ID')} / orang
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<AppButton onclick={() => (showRecap = false)}>Lihat Live</AppButton><AppButton
					variant="secondary"
					onclick={shareRecap}>Bagikan WhatsApp</AppButton
				>
			</div>
		</section>
	</div>
{/if}

{#if notice}<div
		class="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl"
	>
		<span>{notice}</span><button
			class="text-xl text-lime-300"
			onclick={() => (notice = '')}
			aria-label="Dismiss message">×</button
		>
	</div>{/if}
