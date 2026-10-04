<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
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
		onadminlogin,
		oncheckin,
		onendsession,
		onselect,
		onstartmatch,
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
		onadminlogin: () => void;
		oncheckin: () => void;
		onendsession: () => void;
		onselect: (participant: Participant) => void;
		onstartmatch: (teamA: string[], teamB: string[]) => Promise<boolean>;
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
			? `${ready.length} pemain menunggu match berikutnya.`
			: ready.length === 0
				? 'Belum ada pemain yang datang.'
				: ready.length < 4
					? `${ready.length} siap — butuh ${4 - ready.length} pemain lagi untuk main ganda.`
					: 'Empat pemain siap untuk match berikutnya.'
	);
</script>

{#if !session}
	<section
		class="border border-[#b9c5bb] bg-[#fffaf0] px-6 py-8 shadow-[0_12px_28px_rgba(22,54,48,0.09)]"
	>
		<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">PB NEWBIE / LIVE</p>
		<h2 class="mt-3 text-3xl font-black tracking-[-0.04em] text-[#163630]">
			Belum ada sesi yang berjalan.
		</h2>
		<p class="mt-3 max-w-sm text-sm leading-6 text-[#527169]">
			Cek Riwayat untuk sesi sebelumnya, atau kembali saat badminton dimulai.
		</p>
	</section>
{:else}
	<section
		class="overflow-hidden border border-[#163630] bg-[#163630] text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.17)] sm:p-1"
	>
		<div
			class="flex items-center justify-between border-b border-[#85a097]/55 px-5 py-3 text-[11px] font-black tracking-[0.14em]"
		>
			<span>MALAM INI · MULAI {startedAt}</span>
			<span class="inline-flex items-center gap-2 text-[#f5bb61]"
				><span class="size-2 rounded-full bg-[#f5bb61]"></span>{canManage
					? 'ADMIN AKTIF'
					: 'BERLANGSUNG'}</span
			>
		</div>
		<div class="relative overflow-hidden px-5 pt-7 pb-5 sm:px-6">
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-[12%] top-4 bottom-0 border-x border-t border-[#85a097]/25"
			></div>
			<div class="relative">
				<p class="text-xs font-black tracking-[0.16em] text-[#a7c5b9]">LAPANGAN</p>
				<h2 class="mt-2 text-3xl font-black tracking-[-0.055em]">
					{activeMatch
						? `Match ${activeMatch.sequence_number} sedang berlangsung.`
						: 'Lapangan menunggu match pertama.'}
				</h2>
				<div class="mt-6 border-y border-[#85a097]/45 py-4">
					<p class="max-w-md text-sm leading-6 text-[#d4e1db]">{nextAction}</p>
				</div>
				<div class="mt-5 flex flex-wrap items-center gap-3">
					{#if canManage}<AppButton disabled={!online} onclick={oncheckin}
							>Check in pemain</AppButton
						>
					{:else}<AppButton onclick={onadminlogin}>Masuk sebagai admin</AppButton>{/if}
					{#if canManage}<AppButton
							variant="danger"
							disabled={!online || Boolean(pending)}
							onclick={onendsession}>Akhiri sesi</AppButton
						>{:else}<p class="w-full text-xs leading-5 text-[#d4e1db]">
							Masuk sebagai admin klub untuk mencatat pemain hadir dan mengelola match.
						</p>{/if}
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
			oncomplete={oncompleteset}
			oncorrect={oncorrectset}
			onabandon={onabandonmatch}
			{onsubstitute}
		/>
	</div>

	<div class="mt-5 grid gap-4">
		<aside class="px-1 py-1" aria-label="Keterangan warna status pemain">
			<ul class="grid gap-1 text-xs leading-5 text-[#527169]">
				<li class="flex items-center gap-2">
					<span class="size-3 shrink-0 bg-[#dceadf]"></span><b>Hijau:</b> siap / menunggu giliran
				</li>
				<li class="flex items-center gap-2">
					<span class="size-3 shrink-0 bg-[#d9e3f6]"></span><b>Biru:</b> sedang bermain
				</li>
				<li class="flex items-center gap-2">
					<span class="size-3 shrink-0 bg-[#dce8eb]"></span><b>Biru muda:</b> istirahat
				</li>
				<li class="flex items-center gap-2">
					<span class="size-3 shrink-0 bg-[#fae2ae]"></span><b>Kuning:</b> pergi sebentar
				</li>
				<li class="flex items-center gap-2">
					<span class="size-3 shrink-0 bg-[#f7d7cf]"></span><b>Terakota:</b> selesai bermain malam ini
				</li>
				<li class="flex items-center gap-2">
					<span class="size-3 shrink-0 bg-[#e4e2da]"></span><b>Abu-abu:</b> sudah pulang
				</li>
			</ul>
		</aside>
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
