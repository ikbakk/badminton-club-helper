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
		READY: 'bg-[#dceadf] text-[#163630]',
		PLAYING: 'bg-[#d9e3f6] text-[#243d72]',
		RESTING: 'bg-[#e6edf0] text-[#365963]',
		AWAY: 'bg-[#fae2ae] text-[#73520b]',
		OUT: 'bg-[#f7d7cf] text-[#873d2d]',
		LEFT: 'bg-[#e7e5df] text-[#575951]'
	};

	function waitLabel(participant: Participant) {
		if (!participant.readySince)
			return participant.leaveAfterMatch ? 'Leaves after next match' : status;
		const minutes = Math.max(
			0,
			Math.floor((Date.now() - participant.readySince.getTime()) / 60_000)
		);
		return participant.leaveAfterMatch
			? `${minutes}m · pulang setelah match ini`
			: `${minutes}m menunggu`;
	}
</script>

{#if participants.length}
	<section
		class="overflow-hidden border border-[#b9c5bb] bg-[#fffaf0] shadow-[0_8px_20px_rgba(22,54,48,0.06)]"
	>
		<div class="flex items-center justify-between border-b border-[#b9c5bb] px-4 py-3">
			<h3 class="text-xs font-black tracking-[0.14em] text-[#38675b]">{title}</h3>
			<span class={`px-2.5 py-1 text-xs font-black ${accents[status]}`}>{participants.length}</span>
		</div>
		<ul class="divide-y divide-[#d6ddd5]">
			{#each participants as participant (participant.id)}
				<li>
					{#if interactive}
						<button
							onclick={() => onselect?.(participant)}
							class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#edf3ec] focus:ring-4 focus:ring-[#f2c6b9] focus:outline-none focus:ring-inset"
						>
							<span class={`grid size-9 place-items-center text-sm font-black ${accents[status]}`}
								>{participant.name.slice(0, 1)}</span
							>
							<span class="min-w-0 flex-1"
								><span class="block truncate text-sm font-bold text-[#163630]"
									>{participant.name}</span
								><span class="block text-xs font-medium text-[#527169]"
									>{waitLabel(participant)}</span
								></span
							>
							<span class="text-[#527169]" aria-hidden="true">›</span>
						</button>
					{:else}
						<div class="flex min-h-14 items-center gap-3 px-4 py-3">
							<span class={`grid size-9 place-items-center text-sm font-black ${accents[status]}`}
								>{participant.name.slice(0, 1)}</span
							>
							<span class="min-w-0 flex-1"
								><span class="block truncate text-sm font-bold text-[#163630]"
									>{participant.name}</span
								><span class="block text-xs font-medium text-[#527169]"
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
