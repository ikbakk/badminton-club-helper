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
		{ title: 'READY / WAITING', status: 'READY' },
		{ title: 'RESTING', status: 'RESTING' },
		{ title: 'AWAY', status: 'AWAY' },
		{ title: 'OUT', status: 'OUT' }
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
			? `${ready.length} waiting for the next match.`
			: ready.length === 0
				? 'No players checked in yet.'
				: ready.length < 4
					? `${ready.length} ready — ${4 - ready.length} more player${4 - ready.length === 1 ? '' : 's'} needed for doubles.`
					: 'Four players are ready for the next match.'
	);
</script>

{#if !session}
	<section class="rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-950/15">
		<p class="text-xs font-black tracking-[0.16em] text-lime-300">COURTSIDE</p>
		<h2 class="mt-3 text-3xl font-black tracking-tight">No session is live right now.</h2>
		<p class="mt-3 max-w-sm text-sm leading-6 text-slate-300">
			Check History for previous sessions, or return when tonight’s badminton starts.
		</p>
	</section>
{:else}
	<section class="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/15 sm:p-6">
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-xs font-black tracking-[0.16em] text-lime-300">TONIGHT</p>
				<h2 class="mt-2 text-2xl font-black tracking-tight">Session is active</h2>
				<p class="mt-1 text-sm text-slate-300">Started {startedAt}</p>
			</div>
			<span
				class="inline-flex items-center gap-2 rounded-full bg-lime-300 px-3 py-2 text-xs font-black text-lime-950"
				><span class="size-2 rounded-full bg-lime-950"></span>LIVE</span
			>
		</div>
		<div class="mt-6 rounded-3xl border border-white/10 bg-white/8 p-4">
			<p class="text-xs font-black tracking-[0.14em] text-slate-400">COURT</p>
			<p class="mt-2 text-lg font-extrabold">
				{activeMatch
					? `Match ${activeMatch.sequence_number} is in play`
					: 'Waiting for the first match'}
			</p>
			<p class="mt-1 text-sm leading-5 text-slate-300">{nextAction}</p>
		</div>
		{#if isOperator}
			<div class="mt-5"><AppButton onclick={oncheckin}>Check in players</AppButton></div>
		{:else}
			<div class="mt-5"><AppButton onclick={onoperate}>Operate this session</AppButton></div>
		{/if}
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
