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
		isOperator = false,
		pending = '',
		onoperate,
		oncheckin,
		onselect,
		onstartmatch,
		oncompleteset,
		onabandonmatch,
		onsubstitute
	}: {
		session: LiveSession | null;
		participants: Participant[];
		activeMatch: ActiveMatch | null;
		isOperator?: boolean;
		pending?: string;
		onoperate: () => void;
		oncheckin: () => void;
		onselect: (participant: Participant) => void;
		onstartmatch: (teamA: string[], teamB: string[]) => void;
		oncompleteset: (teamA: number, teamB: number) => void;
		onabandonmatch: () => void;
		onsubstitute: (
			outgoingPlayerId: string,
			replacementPlayerId: string,
			outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
		) => void;
	} = $props();

	const groups: { title: string; status: ParticipantStatus }[] = [
		{ title: 'SIAP / MENUNGGU', status: 'READY' },
		{ title: 'ISTIRAHAT', status: 'RESTING' },
		{ title: 'SEMENTARA PERGI', status: 'AWAY' },
		{ title: 'SELESAI MALAM INI', status: 'OUT' }
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
				? 'Belum ada pemain yang check in.'
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
				><span class="size-2 rounded-full bg-[#f5bb61]"></span>{isOperator
					? 'MENGOPERASIKAN'
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
						? `Match ${activeMatch.sequence_number} sedang dimainkan.`
						: 'Lapangan menunggu match pertama.'}
				</h2>
				<div class="mt-6 border-y border-[#85a097]/45 py-4">
					<p class="max-w-md text-sm leading-6 text-[#d4e1db]">{nextAction}</p>
				</div>
				{#if isOperator || ready.length === 0}
					<div class="mt-5">
						{#if isOperator}<AppButton onclick={oncheckin}>Check in pemain</AppButton>
						{:else}<AppButton onclick={onoperate}>Operasikan sesi</AppButton>{/if}
					</div>
				{/if}
			</div>
		</div>
	</section>
	<div class="mt-5">
		<MatchCourt
			{participants}
			{activeMatch}
			{isOperator}
			{pending}
			onstart={onstartmatch}
			oncomplete={oncompleteset}
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
				interactive={isOperator && group.status !== 'OUT'}
				{onselect}
			/>
		{/each}
	</div>
{/if}
