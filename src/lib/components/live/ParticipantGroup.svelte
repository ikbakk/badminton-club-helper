<script lang="ts">
	import type { Participant, ParticipantStatus } from '$lib/domain/types';

	let {
		title,
		status,
		participants,
		interactive = false,
		onselect
	}: {
		title: string;
		status: ParticipantStatus;
		participants: Participant[];
		interactive?: boolean;
		onselect?: (participant: Participant) => void;
	} = $props();

	const accents: Record<ParticipantStatus, string> = {
		READY: 'bg-lime-300 text-lime-950',
		PLAYING: 'bg-violet-200 text-violet-950',
		RESTING: 'bg-sky-100 text-sky-800',
		AWAY: 'bg-amber-100 text-amber-800',
		OUT: 'bg-rose-100 text-rose-800',
		LEFT: 'bg-slate-100 text-neutral-700'
	};

	function waitLabel(participant: Participant) {
		if (!participant.readySince)
			return participant.leaveAfterMatch ? 'Leaves after next match' : status;
		const minutes = Math.max(
			0,
			Math.floor((Date.now() - participant.readySince.getTime()) / 60_000)
		);
		return participant.leaveAfterMatch ? `${minutes}m · leaves next` : `${minutes}m waiting`;
	}
</script>

{#if participants.length}
	<section class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
		<div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
			<h3 class="text-xs font-black tracking-[0.16em] text-slate-500">{title}</h3>
			<span class={`rounded-full px-2.5 py-1 text-xs font-black ${accents[status]}`}
				>{participants.length}</span
			>
		</div>
		<ul class="divide-y divide-slate-100">
			{#each participants as participant (participant.id)}
				<li>
					{#if interactive}
						<button
							onclick={() => onselect?.(participant)}
							class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-lime-50 focus:ring-4 focus:ring-lime-200 focus:outline-none focus:ring-inset"
						>
							<span
								class={`grid size-9 place-items-center rounded-2xl text-sm font-black ${accents[status]}`}
								>{participant.name.slice(0, 1)}</span
							>
							<span class="min-w-0 flex-1"
								><span class="block truncate text-sm font-bold text-slate-900"
									>{participant.name}</span
								><span class="block text-xs font-medium text-slate-500"
									>{waitLabel(participant)}</span
								></span
							>
							<span class="text-slate-400" aria-hidden="true">›</span>
						</button>
					{:else}
						<div class="flex min-h-14 items-center gap-3 px-4 py-3">
							<span
								class={`grid size-9 place-items-center rounded-2xl text-sm font-black ${accents[status]}`}
								>{participant.name.slice(0, 1)}</span
							>
							<span class="min-w-0 flex-1"
								><span class="block truncate text-sm font-bold text-slate-900"
									>{participant.name}</span
								><span class="block text-xs font-medium text-slate-500"
									>{waitLabel(participant)}</span
								></span
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
