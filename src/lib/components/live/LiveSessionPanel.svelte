<script lang="ts">
	import { selectedClubId } from '$lib/club-context';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import type { PublicSessionHistory } from '$lib/data/dashboard';
	import type { LiveSession } from '$lib/data/live';
	import type { ActiveMatch } from '$lib/data/live';
	import type { Participant, ParticipantStatus } from '$lib/domain/types';
	import type { PairingOption } from '$lib/domain/rating';
	import MatchCourt from './MatchCourt.svelte';
	import ParticipantGroup from './ParticipantGroup.svelte';

	let {
		session,
		participants,
		activeMatches,
		canManage = false,
		headingLevel = 1,
		authChecking = false,
		online = true,
		pending = '',
		pendingForMatch = () => '',
		suggestedPlayers = [],
		recentSessions = [],
		onadminlogin,
		onstartsession,
		oncheckin,
		onendsession,
		onselect,
		onstartmatch,
		onpreparenext,
		oncompleteset,
		oncorrectset,
		onabandonmatch,
		onsubstitute,
		onstartdecider,
		onskiptiedmatch
	}: {
		session: LiveSession | null;
		participants: Participant[];
		activeMatches: ActiveMatch[];
		canManage?: boolean;
		headingLevel?: 1 | 2;
		authChecking?: boolean;
		online?: boolean;
		pending?: string;
		pendingForMatch?: (matchId: string) => string;
		suggestedPlayers?: string[];
		recentSessions?: PublicSessionHistory[];
		onadminlogin: () => void;
		onstartsession: (courtCount: number) => void;
		oncheckin: () => void;
		onendsession: () => void;
		onselect: (participant: Participant) => void;
		onstartmatch: (
			teamA: string[],
			teamB: string[],
			recommendationId: string | null,
			pairingAudit?: { recommended: PairingOption; options: PairingOption[] },
			courtNumber?: number
		) => Promise<boolean>;
		onpreparenext: () => Promise<{
			id: string;
			recommendation: import('$lib/domain/rotation/types').RotationRecommendation;
		} | null>;
		oncompleteset: (matchId: string, teamA: number, teamB: number) => Promise<boolean>;
		oncorrectset: (
			matchId: string,
			setNumber: 1 | 2 | 3,
			teamA: number,
			teamB: number
		) => Promise<boolean>;
		onabandonmatch: (matchId: string) => void;
		onsubstitute: (
			matchId: string,
			outgoingPlayerId: string,
			replacementPlayerId: string,
			outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
		) => Promise<boolean>;
		onstartdecider: (matchId: string) => Promise<boolean>;
		onskiptiedmatch: (matchId: string) => Promise<boolean>;
	} = $props();
	let courtRail = $state<HTMLDivElement>();
	let visibleCourt = $state(1);
	function selectCourt(court: number) {
		const slide = courtRail?.children[court - 1] as HTMLElement | undefined;
		const first = courtRail?.firstElementChild as HTMLElement | null;
		if (!courtRail || !slide || !first) return;
		visibleCourt = court;
		courtRail.scrollTo({
			left: slide.offsetLeft - first.offsetLeft,
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
		});
	}
	function updateVisibleCourt() {
		if (!courtRail) return;
		const left = courtRail.getBoundingClientRect().left;
		let closest = 0;
		let distance = Infinity;
		Array.from(courtRail.children).forEach((child, index) => {
			const delta = Math.abs(child.getBoundingClientRect().left - left);
			if (delta < distance) {
				distance = delta;
				closest = index;
			}
		});
		visibleCourt = closest + 1;
	}
	let courtCount = $state(1);
	let validCourtCount = $derived(Number.isSafeInteger(courtCount) && courtCount > 0);

	const groups: { title: string; status: ParticipantStatus }[] = [
		{ title: 'SIAP / MENUNGGU', status: 'READY' },
		{ title: 'ISTIRAHAT', status: 'RESTING' },
		{ title: 'PERGI SEBENTAR', status: 'AWAY' },
		{ title: 'SELESAI BERMAIN MALAM INI', status: 'OUT' },
		{ title: 'SUDAH PULANG', status: 'LEFT' }
	];
	let ready = $derived(participants.filter((participant) => participant.status === 'READY'));
	let sessionCourtCount = $derived(Math.max(1, session?.court_count ?? 1));
	let courtNumbers = $derived(Array.from({ length: sessionCourtCount }, (_, index) => index + 1));
	let availableCourtNumbers = $derived(
		courtNumbers.filter(
			(courtNumber) => !activeMatches.some((match) => match.court_number === courtNumber)
		)
	);
	let startedAt = $derived(
		session
			? new Intl.DateTimeFormat('id-ID', { hour: 'numeric', minute: '2-digit' }).format(
					new Date(session.started_at)
				)
			: ''
	);
	let nextAction = $derived(
		availableCourtNumbers.length === 0
			? 'Semua court sedang digunakan. Catat skor ketika reli terakhir selesai.'
			: ready.length === 0
				? 'Belum ada pemain yang datang.'
				: ready.length < 4
					? `${ready.length} siap — butuh ${4 - ready.length} pemain lagi untuk main ganda.`
					: `${availableCourtNumbers.length} court kosong · pemain READY bisa dipilih untuk court mana saja.`
	);
	function matchAtCourt(courtNumber: number) {
		return activeMatches.find((match) => match.court_number === courtNumber) ?? null;
	}
	let recentClosedSessions = $derived(recentSessions.filter((item) => item.closed_at).slice(0, 2));
	const sessionDate = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
</script>

{#if !session}
	<section class="court-panel">
		<div class="grid lg:grid-cols-[1.2fr_0.8fr]">
			<div class="p-6 sm:p-9">
				<h2 class="max-w-[11ch] text-4xl font-black tracking-[-0.04em] text-[#163630] sm:text-5xl">
					Mulai dari daftar hadir.
				</h2>
				<p class="mt-4 max-w-md text-sm leading-6 text-[#527169]">
					Buka sesi ketika pemain pertama datang. Setelah itu, Live berubah menjadi papan lapangan
					yang hanya menunjukkan apa yang perlu dilakukan berikutnya.
				</p>
				{#if canManage && recentSessions.length === 0}
					<section class="mt-5 border-t border-[#b9c5bb] pt-4" aria-label="Panduan sesi pertama">
						<h3 class="text-lg font-black">Sesi pertama klubmu</h3>
						<ol class="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#527169]">
							<li>
								<a
									class="inline-flex min-h-11 items-center font-bold underline"
									href={resolve('/clubs/[clubId]/players', { clubId: selectedClubId() })}
									>Tambahkan pemain tetap</a
								>, atau tambahkan tamu saat check in.
							</li>
							<li>Mulai sesi ketika pemain datang, lalu check in yang sudah hadir.</li>
							<li>Setelah empat pemain READY, siapkan match dan periksa tim sebelum mulai.</li>
						</ol>
					</section>
				{/if}

				{#if canManage}<div class="mt-7 max-w-sm">
						<label class="block text-sm font-bold text-[#163630]" for="session-court-count"
							>Jumlah court</label
						>
						<input
							id="session-court-count"
							class="mt-2 min-h-12 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3 text-lg font-black text-[#163630]"
							type="number"
							min="1"
							step="1"
							bind:value={courtCount}
						/>
						<p class="mt-2 text-xs leading-5 text-[#527169]">
							{#if validCourtCount}
								Sesi dimulai dengan {courtCount} court.
							{:else}
								Masukkan jumlah court berupa bilangan bulat positif.
							{/if}
						</p>
						<AppButton
							class="mt-4"
							disabled={!online || Boolean(pending) || !validCourtCount}
							onclick={() => onstartsession(courtCount)}
							>{pending || 'Mulai sesi malam ini'}</AppButton
						>
					</div>
				{:else if authChecking}<div
						class="mt-7 max-w-[12rem]"
						role="status"
						aria-busy="true"
						aria-label="Memeriksa akses admin"
					>
						<LoadingSkeleton height="2.75rem" />
					</div>{:else}<AppButton class="mt-7" onclick={onadminlogin}>Masuk sebagai admin</AppButton
					>{/if}
			</div>
			<div
				class="grid content-start gap-6 border-t border-[#b9c5bb] bg-[#e5ece5] p-6 sm:p-9 lg:border-t-0 lg:border-l"
			>
				<div>
					<b class="block text-3xl font-black tabular-nums">{recentClosedSessions.length}</b><span
						class="mt-1 block text-xs font-black tracking-[0.1em] text-[#527169]">SESI TERBARU</span
					>
				</div>
				{#if recentClosedSessions.length}<div class="border-t border-[#b9c5bb]">
						{#each recentClosedSessions as recentSession (recentSession.id)}<div
								class="flex justify-between gap-3 border-b border-[#b9c5bb] py-3 text-sm"
							>
								<b>{sessionDate(recentSession.started_at)}</b><span
									class="text-right font-bold text-[#527169]"
									>{recentSession.attendance} pemain</span
								>
							</div>{/each}
					</div>{:else}<p class="border-t border-[#b9c5bb] pt-4 text-sm leading-6 text-[#527169]">
						Belum ada sesi tercatat. Sesi pertama akan menjadi titik awal arsip klub.
					</p>{/if}
			</div>
		</div>
	</section>
{:else}
	<div class="session-heading">
		<div>
			<svelte:element this={headingLevel === 1 ? 'h1' : 'h2'}>Sesi malam ini</svelte:element>
			<p>Mulai {startedAt} · {participants.length} pemain hadir</p>
		</div>
		<span class="live-badge"><span></span>Live</span>
	</div>

	{#if !online}<p
			class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm font-bold text-[#9a3d25]"
		>
			Koneksi terputus. Yang terlihat adalah kondisi terakhir; perubahan belum bisa dilakukan.
		</p>
	{/if}
	{#if sessionCourtCount > 1}
		<nav class="court-navigation" aria-label="Pilih court">
			{#each courtNumbers as number (number)}
				<button
					type="button"
					aria-pressed={visibleCourt === number}
					onclick={() => selectCourt(number)}>Court {number}</button
				>
			{/each}
		</nav>
		<p class="court-swipe-hint">
			Geser untuk melihat {sessionCourtCount} court · satu pool pemain bersama.
		</p>
	{/if}
	<div
		bind:this={courtRail}
		class="court-rail"
		class:multicourt={sessionCourtCount > 1}
		onscroll={updateVisibleCourt}
	>
		{#each courtNumbers as courtNumber (courtNumber)}
			{@const match = matchAtCourt(courtNumber)}
			<section class="court-slide" aria-label={`Papan Court ${courtNumber}`}>
				<MatchCourt
					{participants}
					activeMatch={match}
					{courtNumber}
					{canManage}
					{online}
					pending={match ? pendingForMatch(match.id) : pending}
					onstart={(teamA, teamB, recommendationId, pairingAudit) =>
						onstartmatch(teamA, teamB, recommendationId, pairingAudit, courtNumber)}
					{onpreparenext}
					oncomplete={(teamA, teamB) =>
						match ? oncompleteset(match.id, teamA, teamB) : Promise.resolve(false)}
					oncorrect={(setNumber, teamA, teamB) =>
						match ? oncorrectset(match.id, setNumber, teamA, teamB) : Promise.resolve(false)}
					onabandon={() => match && onabandonmatch(match.id)}
					onsubstitute={(_matchId, outgoingPlayerId, replacementPlayerId, outgoingStatus) =>
						match
							? onsubstitute(match.id, outgoingPlayerId, replacementPlayerId, outgoingStatus)
							: Promise.resolve(false)}
					{onstartdecider}
					{onskiptiedmatch}
				/>
			</section>
		{/each}
	</div>

	<div class="session-tools">
		<p>{nextAction}</p>
		<div>
			{#if canManage}<AppButton variant="secondary" disabled={!online} onclick={oncheckin}
					>Check in pemain</AppButton
				><AppButton variant="ghost" disabled={!online || Boolean(pending)} onclick={onendsession}
					>Akhiri sesi</AppButton
				>
			{:else if authChecking}<div class="w-32" role="status" aria-label="Memeriksa akses admin">
					<LoadingSkeleton height="2.75rem" />
				</div>
			{:else}<AppButton variant="secondary" onclick={onadminlogin}>Masuk sebagai admin</AppButton
				>{/if}
		</div>
	</div>

	{#if canManage && availableCourtNumbers.length > 0 && suggestedPlayers.length === 4}
		<section class="court-panel mt-5 p-5" aria-label="Saran empat pemain">
			<h3 class="text-sm font-bold">Giliran berikutnya</h3>
			<ul class="next-players">
				{#each suggestedPlayers as name, index (index)}<li class="next-player">
						<Avatar {name} /><span>{name}</span>
					</li>{/each}
			</ul>
			<p class="mt-3 text-xs leading-5 text-[#527169]">
				Saran sementara dari pemain READY. Dapat berubah saat status diperbarui; admin tetap memilih
				ketika menyiapkan match.
			</p>
		</section>
	{/if}

	<div class="mt-5 grid gap-4">
		{#each groups as group (group.status)}
			<ParticipantGroup
				title={group.title}
				status={group.status}
				participants={participants.filter((participant) => participant.status === group.status)}
				interactive={canManage && group.status !== 'OUT' && group.status !== 'LEFT'}
				{onselect}
			/>
		{/each}
	</div>
{/if}

<style>
	.court-navigation {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		margin-top: 20px;
	}
	.court-navigation button {
		min-height: 44px;
		flex: 0 0 auto;
		padding: 10px 16px;
		border: 1px solid var(--court-line, #d6ddd3);
		border-radius: var(--court-control-radius);
		font-size: 13px;
		font-weight: 800;
		background: #fffaf0;
		color: #163630;
	}
	.court-navigation button[aria-pressed='true'] {
		background: #163630;
		color: #fffaf0;
		border-color: #163630;
	}
	.court-navigation button:focus-visible {
		outline: 2px solid #a94225;
		outline-offset: 2px;
	}
	.court-swipe-hint {
		margin: 8px 0 12px;
		color: #38675b;
		font-size: 12px;
	}
	.court-rail {
		display: grid;
		gap: 16px;
		margin-top: 20px;
		min-width: 0;
	}
	.court-rail.multicourt {
		display: flex;
		align-items: flex-start;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-color: #38675b #e5ece5;
		scrollbar-width: thin;
		padding-bottom: 12px;
	}
	.court-slide {
		min-width: 0;
	}
	.multicourt .court-slide {
		flex: 0 0 calc(100% - 20px);
		scroll-snap-align: start;
	}
	/* A trailing gutter lets the final court align like the others. */
	.multicourt::after {
		content: '';
		flex: 0 0 4px;
	}
	@media (min-width: 768px) {
		.multicourt .court-slide {
			flex-basis: 85%;
		}
		.multicourt::after {
			flex-basis: calc(15% - 16px);
		}
	}

	.session-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin: 0 0 20px;
	}
	.session-heading :is(h1, h2) {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.03em;
	}
	.session-heading p {
		font-size: 12px;
		color: var(--court-muted);
		margin-top: 6px;
	}
	.live-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: #f7eedb;
		border-radius: 20px;
		font-size: 10px;
		font-weight: 700;
	}
	.live-badge span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ad780c;
	}
	.session-tools {
		margin: 16px 0 24px;
	}
	.session-tools > p {
		font-size: 12px;
		line-height: 1.6;
		color: var(--court-muted);
		margin-bottom: 12px;
	}
	.session-tools > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.next-players {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
		margin-top: 18px;
	}
	.next-player {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-direction: column;
		font-size: 11px;
		font-weight: 600;
		text-align: center;
		overflow-wrap: anywhere;
	}
</style>
