<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import type { ActiveMatch } from '$lib/data/live';
	import type { Participant } from '$lib/domain/types';

	let {
		participants,
		activeMatch,
		isOperator = false,
		pending = '',
		onstart,
		oncomplete,
		onabandon,
		onsubstitute
	}: {
		participants: Participant[];
		activeMatch: ActiveMatch | null;
		isOperator?: boolean;
		pending?: string;
		onstart: (teamA: string[], teamB: string[]) => void;
		oncomplete: (a: number, b: number) => void;
		onabandon: () => void;
		onsubstitute: (
			outgoingPlayerId: string,
			replacementPlayerId: string,
			outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
		) => void;
	} = $props();

	let preparing = $state(false);
	let selected = $state<string[]>([]);
	let scoreA = $state('');
	let scoreB = $state('');
	let substituting = $state(false);
	let outgoingPlayerId = $state('');
	let replacementPlayerId = $state('');
	let outgoingStatus = $state<'RESTING' | 'OUT' | 'LEFT'>('RESTING');
	let ready = $derived(participants.filter((player) => player.status === 'READY'));
	let playingSet = $derived(activeMatch?.sets.find((set) => set.status === 'IN_PROGRESS') ?? null);
	let completedSets = $derived(activeMatch?.sets.filter((set) => set.status === 'COMPLETED') ?? []);
	let teamA = $derived(playingSet?.players.filter((player) => player.team === 'A') ?? []);
	let teamB = $derived(playingSet?.players.filter((player) => player.team === 'B') ?? []);
	let canSubstitute = $derived(
		playingSet?.setNumber === 2 && completedSets.some((set) => set.setNumber === 1)
	);

	function toggle(playerId: string) {
		selected = selected.includes(playerId)
			? selected.filter((id) => id !== playerId)
			: selected.length < 4
				? [...selected, playerId]
				: selected;
	}
	function submitScore() {
		const a = Number(scoreA);
		const b = Number(scoreB);
		if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return;
		oncomplete(a, b);
		scoreA = '';
		scoreB = '';
	}
</script>

{#if activeMatch && playingSet}
	<section class="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
		<div class="flex items-center justify-between">
			<p class="text-xs font-black tracking-[0.16em] text-amber-700">
				MATCH {activeMatch.sequence_number}
			</p>
			<span class="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950"
				>SET {playingSet.setNumber}</span
			>
		</div>
		<div class="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
			<div>
				<p class="text-xs font-black text-amber-700">TEAM A</p>
				<p class="mt-1 text-sm font-extrabold text-slate-950">
					{teamA.map((player) => player.name).join(' + ')}
				</p>
			</div>
			<span class="text-lg font-black text-amber-400">VS</span>
			<div>
				<p class="text-xs font-black text-amber-700">TEAM B</p>
				<p class="mt-1 text-sm font-extrabold text-slate-950">
					{teamB.map((player) => player.name).join(' + ')}
				</p>
			</div>
		</div>
		{#if completedSets.length}<div class="mt-4 flex flex-wrap gap-2">
				{#each completedSets as set (set.setNumber)}<span
						class="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700"
						>Set {set.setNumber}: {set.teamAScore}–{set.teamBScore}</span
					>{/each}
			</div>{/if}
		{#if isOperator && canSubstitute}
			<div class="mt-5 rounded-2xl border border-amber-200 bg-white/70 p-4">
				{#if !substituting}
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="font-black">Between-set substitution</p>
							<p class="mt-1 text-sm text-slate-600">Replace one player for Set 2.</p>
						</div>
						<AppButton variant="secondary" onclick={() => (substituting = true)}
							>Substitute player</AppButton
						>
					</div>
				{:else}
					<label class="block text-sm font-bold text-slate-700"
						>Outgoing player<select
							class="mt-1 min-h-11 w-full rounded-xl border border-amber-200 bg-white px-3"
							bind:value={outgoingPlayerId}
							><option value="" disabled>Choose current player</option
							>{#each playingSet.players as player (player.id)}<option value={player.id}
									>{player.name}</option
								>{/each}</select
						></label
					>
					<label class="mt-3 block text-sm font-bold text-slate-700"
						>READY replacement<select
							class="mt-1 min-h-11 w-full rounded-xl border border-amber-200 bg-white px-3"
							bind:value={replacementPlayerId}
							><option value="" disabled>Choose replacement</option
							>{#each ready as player (player.id)}<option value={player.id}>{player.name}</option
								>{/each}</select
						></label
					>
					<fieldset class="mt-3">
						<legend class="text-sm font-bold text-slate-700">Outgoing player becomes</legend>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each ['RESTING', 'OUT', 'LEFT'] as status (status)}<button
									type="button"
									class={`rounded-xl px-3 py-2 text-sm font-bold ${outgoingStatus === status ? 'bg-amber-300 text-amber-950' : 'bg-white text-slate-700 ring-1 ring-amber-200'}`}
									onclick={() => (outgoingStatus = status as 'RESTING' | 'OUT' | 'LEFT')}
									>{status[0] + status.slice(1).toLowerCase()}</button
								>{/each}
						</div>
					</fieldset>
					<div class="mt-4 flex gap-3">
						<AppButton
							variant="secondary"
							onclick={() => {
								substituting = false;
								outgoingPlayerId = '';
								replacementPlayerId = '';
							}}>Cancel</AppButton
						><AppButton
							disabled={!outgoingPlayerId || !replacementPlayerId || Boolean(pending)}
							onclick={() => {
								onsubstitute(outgoingPlayerId, replacementPlayerId, outgoingStatus);
								substituting = false;
								outgoingPlayerId = '';
								replacementPlayerId = '';
							}}>{pending || 'Confirm substitution'}</AppButton
						>
					</div>
				{/if}
			</div>
		{/if}
		{#if isOperator}<div class="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
				<label class="text-xs font-bold text-slate-600"
					>Team A score<input
						class="mt-1 min-h-14 w-full rounded-2xl border border-amber-200 bg-white px-3 text-center text-2xl font-black outline-none focus:ring-4 focus:ring-amber-200"
						inputmode="numeric"
						bind:value={scoreA}
					/></label
				><span class="pb-4 font-black text-amber-400">—</span><label
					class="text-xs font-bold text-slate-600"
					>Team B score<input
						class="mt-1 min-h-14 w-full rounded-2xl border border-amber-200 bg-white px-3 text-center text-2xl font-black outline-none focus:ring-4 focus:ring-amber-200"
						inputmode="numeric"
						bind:value={scoreB}
					/></label
				>
			</div>
			<div class="mt-4 flex flex-wrap gap-3">
				<AppButton onclick={submitScore} disabled={Boolean(pending) || !scoreA || !scoreB}
					>{pending || `Complete Set ${playingSet.setNumber}`}</AppButton
				><AppButton variant="danger" onclick={onabandon} disabled={Boolean(pending)}
					>Abandon match</AppButton
				>
			</div>{/if}
	</section>
{:else if isOperator && ready.length >= 4}
	<section class="rounded-3xl border border-lime-200 bg-lime-50 p-5 shadow-sm">
		<p class="text-xs font-black tracking-[0.16em] text-lime-800">NEXT ACTION</p>
		<h3 class="mt-1 text-xl font-black">Prepare the next match</h3>
		{#if !preparing}<p class="mt-2 text-sm text-slate-600">
				Choose four READY players and start the court.
			</p>
			<div class="mt-4">
				<AppButton onclick={() => (preparing = true)}>Prepare next match</AppButton>
			</div>
		{:else}<p class="mt-2 text-sm text-slate-600">
				Choose exactly four players. The first two are Team A.
			</p>
			<div class="mt-4 grid gap-2">
				{#each ready as player (player.id)}<button
						onclick={() => toggle(player.id)}
						class={`flex min-h-12 items-center justify-between rounded-2xl border px-4 text-left font-bold ${selected.includes(player.id) ? 'border-lime-500 bg-lime-200 text-lime-950' : 'border-lime-100 bg-white text-slate-800'}`}
						><span>{player.name}</span><span>{selected.includes(player.id) ? '✓' : '○'}</span
						></button
					>{/each}
			</div>
			<p class="mt-3 text-sm font-bold text-slate-600">{selected.length} / 4 selected</p>
			<div class="mt-4 flex gap-3">
				<AppButton
					variant="secondary"
					onclick={() => {
						preparing = false;
						selected = [];
					}}>Cancel</AppButton
				><AppButton
					onclick={() => onstart(selected.slice(0, 2), selected.slice(2))}
					disabled={selected.length !== 4 || Boolean(pending)}>{pending || 'Start match'}</AppButton
				>
			</div>{/if}
	</section>
{/if}
