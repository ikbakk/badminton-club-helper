<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import AnimatedList from '$lib/components/svelte-bits/AnimatedList.svelte';
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

	let stage = $state<'idle' | 'select' | 'teams'>('idle');
	let selected = $state<string[]>([]);
	let scoreA = $state('');
	let scoreB = $state('');
	let setTwoStarted = $state(false);
	let matchMenuOpen = $state(false);
	let substituteStep = $state<0 | 1 | 2 | 3>(0);
	let outgoingPlayerId = $state('');
	let replacementPlayerId = $state('');
	let outgoingStatus = $state<'RESTING' | 'OUT' | 'LEFT'>('RESTING');

	let ready = $derived(participants.filter((player) => player.status === 'READY'));
	let playingSet = $derived(activeMatch?.sets.find((set) => set.status === 'IN_PROGRESS') ?? null);
	let completedSets = $derived(activeMatch?.sets.filter((set) => set.status === 'COMPLETED') ?? []);
	let teamA = $derived(playingSet?.players.filter((player) => player.team === 'A') ?? []);
	let teamB = $derived(playingSet?.players.filter((player) => player.team === 'B') ?? []);
	let selectedPlayers = $derived(
		selected.map((id) => ready.find((player) => player.id === id)).filter(Boolean)
	);
	let betweenSets = $derived(
		playingSet?.setNumber === 2 &&
			completedSets.some((set) => set.setNumber === 1) &&
			!setTwoStarted
	);

	function toggle(playerId: string) {
		selected = selected.includes(playerId)
			? selected.filter((id) => id !== playerId)
			: selected.length < 4
				? [...selected, playerId]
				: selected;
	}

	function continueToTeams() {
		if (selected.length === 4) stage = 'teams';
	}

	function swapPair() {
		if (selected.length !== 4) return;
		selected = [selected[0], selected[3], selected[2], selected[1]];
	}

	function submitScore() {
		const a = Number(scoreA);
		const b = Number(scoreB);
		if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return;
		oncomplete(a, b);
		scoreA = '';
		scoreB = '';
	}

	function resetSubstitution() {
		substituteStep = 0;
		outgoingPlayerId = '';
		replacementPlayerId = '';
		outgoingStatus = 'RESTING';
	}
</script>

{#if activeMatch && playingSet}
	{#key playingSet.setNumber}
		<section
			class="court-score-enter overflow-hidden border border-[#b9c5bb] bg-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.08)]"
		>
			<div
				class="flex items-center justify-between border-b border-[#b9c5bb] bg-[#e5ece5] px-5 py-3"
			>
				<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">
					MATCH {activeMatch.sequence_number}
				</p>
				<button
					class="grid size-9 place-items-center text-xl text-[#38675b]"
					onclick={() => (matchMenuOpen = !matchMenuOpen)}
					aria-label="Menu match">•••</button
				>
			</div>
			{#if matchMenuOpen}
				<div class="border-b border-[#b9c5bb] bg-[#f7f2e8] px-5 py-3">
					<AppButton variant="danger" onclick={onabandon} disabled={Boolean(pending)}
						>Batalkan match</AppButton
					>
				</div>
			{/if}
			<div
				class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[#b9c5bb] px-5 py-6 text-center"
			>
				<div>
					<p class="text-xs font-black tracking-[0.12em] text-[#527169]">TIM A</p>
					<p class="mt-2 text-sm font-extrabold text-[#163630]">
						{teamA.map((player) => player.name).join(' + ')}
					</p>
				</div>
				<span class="text-lg font-black text-[#e2653e]">VS</span>
				<div>
					<p class="text-xs font-black tracking-[0.12em] text-[#527169]">TIM B</p>
					<p class="mt-2 text-sm font-extrabold text-[#163630]">
						{teamB.map((player) => player.name).join(' + ')}
					</p>
				</div>
			</div>
			{#if completedSets.length}
				<div class="flex flex-wrap gap-2 border-b border-[#b9c5bb] px-5 py-4">
					{#each completedSets as set (set.setNumber)}<span
							class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-xs font-bold text-[#163630]"
							>Set {set.setNumber}: {set.teamAScore}–{set.teamBScore}</span
						>{/each}
				</div>
			{/if}
			{#if betweenSets}
				<div class="px-5 py-6">
					<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">SET 1 SELESAI</p>
					<h3 class="mt-2 text-xl font-black tracking-[-0.04em] text-[#163630]">
						Semua lanjut bermain?
					</h3>
					<div class="mt-5 flex flex-wrap gap-3">
						<AppButton onclick={() => (setTwoStarted = true)}>Mulai Set 2</AppButton><AppButton
							variant="secondary"
							onclick={() => (substituteStep = 1)}>Ganti pemain</AppButton
						>
					</div>
				</div>
			{:else if substituteStep > 0}
				<div class="px-5 py-6">
					{#if substituteStep === 1}
						<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">
							PENGGANTIAN · 1 DARI 3
						</p>
						<h3 class="mt-2 text-xl font-black text-[#163630]">Siapa yang berhenti?</h3>
						<div class="mt-4 grid gap-2">
							{#each playingSet.players as player (player.id)}<button
									class={`min-h-12 border px-4 text-left font-bold ${outgoingPlayerId === player.id ? 'border-[#163630] bg-[#163630] text-[#fffaf0]' : 'border-[#b9c5bb] bg-[#fffaf0] text-[#163630]'}`}
									onclick={() => (outgoingPlayerId = player.id)}>{player.name}</button
								>{/each}
						</div>
						<div class="mt-5 flex gap-3">
							<AppButton variant="secondary" onclick={resetSubstitution}>Batal</AppButton><AppButton
								disabled={!outgoingPlayerId}
								onclick={() => (substituteStep = 2)}>Lanjutkan</AppButton
							>
						</div>
					{:else if substituteStep === 2}
						<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">
							PENGGANTIAN · 2 DARI 3
						</p>
						<h3 class="mt-2 text-xl font-black text-[#163630]">Ganti dengan siapa?</h3>
						<div class="mt-4 grid gap-2">
							{#each ready as player (player.id)}<button
									class={`flex min-h-12 items-center justify-between border px-4 text-left font-bold ${replacementPlayerId === player.id ? 'border-[#163630] bg-[#163630] text-[#fffaf0]' : 'border-[#b9c5bb] bg-[#fffaf0] text-[#163630]'}`}
									onclick={() => (replacementPlayerId = player.id)}
									><span>{player.name}</span><span class="text-xs"
										>{player.readySince ? 'menunggu' : ''}</span
									></button
								>{/each}
						</div>
						<div class="mt-5 flex gap-3">
							<AppButton variant="secondary" onclick={() => (substituteStep = 1)}>Kembali</AppButton
							><AppButton disabled={!replacementPlayerId} onclick={() => (substituteStep = 3)}
								>Lanjutkan</AppButton
							>
						</div>
					{:else}
						<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">
							PENGGANTIAN · 3 DARI 3
						</p>
						<h3 class="mt-2 text-xl font-black text-[#163630]">
							{playingSet.players.find((player) => player.id === outgoingPlayerId)?.name} sekarang…
						</h3>
						<div class="mt-4 flex flex-wrap gap-2">
							{#each ['RESTING', 'OUT', 'LEFT'] as status (status)}<button
									class={`px-3 py-2 text-sm font-bold ${outgoingStatus === status ? 'bg-[#163630] text-[#fffaf0]' : 'bg-[#fffaf0] text-[#163630] ring-1 ring-[#b9c5bb]'}`}
									onclick={() => (outgoingStatus = status as 'RESTING' | 'OUT' | 'LEFT')}
									>{status === 'RESTING'
										? 'Istirahat'
										: status === 'OUT'
											? 'Selesai malam ini'
											: 'Pulang'}</button
								>{/each}
						</div>
						<div class="mt-5 flex gap-3">
							<AppButton variant="secondary" onclick={() => (substituteStep = 2)}>Kembali</AppButton
							><AppButton
								disabled={Boolean(pending)}
								onclick={() => {
									onsubstitute(outgoingPlayerId, replacementPlayerId, outgoingStatus);
									resetSubstitution();
									setTwoStarted = true;
								}}>{pending || 'Konfirmasi'}</AppButton
							>
						</div>
					{/if}
				</div>
			{:else if isOperator}
				<div class="px-5 pt-5 pb-5">
					<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">
						SET {playingSet.setNumber}
					</p>
					<div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
						<label class="text-xs font-bold text-[#527169]"
							>Skor Tim A<input
								class="mt-1 min-h-16 w-full border border-[#163630] bg-[#fffaf0] px-3 text-center text-3xl font-black text-[#163630]"
								inputmode="numeric"
								bind:value={scoreA}
							/></label
						><span class="pb-5 font-black text-[#e2653e]">—</span><label
							class="text-xs font-bold text-[#527169]"
							>Skor Tim B<input
								class="mt-1 min-h-16 w-full border border-[#163630] bg-[#fffaf0] px-3 text-center text-3xl font-black text-[#163630]"
								inputmode="numeric"
								bind:value={scoreB}
							/></label
						>
					</div>
					<div class="mt-4">
						<AppButton onclick={submitScore} disabled={Boolean(pending) || !scoreA || !scoreB}
							>{pending || `Selesaikan Set ${playingSet.setNumber}`}</AppButton
						>
					</div>
				</div>
			{/if}
			{#if ready.length}<div class="border-t border-[#b9c5bb] px-5 py-4">
					<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">MENUNGGU</p>
					<p class="mt-2 text-sm font-bold text-[#163630]">
						{ready
							.slice(0, 3)
							.map((player) => player.name)
							.join(' · ')}
					</p>
				</div>{/if}
		</section>
	{/key}
{:else if isOperator && ready.length >= 4}
	<section class="border border-[#b9c5bb] bg-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.08)]">
		<div class="bg-[#e5ece5] p-5">
			<h3 class="text-xl font-black tracking-[-0.04em] text-[#163630]">{ready.length} pemain siap.</h3>
			<p class="mt-2 text-sm text-[#527169]">Siapkan match berikutnya saat lapangan kosong.</p>
			<div class="mt-5"><AppButton onclick={() => (stage = 'select')}>Siapkan match</AppButton></div>
		</div>
	</section>
{/if}

{#if stage !== 'idle'}
	<div class="fixed inset-0 z-40 flex items-end bg-[#163630]/55" role="presentation">
		<div class="w-full border-t-4 border-[#163630] bg-[#fffaf0] shadow-[0_-12px_28px_rgba(22,54,48,0.18)]" role="dialog" aria-modal="true" aria-labelledby="prepare-match-title">
			<div class="mx-auto w-12 border-t-2 border-[#85a097] pt-4"></div>
			{#if stage === 'select'}
				<div class="border-b border-[#b9c5bb] px-5 pb-4"><div class="flex items-center justify-between gap-4"><h3 id="prepare-match-title" class="text-2xl font-black tracking-[-0.04em] text-[#163630]">Pilih 4 pemain</h3><button class="min-h-11 px-3 text-sm font-black text-[#38675b]" onclick={() => (stage = 'idle')}>Tutup</button></div><p class="mt-2 text-sm text-[#527169]">{selected.length} dari 4 pemain dipilih.</p></div>
				<div class="px-5 py-4"><AnimatedList items={ready.map((player) => player.name)} selectedIndices={ready.map((player, index) => selected.includes(player.id) ? index : -1).filter((index) => index >= 0)} onItemSelect={(_item, index) => toggle(ready[index].id)} /></div>
				<div class="flex items-center justify-between border-t border-[#b9c5bb] px-5 py-4"><span class="text-sm font-bold text-[#527169]">{selected.length} / 4 dipilih</span><AppButton disabled={selected.length !== 4} onclick={continueToTeams}>Lanjutkan</AppButton></div>
			{:else}
				<div class="border-b border-[#b9c5bb] px-5 pb-4"><div class="flex items-center justify-between gap-4"><button class="min-h-11 text-sm font-black text-[#38675b]" onclick={() => (stage = 'select')}>‹ Pemain</button><button class="min-h-11 px-3 text-sm font-black text-[#38675b]" onclick={() => (stage = 'idle')}>Tutup</button></div><h3 id="prepare-match-title" class="mt-3 text-2xl font-black tracking-[-0.04em] text-[#163630]">Atur tim</h3></div>
				<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-6 text-center"><div><p class="text-xs font-black tracking-[0.12em] text-[#527169]">TIM A</p><p class="mt-3 whitespace-pre-line text-sm font-extrabold text-[#163630]">{selectedPlayers.slice(0, 2).map((player) => player?.name).join('\n')}</p></div><span class="font-black text-[#e2653e]">VS</span><div><p class="text-xs font-black tracking-[0.12em] text-[#527169]">TIM B</p><p class="mt-3 whitespace-pre-line text-sm font-extrabold text-[#163630]">{selectedPlayers.slice(2).map((player) => player?.name).join('\n')}</p></div></div>
				<div class="flex flex-wrap gap-3 border-t border-[#b9c5bb] px-5 py-4"><AppButton variant="secondary" onclick={swapPair}>Tukar pemain</AppButton><AppButton disabled={Boolean(pending)} onclick={() => { onstart(selected.slice(0, 2), selected.slice(2)); stage = 'idle'; }}>{pending || 'Mulai match'}</AppButton></div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.court-score-enter {
		animation: court-score-enter 360ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes court-score-enter {
		from {
			clip-path: inset(0 50% 0 50%);
			filter: brightness(1.1);
		}
		to {
			clip-path: inset(0 0 0 0);
			filter: brightness(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.court-score-enter {
			animation: none;
		}
	}
</style>
