<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import { ArrowLeft } from '@lucide/svelte';
	import CourtSheet from '$lib/components/ui/CourtSheet.svelte';
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
	import type { ActiveMatch } from '$lib/data/live';
	import type { Participant } from '$lib/domain/types';
	import type { RotationRecommendation } from '$lib/domain/rotation/types';
	import { evaluatePairings, type PairingOption } from '$lib/domain/rating';

	let {
		participants,
		activeMatch,
		canManage = false,
		online = true,
		pending = '',
		onpreparenext,
		onstart,
		oncomplete,
		oncorrect,
		onabandon,
		onsubstitute
	}: {
		participants: Participant[];
		activeMatch: ActiveMatch | null;
		canManage?: boolean;
		online?: boolean;
		pending?: string;
		onpreparenext: () => Promise<{ id: string; recommendation: RotationRecommendation } | null>;
		onstart: (
			teamA: string[],
			teamB: string[],
			recommendationId: string | null,
			pairingAudit?: { recommended: PairingOption; options: PairingOption[] }
		) => Promise<boolean>;
		oncomplete: (a: number, b: number) => Promise<boolean>;
		oncorrect: (setNumber: 1 | 2, a: number, b: number) => Promise<boolean>;
		onabandon: () => void;
		onsubstitute: (
			outgoingPlayerId: string,
			replacementPlayerId: string,
			outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
		) => Promise<boolean>;
	} = $props();

	let stage = $state<'idle' | 'select' | 'teams'>('idle');
	let selected = $state<string[]>([]);
	let recommendation = $state<RotationRecommendation | null>(null);
	let recommendationId = $state<string | null>(null);
	let scoreA = $state('');
	let scoreB = $state('');
	let setTwoStarted = $state(false);
	let substituteStep = $state<0 | 1 | 2 | 3>(0);
	let outgoingPlayerId = $state('');
	let replacementPlayerId = $state('');
	let outgoingStatus = $state<'RESTING' | 'OUT' | 'LEFT'>('RESTING');
	let correctionSet = $state<1 | 2 | null>(null);
	let correctionA = $state('');
	let correctionB = $state('');
	let selectedPairing = $state<PairingOption | null>(null);

	let ready = $derived(participants.filter((player) => player.status === 'READY'));
	let playingSet = $derived(activeMatch?.sets.find((set) => set.status === 'IN_PROGRESS') ?? null);
	let completedSets = $derived(activeMatch?.sets.filter((set) => set.status === 'COMPLETED') ?? []);
	let teamA = $derived(playingSet?.players.filter((player) => player.team === 'A') ?? []);
	let teamB = $derived(playingSet?.players.filter((player) => player.team === 'B') ?? []);
	let selectedPlayers = $derived(
		selected.map((id) => ready.find((player) => player.id === id)).filter(Boolean)
	);
	let pairingStates = $derived(
		selectedPlayers
			.filter((player) => player)
			.map((player) => ({
				id: player!.id,
				rating: player!.rating,
				sigma: player!.uncertainty,
				games: player!.setsPlayed
			}))
	);
	let pairingOptions = $derived(pairingStates.length === 4 ? evaluatePairings(pairingStates) : []);
	let recommendedPairing = $derived(pairingOptions[0] ?? null);
	let recommendedPlayers = $derived(
		recommendation?.selectedPlayerIds
			.map((id) => ready.find((player) => player.id === id))
			.filter((player) => player !== undefined) ?? []
	);
	let selectionMatchesRecommendation = $derived(
		Boolean(
			recommendation &&
			selected.length === 4 &&
			recommendation.selectedPlayerIds.every((id) => selected.includes(id))
		)
	);
	let readyPlayerOptions = $derived(
		ready.map((player) => ({ value: player.id, label: player.name }))
	);
	let betweenSets = $derived(
		playingSet?.setNumber === 2 &&
			completedSets.some((set) => set.setNumber === 1) &&
			!setTwoStarted
	);

	function continueToTeams() {
		if (selected.length === 4) {
			const legalPairings = evaluatePairings(
				selected.map((id) => {
					const player = ready.find((candidate) => candidate.id === id)!;
					return { id, rating: player.rating, sigma: player.uncertainty, games: player.setsPlayed };
				})
			);
			selectedPairing = legalPairings[0] ?? null;
			stage = 'teams';
		}
	}

	async function beginPreparation() {
		selected = [];
		recommendation = null;
		recommendationId = null;
		if (ready.length >= 4 && online) {
			const prepared = await onpreparenext();
			if (prepared) {
				recommendation = prepared.recommendation;
				recommendationId = prepared.id;
				selected = [...prepared.recommendation.selectedPlayerIds];
			}
		}
		stage = 'select';
	}

	function swapPair() {
		if (pairingOptions.length)
			selectedPairing =
				pairingOptions.find((option) => option !== selectedPairing) ?? pairingOptions[0];
	}

	function playerName(id: string) {
		return selectedPlayers.find((player) => player?.id === id)?.name ?? 'Pemain';
	}

	async function submitScore() {
		const a = Number(scoreA);
		const b = Number(scoreB);
		if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return;
		if (await oncomplete(a, b)) {
			scoreA = '';
			scoreB = '';
		}
	}

	function resetSubstitution() {
		substituteStep = 0;
		outgoingPlayerId = '';
		replacementPlayerId = '';
		outgoingStatus = 'RESTING';
	}

	function openCorrection(setNumber: 1 | 2) {
		const set = completedSets.find((item) => item.setNumber === setNumber);
		if (!set) return;
		correctionSet = setNumber;
		correctionA = String(set.teamAScore ?? '');
		correctionB = String(set.teamBScore ?? '');
	}

	async function submitCorrection() {
		if (!correctionSet) return;
		const a = Number(correctionA);
		const b = Number(correctionB);
		if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return;
		if (await oncorrect(correctionSet, a, b)) correctionSet = null;
	}
</script>

{#if activeMatch && playingSet}
	{#key playingSet.setNumber}
		<section
			class="court-score-enter overflow-hidden border border-[#b9c5bb] bg-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.08)]"
		>
			<div class="border-b border-[#b9c5bb] bg-[#163630] px-5 py-4 text-[#fffaf0]">
				<div class="flex items-center justify-between gap-4">
					<h2 class="text-xl font-black tracking-[-0.04em]">Match {activeMatch.sequence_number}</h2>
					<span class="text-xs font-black tracking-[0.12em] text-[#f5bb61]"
						>SET {playingSet.setNumber}</span
					>
				</div>
				<p class="mt-2 text-sm text-[#d4e1db]">
					Hasil set dan pergantian pemain dikendalikan dari sini.
				</p>
			</div>
			{#if correctionSet}
				<div class="border-b border-[#b9c5bb] bg-[#f7f2e8] px-5 py-4">
					<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">
						KOREKSI SET {correctionSet}
					</p>
					<div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
						<label class="text-xs font-bold text-[#527169]"
							>Skor Tim A<input
								class="mt-1 min-h-11 w-full border border-[#163630] bg-[#fffaf0] px-3 text-center text-xl font-black"
								inputmode="numeric"
								bind:value={correctionA}
							/></label
						><span class="pb-3 font-black text-[#e2653e]">—</span><label
							class="text-xs font-bold text-[#527169]"
							>Skor Tim B<input
								class="mt-1 min-h-11 w-full border border-[#163630] bg-[#fffaf0] px-3 text-center text-xl font-black"
								inputmode="numeric"
								bind:value={correctionB}
							/></label
						>
					</div>
					<div class="mt-4 flex flex-wrap gap-3">
						<AppButton variant="secondary" onclick={() => (correctionSet = null)}>Batal</AppButton
						><AppButton
							disabled={Boolean(pending) || !online || !correctionA || !correctionB}
							onclick={submitCorrection}>{pending || 'Simpan koreksi'}</AppButton
						>
					</div>
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
			{#if completedSets.length || canManage}
				<div
					class="flex flex-wrap items-center gap-2 border-b border-[#b9c5bb] bg-[#f7f2e8] px-5 py-3"
				>
					{#each completedSets as set (set.setNumber)}
						{#if canManage}<AppButton
								variant="secondary"
								disabled={Boolean(pending) || !online}
								onclick={() => openCorrection(set.setNumber as 1 | 2)}
								>Koreksi Set {set.setNumber} · {set.teamAScore}–{set.teamBScore}</AppButton
							>{:else}<span
								class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-xs font-bold text-[#163630]"
								>Set {set.setNumber} · {set.teamAScore}–{set.teamBScore}</span
							>{/if}
					{/each}
					{#if canManage}<AppButton
							variant="danger"
							disabled={Boolean(pending) || !online}
							onclick={onabandon}>Batalkan match</AppButton
						>{/if}
				</div>
			{/if}
			{#if betweenSets && substituteStep === 0}
				<div class="px-5 py-6">
					<h3 class="text-2xl font-black tracking-[-0.04em] text-[#163630]">Lanjut ke Set 2</h3>
					<p class="mt-2 text-sm leading-6 text-[#527169]">
						Pilih lanjut dengan susunan yang sama, atau ganti satu pemain sebelum mulai.
					</p>
					<div class="mt-5 grid grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-3">
						<AppButton class="w-full" disabled={!online} onclick={() => (setTwoStarted = true)}
							>Mulai Set 2</AppButton
						>
						<AppButton
							class="w-full px-2"
							variant="secondary"
							disabled={!online}
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
									class={`min-h-11 px-3 py-2 text-sm font-bold ${outgoingStatus === status ? 'bg-[#163630] text-[#fffaf0]' : 'bg-[#fffaf0] text-[#163630] ring-1 ring-[#b9c5bb]'}`}
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
								disabled={Boolean(pending) || !online}
								onclick={async () => {
									if (await onsubstitute(outgoingPlayerId, replacementPlayerId, outgoingStatus)) {
										resetSubstitution();
										setTwoStarted = true;
									}
								}}>{pending || 'Konfirmasi'}</AppButton
							>
						</div>
					{/if}
				</div>
			{:else if canManage}
				<div class="px-5 py-6">
					<h3 class="text-2xl font-black tracking-[-0.04em] text-[#163630]">
						Catat hasil Set {playingSet.setNumber}
					</h3>
					<p class="mt-2 text-sm text-[#527169]">Masukkan skor akhir setelah reli terakhir.</p>
					<div class="mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
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
						<AppButton
							class="w-full"
							onclick={submitScore}
							disabled={Boolean(pending) || !online || !scoreA || !scoreB}
							>{pending || `Selesaikan Set ${playingSet.setNumber}`}</AppButton
						>
					</div>
				</div>
			{/if}
		</section>
	{/key}
{:else if canManage && ready.length >= 4}
	<section class="border border-[#b9c5bb] bg-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.08)]">
		<div class="bg-[#e5ece5] p-5">
			<h3 class="text-xl font-black tracking-[-0.04em] text-[#163630]">
				{ready.length} pemain siap.
			</h3>
			<p class="mt-2 text-sm text-[#527169]">Siapkan match berikutnya saat lapangan kosong.</p>
			<div class="mt-5">
				<AppButton onclick={beginPreparation}>Siapkan match</AppButton>
			</div>
		</div>
	</section>
{/if}

{#if stage !== 'idle'}
	{#snippet prepareHeader()}
		<div class="border-b border-[#b9c5bb] bg-[#fffaf0]">
			<div class="mx-auto w-full max-w-lg px-5 py-4">
				{#if stage === 'select'}
					<h3
						id="prepare-match-title"
						class="text-2xl font-black tracking-[-0.04em] text-[#163630]"
					>
						Pilih 4 pemain
					</h3>
					<p class="mt-2 text-sm text-[#527169]">{selected.length} dari 4 pemain dipilih.</p>
				{:else}
					<button
						class="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#38675b]"
						onclick={() => (stage = 'select')}><ArrowLeft size={18} />Pemain</button
					>
					<h3
						id="prepare-match-title"
						class="mt-3 text-2xl font-black tracking-[-0.04em] text-[#163630]"
					>
						Atur tim
					</h3>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet prepareFooter()}
		<div class="border-t border-[#b9c5bb] bg-[#fffaf0] p-4">
			<div class="mx-auto flex w-full max-w-lg flex-wrap gap-3">
				{#if stage === 'select'}<AppButton
						class="w-full justify-center"
						disabled={selected.length !== 4 || !online || Boolean(pending)}
						onclick={continueToTeams}
						>{selectionMatchesRecommendation
							? 'Lanjutkan dengan rekomendasi'
							: 'Lanjutkan dengan pilihan ini'}</AppButton
					>
				{:else}<AppButton variant="secondary" onclick={swapPair}>Tukar pemain</AppButton><AppButton
						disabled={Boolean(pending)}
						onclick={async () => {
							if (
								selectedPairing &&
								(await onstart(
									selectedPairing.teams[0],
									selectedPairing.teams[1],
									recommendationId,
									recommendedPairing && pairingOptions.length === 3
										? { recommended: recommendedPairing, options: pairingOptions }
										: undefined
								))
							)
								stage = 'idle';
						}}>{pending || 'Mulai match'}</AppButton
					>{/if}
			</div>
		</div>
	{/snippet}

	<CourtSheet
		open={true}
		title="Siapkan match"
		class="prepare-match-sheet"
		fixedLayout
		header={prepareHeader}
		footer={prepareFooter}
		onOpenChange={(open) => {
			if (!open) stage = 'idle';
		}}
	>
		<div class="mx-auto w-full max-w-lg overscroll-contain">
			{#if stage === 'select'}
				<div class="p-5">
					{#if recommendation}
						<section
							class="mb-5 border border-[#9bb0a5] bg-[#e5ece5] p-4"
							aria-label="Rekomendasi pemain Algorithm 1"
						>
							<p class="text-xs font-black tracking-[0.12em] text-[#38675b]">
								REKOMENDASI · KAMU TETAP MEMILIH
							</p>
							<h4 class="mt-1 text-lg font-black text-[#163630]">
								Empat pemain berikut disarankan
							</h4>
							{#if recommendedPlayers.length < 4}
								<p class="mt-2 text-sm font-bold text-[#9a3d25]">
									Status pemain berubah. Pilih pemain READY pengganti sebelum melanjutkan.
								</p>
							{/if}
							<ul class="mt-3 divide-y divide-[#b9c5bb]">
								{#each recommendedPlayers as player (player.id)}
									{@const candidate = recommendation.rankedCandidates.find(
										(item) => item.playerId === player.id
									)}
									<li class="py-2">
										<div class="flex items-center justify-between gap-2">
											<b class="text-sm text-[#163630]">{player.name}</b>
											{#if candidate?.tier === 'SHOULD_PLAY'}
												<span class="bg-[#f5bb61] px-2 py-1 text-[10px] font-black text-[#163630]"
													>SHOULD PLAY</span
												>
											{/if}
										</div>
										<p class="mt-1 text-xs leading-5 text-[#527169]">
											{candidate?.reasons.slice(0, 2).join(' · ') ?? 'Prioritas rotasi berikutnya'}
										</p>
									</li>
								{/each}
							</ul>
							<button
								class="mt-3 min-h-10 text-sm font-black text-[#38675b] underline underline-offset-2"
								onclick={() => (selected = [])}>Pilih empat pemain secara manual</button
							>
						</section>
					{/if}
					<MultiSelect
						options={readyPlayerOptions}
						{selected}
						onSelectionChange={(value) => (selected = value)}
						label="Pilih empat pemain untuk match"
						maxSelected={4}
						emptyMessage="Belum ada pemain berstatus READY."
					/>
				</div>
			{:else if selectedPairing && recommendedPairing}
				<div class="border-b border-[#b9c5bb] bg-[#e5ece5] px-5 py-4">
					<p class="text-xs font-black tracking-[0.12em] text-[#38675b]">REKOMENDASI TIM</p>
					<h4 class="mt-1 text-xl font-black tracking-[-0.04em] text-[#163630]">
						{playerName(recommendedPairing.teams[0][0])} + {playerName(
							recommendedPairing.teams[0][1]
						)}<br />vs<br />{playerName(recommendedPairing.teams[1][0])} + {playerName(
							recommendedPairing.teams[1][1]
						)}
					</h4>
					<p class="mt-2 text-sm text-[#527169]">
						Paling seimbang · selisih kekuatan {recommendedPairing.predictedGap.toFixed(1)}
					</p>
				</div>
				<div class="grid gap-2 p-5">
					{#each pairingOptions as option, index (option.teams.flat().join('-'))}
						<button
							class={`min-h-14 border px-4 py-3 text-left ${selectedPairing === option ? 'border-[#163630] bg-[#163630] text-[#fffaf0]' : 'border-[#b9c5bb] bg-[#fffaf0] text-[#163630]'}`}
							onclick={() => (selectedPairing = option)}
						>
							<b
								>{playerName(option.teams[0][0])} + {playerName(option.teams[0][1])} vs {playerName(
									option.teams[1][0]
								)} + {playerName(option.teams[1][1])}</b
							>
							<span class="ml-2 text-xs"
								>{index === 0
									? 'Paling seimbang'
									: `Selisih ${option.predictedGap.toFixed(1)}`}</span
							>
						</button>
					{/each}
				</div>
			{:else}
				<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-5 text-center">
					<div>
						<p class="text-xs font-black tracking-[0.12em] text-[#527169]">TIM A</p>
						<p class="mt-3 text-sm font-extrabold whitespace-pre-line text-[#163630]">
							{selectedPlayers
								.slice(0, 2)
								.map((player) => player?.name)
								.join('\n')}
						</p>
					</div>
					<span class="font-black text-[#e2653e]">VS</span>
					<div>
						<p class="text-xs font-black tracking-[0.12em] text-[#527169]">TIM B</p>
						<p class="mt-3 text-sm font-extrabold whitespace-pre-line text-[#163630]">
							{selectedPlayers
								.slice(2)
								.map((player) => player?.name)
								.join('\n')}
						</p>
					</div>
				</div>
			{/if}
		</div>
	</CourtSheet>
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
