<script lang="ts">
	import Avatar from '$lib/components/ui/Avatar.svelte';
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

	const rowColors: Record<ParticipantStatus, string> = {
		READY: 'bg-[#fffaf0] hover:bg-[#edf2ea]',
		PLAYING: 'bg-[#f0f3ed] hover:bg-[#e5ece5]',
		RESTING: 'bg-[#f4f1e8] hover:bg-[#ece8de]',
		AWAY: 'bg-[#fff1d4] hover:bg-[#fae2ae]',
		OUT: 'bg-[#fbe7e1] hover:bg-[#f7d7cf]',
		LEFT: 'bg-[#eeede8] hover:bg-[#e4e2da]'
	};
	const statusLabels: Record<ParticipantStatus, string> = {
		READY: 'Siap',
		PLAYING: 'Sedang main',
		RESTING: 'Istirahat',
		AWAY: 'Pergi sebentar',
		OUT: 'Selesai bermain malam ini',
		LEFT: 'Sudah pulang'
	};

	function waitLabel(participant: Participant) {
		if (!participant.readySince)
			return participant.leaveAfterMatch
				? 'Pulang setelah match berikutnya'
				: statusLabels[participant.status];
		const minutes = Math.max(
			0,
			Math.floor((Date.now() - participant.readySince.getTime()) / 60_000)
		);
		return participant.leaveAfterMatch
			? `${minutes} menit · pulang setelah match ini`
			: `${minutes} menit menunggu`;
	}

	function setLabel(participant: Participant) {
		return `${participant.setsPlayed} set bermain`;
	}
</script>

{#if participants.length}
	<section class="court-panel participant-group">
		<div class="flex items-center justify-between border-b border-[#b9c5bb] px-4 py-3">
			<h3 class="text-xs font-bold tracking-[0.02em] text-[#38675b]">{title}</h3>
			<span class="px-2.5 py-1 text-xs font-black text-[#163630]">{participants.length}</span>
		</div>
		<ul class="divide-y divide-[#d6ddd5]">
			{#each participants as participant (participant.id)}
				<li>
					{#if interactive}
						<button
							onclick={() => onselect?.(participant)}
							class={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors focus:ring-4 focus:ring-[#f2c6b9] focus:outline-none focus:ring-inset ${rowColors[status]}`}
						>
							<Avatar name={participant.name} /><span class="min-w-0 flex-1"
								><span class="block truncate text-sm font-bold text-[#163630]"
									>{participant.name}</span
								><span class="block text-xs font-medium text-[#527169]"
									>{waitLabel(participant)}</span
								><span class="mt-0.5 block text-xs font-bold text-[#38675b]"
									>{setLabel(participant)}</span
								></span
							>
							<span class="text-[#527169]" aria-hidden="true">›</span>
						</button>
					{:else}
						<div class={`flex min-h-14 items-center gap-3 px-4 py-3 ${rowColors[status]}`}>
							<Avatar name={participant.name} /><span class="min-w-0 flex-1"
								><span class="block truncate text-sm font-bold text-[#163630]"
									>{participant.name}</span
								><span class="block text-xs font-medium text-[#527169]"
									>{waitLabel(participant)}</span
								><span class="mt-0.5 block text-xs font-bold text-[#38675b]"
									>{setLabel(participant)}</span
								></span
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
