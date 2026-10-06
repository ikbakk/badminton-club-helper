<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import type { PublicSessionHistory } from '$lib/data/dashboard';
	import type { LiveSession } from '$lib/data/live';
	import type { ActiveMatch } from '$lib/data/live';
	import type { Participant, ParticipantStatus } from '$lib/domain/types';
	import MatchCourt from './MatchCourt.svelte';
	import ParticipantGroup from './ParticipantGroup.svelte';

	let {
		session,
		participants,
		activeMatch,
		canManage = false,
		online = true,
		pending = '',
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
		onsubstitute
	}: {
		session: LiveSession | null;
		participants: Participant[];
		activeMatch: ActiveMatch | null;
		canManage?: boolean;
		online?: boolean;
		pending?: string;
		recentSessions?: PublicSessionHistory[];
		onadminlogin: () => void;
		onstartsession: () => void;
		oncheckin: () => void;
		onendsession: () => void;
		onselect: (participant: Participant) => void;
		onstartmatch: (
			teamA: string[],
			teamB: string[],
			recommendationId: string | null
		) => Promise<boolean>;
		onpreparenext: () => Promise<{
			id: string;
			recommendation: import('$lib/domain/rotation/types').RotationRecommendation;
		} | null>;
		oncompleteset: (teamA: number, teamB: number) => Promise<boolean>;
		oncorrectset: (setNumber: 1 | 2, teamA: number, teamB: number) => Promise<boolean>;
		onabandonmatch: () => void;
		onsubstitute: (
			outgoingPlayerId: string,
			replacementPlayerId: string,
			outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
		) => Promise<boolean>;
	} = $props();

	const groups: { title: string; status: ParticipantStatus }[] = [
		{ title: 'SIAP / MENUNGGU', status: 'READY' },
		{ title: 'ISTIRAHAT', status: 'RESTING' },
		{ title: 'PERGI SEBENTAR', status: 'AWAY' },
		{ title: 'SELESAI BERMAIN MALAM INI', status: 'OUT' },
		{ title: 'SUDAH PULANG', status: 'LEFT' }
	];
	let ready = $derived(participants.filter((participant) => participant.status === 'READY'));
	let startedAt = $derived(
		session
			? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
					new Date(session.started_at)
				)
			: ''
	);
	let nextAction = $derived(
		activeMatch
			? 'Catat skor ketika reli terakhir selesai.'
			: ready.length === 0
				? 'Belum ada pemain yang datang.'
				: ready.length < 4
					? `${ready.length} siap — butuh ${4 - ready.length} pemain lagi untuk main ganda.`
					: 'Empat pemain siap untuk match berikutnya.'
	);
	let recentClosedSessions = $derived(recentSessions.filter((item) => item.closed_at).slice(0, 2));
	let currentSet = $derived(activeMatch?.sets.find((set) => set.status === 'IN_PROGRESS') ?? null);
	let completedSets = $derived(activeMatch?.sets.filter((set) => set.status === 'COMPLETED') ?? []);
	let teamA = $derived(
		currentSet?.players.filter((player) => player.team === 'A').map((player) => player.name) ?? []
	);
	let teamB = $derived(
		currentSet?.players.filter((player) => player.team === 'B').map((player) => player.name) ?? []
	);
	let playingCount = $derived(
		participants.filter((participant) => participant.status === 'PLAYING').length
	);
	const sessionDate = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
</script>

{#if !session}
	<section class="border border-[#b9c5bb] bg-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.09)]">
		<div class="grid lg:grid-cols-[1.2fr_0.8fr]">
			<div class="p-6 sm:p-9">
				<h2 class="max-w-[11ch] text-4xl font-black tracking-[-0.04em] text-[#163630] sm:text-5xl">
					Mulai dari daftar hadir.
				</h2>
				<p class="mt-4 max-w-md text-sm leading-6 text-[#527169]">
					Buka sesi ketika pemain pertama datang. Setelah itu, Live berubah menjadi papan lapangan
					yang hanya menunjukkan apa yang perlu dilakukan berikutnya.
				</p>
				{#if canManage}<AppButton class="mt-7" onclick={onstartsession}
						>Mulai sesi malam ini</AppButton
					>
				{:else}<AppButton class="mt-7" onclick={onadminlogin}>Masuk sebagai admin</AppButton>{/if}
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
	<section
		class="relative isolate overflow-visible border border-[#163630] bg-[#163630] text-[#fffaf0] shadow-[0_18px_34px_rgba(22,54,48,0.18)]"
	>
		{#if activeMatch}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute top-8 left-1/2 z-0 -translate-x-1/2 text-[clamp(3.5rem,16vw,9rem)] leading-none font-black tracking-[-0.1em] whitespace-nowrap text-[#85a097]/10"
			>
				MATCH {activeMatch.sequence_number} · SET {currentSet?.setNumber ?? '—'}
			</div>
			<div
				aria-hidden="true"
				class="pointer-events-none absolute -right-[0.12em] -bottom-[0.23em] z-0 max-w-[125%] text-right text-[clamp(3rem,13vw,7rem)] leading-[0.72] font-black tracking-[-0.08em] whitespace-nowrap text-[#85a097]/10"
			>
				{[...teamA, ...teamB].join(' · ')}
			</div>
		{/if}
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-[10%] top-12 bottom-0 border-x border-[#85a097]/15"
		></div>
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-[10%] top-12 border-t border-[#85a097]/15"
		></div>
		<div
			class="relative flex items-center justify-between gap-4 border-b border-[#85a097]/55 px-5 py-3 text-[11px] font-black tracking-[0.14em]"
		>
			<span>MALAM INI · MULAI {startedAt}</span><span
				class="inline-flex items-center gap-2 text-[#f5bb61]"
				><span class="size-2 rounded-full bg-[#f5bb61] shadow-[0_0_0_4px_rgba(245,187,97,0.16)]"
				></span>{canManage ? 'ADMIN AKTIF' : 'BERLANGSUNG'}</span
			>
		</div>
		<div class="relative z-10 px-5 py-8 sm:px-8 sm:py-10">
			{#if activeMatch}
				<h2 class="text-xs font-black tracking-[0.14em] text-[#f5bb61]">
					MATCH {activeMatch.sequence_number} · SET {currentSet?.setNumber ?? '—'} BERLANGSUNG
				</h2>
				<div
					class="mt-12 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center text-2xl leading-[0.96] font-black tracking-[-0.04em] sm:mt-16 sm:text-4xl"
				>
					<div>
						{#each teamA as player (player)}<span class="block">{player}</span>{:else}Tim A{/each}
					</div>
					<span class="text-xs tracking-[0.14em] text-[#f5bb61]">VS</span>
					<div>
						{#each teamB as player (player)}<span class="block">{player}</span>{:else}Tim B{/each}
					</div>
				</div>
				<div class="mt-9 flex flex-wrap justify-center gap-2" aria-label="Riwayat set">
					{#each completedSets as set (set.setNumber)}
						<span
							class="border border-[#85a097]/55 px-3 py-2 text-xs font-black text-[#d4e1db] tabular-nums"
							>SET {set.setNumber} · {set.teamAScore}–{set.teamBScore}</span
						>
					{/each}
					<span
						class="border border-[#f5bb61]/70 bg-[#f5bb61] px-3 py-2 text-xs font-black text-[#163630]"
						>SET {currentSet?.setNumber ?? '—'} · DI LAPANGAN</span
					>
				</div>
			{:else}
				<p class="max-w-md text-xs font-black tracking-[0.14em] text-[#f5bb61]">
					Lapangan siap digunakan.
				</p>
				<h2 class="mt-3 max-w-md text-3xl font-black tracking-[-0.04em]">
					Belum ada peluit pertama.
				</h2>
			{/if}
			<div
				class="mt-10 flex flex-wrap items-end justify-between gap-5 border-t border-[#85a097]/45 pt-5"
			>
				<div>
					<p class="max-w-md text-sm leading-6 text-[#d4e1db]">{nextAction}</p>
					<p class="mt-2 text-xs font-black tracking-[0.1em] text-[#a7c5b9]">
						{playingCount ? `${playingCount} PEMAIN DI LAPANGAN` : 'LAPANGAN KOSONG'} · {ready.length}
						MENUNGGU
					</p>
				</div>
				<div
					class="grid w-full grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-3 sm:w-auto sm:min-w-80"
				>
					{#if canManage}<AppButton disabled={!online} onclick={oncheckin} class="w-full"
							>Check in pemain</AppButton
						>{:else}<AppButton onclick={onadminlogin}>Masuk sebagai admin</AppButton>{/if}
					{#if canManage}<AppButton
							variant="danger"
							class="w-full px-2"
							disabled={!online || Boolean(pending)}
							onclick={onendsession}>Akhiri sesi</AppButton
						>{/if}
				</div>
			</div>
		</div>
	</section>
	{#if !online}<p
			class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm font-bold text-[#9a3d25]"
		>
			Koneksi terputus. Yang terlihat adalah kondisi terakhir; perubahan belum bisa dilakukan.
		</p>
	{/if}
	<div class="mt-5">
		<MatchCourt
			{participants}
			{activeMatch}
			{canManage}
			{online}
			{pending}
			onstart={onstartmatch}
			{onpreparenext}
			oncomplete={oncompleteset}
			oncorrect={oncorrectset}
			onabandon={onabandonmatch}
			{onsubstitute}
		/>
	</div>

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
