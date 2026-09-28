<script lang="ts">
	import { browser } from '$app/environment';
	import LiveSessionPanel from '$lib/components/live/LiveSessionPanel.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CheckInSheet from '$lib/components/live/CheckInSheet.svelte';
	import { currentUser, signInWithPassword } from '$lib/auth';
	import {
		addPlayer,
		bootstrapClub,
		getClub,
		getPublicClub,
		getPublicRoster,
		getRoster,
		startSession,
		type Club,
		type RosterPlayer
	} from '$lib/data/dashboard';
	import { LiveController } from '$lib/features/live/live-controller.svelte';
	import type { Participant, ParticipantStatus } from '$lib/domain/types';
	import { supabase } from '$lib/supabase';

	type Tab = 'live' | 'players' | 'history' | 'fund';
	const tabs: { id: Tab; label: string; icon: string }[] = [
		{ id: 'live', label: 'Live', icon: '●' },
		{ id: 'players', label: 'Players', icon: '♙' },
		{ id: 'history', label: 'History', icon: '◷' },
		{ id: 'fund', label: 'Fund', icon: '◒' }
	];

	let tab = $state<Tab>('live');
	let email = $state('');
	let password = $state('');
	let userEmail = $state<string | null>(null);
	let club = $state<Club | null>(null);
	let publicClub = $state<{ id: string; name: string } | null>(null);
	let publicRoster = $state<{ id: string; display_name: string }[]>([]);
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
		content="#020617"
	/></svelte:head
>

<main class="min-h-dvh bg-[#f6f8f4] pb-28 text-slate-950">
	<div class="mx-auto max-w-2xl px-4 py-5 sm:px-6">
		<header class="mb-6 flex items-center justify-between gap-4">
			<div class="flex min-w-0 items-center gap-3">
				<span
					class="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-xl text-lime-300 shadow-lg shadow-slate-950/15"
					>⌁</span
				><span class="min-w-0"
					><span class="block truncate text-lg font-black tracking-tight">{displayName}</span><span
						class="block text-[10px] font-black tracking-[0.17em] text-slate-500"
						>BADMINTON CLUB</span
					></span
				>
			</div>
			{#if isOperator}<span
					class="inline-flex shrink-0 items-center gap-2 rounded-full bg-lime-200 px-3 py-2 text-xs font-black text-lime-950"
					><span class="size-2 rounded-full bg-lime-700"></span>OPERATING</span
				>
			{:else if userEmail}<AppButton variant="ghost" onclick={signOut}>Sign out</AppButton>
			{:else}<AppButton variant="secondary" onclick={() => (adminLoginOpen = true)}>Admin</AppButton
				>{/if}
		</header>

		{#if adminLoginOpen}
			<section class="mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
						class="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
						type="email"
						bind:value={email}
						autocomplete="email"
						placeholder="you@example.com"
					/></label
				><label class="mt-4 block text-sm font-bold"
					>Password<input
						class="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
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
				<div class="h-52 animate-pulse rounded-[2rem] bg-slate-200"></div>
				<div class="h-36 animate-pulse rounded-3xl bg-slate-200"></div>
			</div>
		{:else if userEmail && !club}
			<section class="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15">
				<p class="text-xs font-black tracking-[0.16em] text-lime-300">FIRST TIME SETUP</p>
				<h1 class="mt-3 text-3xl font-black tracking-tight">Set up your club.</h1>
				<p class="mt-3 text-sm leading-6 text-slate-300">
					You’ll become Club Admin. Add players next, then start your first session.
				</p>
				<label class="mt-6 block text-sm font-bold"
					>Club name<input
						class="mt-2 min-h-12 w-full rounded-2xl border border-white/15 bg-white/10 px-3 text-white outline-none placeholder:text-slate-400 focus:border-lime-300"
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
					class="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
				>
					<p class="text-xs font-black tracking-[0.15em] text-slate-500">CLUB ADMIN</p>
					<h2 class="mt-1 text-xl font-black">Start tonight’s session</h2>
					<p class="mt-2 text-sm leading-6 text-slate-600">
						The PIN gives one device courtside control. Don’t share it publicly.
					</p>
					<label class="mt-4 block text-sm font-bold"
						>Session PIN<input
							class="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
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
			<section class="rounded-[2rem] bg-slate-950 p-6 text-white">
				<p class="text-xs font-black tracking-[0.16em] text-lime-300">ROSTER</p>
				<h1 class="mt-2 text-3xl font-black tracking-tight">
					{publicRoster.length ? `${publicRoster.length} club players` : 'The roster is waiting.'}
				</h1>
				<p class="mt-3 text-sm leading-6 text-slate-300">
					Members are permanent club players. Session guests stay on the courtside flow.
				</p>
			</section>
			{#if userEmail && club?.is_club_admin}<section
					class="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
				>
					<label class="block text-sm font-bold"
						>Add a member<input
							class="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
							bind:value={playerName}
							placeholder="Player name"
						/></label
					>
					<div class="mt-4">
						<AppButton onclick={createPlayer} disabled={!playerName.trim()}>Add member</AppButton>
					</div>
				</section>{/if}
			<section class="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
				<ul class="divide-y divide-slate-100">
					{#each userEmail ? roster : publicRoster as player (player.id)}<li
							class="flex min-h-14 items-center gap-3 px-4 py-3"
						>
							<span
								class="grid size-9 place-items-center rounded-2xl bg-lime-200 text-sm font-black text-lime-950"
								>{player.display_name.slice(0, 1)}</span
							><span class="font-bold">{player.display_name}</span>
						</li>{:else}<li class="px-4 py-8 text-center text-sm text-slate-500">
							No players have been added yet.
						</li>{/each}
				</ul>
			</section>
		{:else}
			<section class="rounded-[2rem] bg-slate-950 p-6 text-white">
				<p class="text-xs font-black tracking-[0.16em] text-lime-300">
					{tab === 'history' ? 'HISTORY' : 'CLUB FUND'}
				</p>
				<h1 class="mt-2 text-3xl font-black tracking-tight">
					{tab === 'history' ? 'No completed sessions yet.' : 'Nothing to reconcile yet.'}
				</h1>
				<p class="mt-3 text-sm leading-6 text-slate-300">
					{tab === 'history'
						? 'Completed sessions will show attendance, sets, and recaps here.'
						: 'Session fees, payments, and approved expenses will appear here. Individual balances stay private.'}
				</p>
			</section>
		{/if}
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
		aria-label="Main navigation"
	>
		<div class="mx-auto grid max-w-2xl grid-cols-4 gap-1">
			{#each tabs as item (item.id)}<button
					onclick={() => (tab = item.id)}
					class={`flex min-h-12 flex-col items-center justify-center rounded-2xl text-xs font-bold transition ${tab === item.id ? 'bg-slate-950 text-lime-300' : 'text-slate-500 hover:bg-slate-100'}`}
					aria-current={tab === item.id ? 'page' : undefined}
					><span class="text-sm" aria-hidden="true">{item.icon}</span>{item.label}</button
				>{/each}
		</div>
	</nav>
</main>

{#if showOperatorSheet}
	<div
		class="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center"
		role="presentation"
	>
		<section
			class="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"
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
					class="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 px-3 text-center text-lg tracking-[0.35em] outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
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
			class="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"
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
			class="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"
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
		</section>
	</div>
{/if}

{#if notice}<div
		class="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl"
	>
		<span>{notice}</span><button
			class="text-xl text-lime-300"
			onclick={() => (notice = '')}
			aria-label="Dismiss message">×</button
		>
	</div>{/if}
