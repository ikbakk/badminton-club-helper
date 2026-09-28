<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import type { RosterPlayer } from '$lib/data/dashboard';

	let {
		roster,
		checkedInIds,
		pending = '',
		oncheckin,
		onaddguest,
		onclose
	}: {
		roster: RosterPlayer[];
		checkedInIds: Set<string>;
		pending?: string;
		oncheckin: (player: RosterPlayer) => void;
		onaddguest: (name: string) => Promise<void>;
		onclose: () => void;
	} = $props();

	let guestName = $state('');
	let absentPlayers = $derived(roster.filter((player) => !checkedInIds.has(player.id)));

	async function addGuest() {
		const name = guestName.trim();
		if (!name) return;
		await onaddguest(name);
		guestName = '';
	}
</script>

<div
	class="fixed inset-0 z-30 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center"
	role="presentation"
>
	<dialog
		open
		class="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl"
		aria-labelledby="checkin-title"
	>
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-xs font-black tracking-[0.15em] text-slate-500">ARRIVALS</p>
				<h2 id="checkin-title" class="mt-1 text-2xl font-black">Check in players</h2>
			</div>
			<AppButton variant="secondary" onclick={onclose}>Done</AppButton>
		</div>
		<p class="mt-3 text-sm text-slate-600">
			Tap a member as they arrive, or add a guest. Everyone checks in as READY.
		</p>
		<form
			class="mt-4 flex gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				void addGuest();
			}}
		>
			<label class="sr-only" for="guest-name">Guest name</label><input
				id="guest-name"
				class="min-h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-500 focus:ring-4 focus:ring-lime-100"
				bind:value={guestName}
				placeholder="Guest name"
			/><AppButton disabled={!guestName.trim() || Boolean(pending)}>+ Guest</AppButton>
		</form>
		<div class="mt-5 overflow-hidden rounded-3xl border border-slate-200">
			<p
				class="border-b border-slate-100 px-4 py-3 text-xs font-black tracking-[0.15em] text-slate-500"
			>
				{pending || 'NOT HERE'}
			</p>
			<ul class="divide-y divide-slate-100">
				{#each absentPlayers as player (player.id)}<li>
						<button
							class="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-lime-50 disabled:opacity-50"
							onclick={() => oncheckin(player)}
							disabled={Boolean(pending)}
							><span
								class="grid size-9 place-items-center rounded-2xl border-2 border-slate-200 text-slate-400"
								>○</span
							><span class="flex-1 font-bold">{player.display_name}</span><span
								class="text-sm font-bold text-lime-700">Check in</span
							></button
						>
					</li>{:else}<li class="px-4 py-7 text-center text-sm text-slate-500">
						Everyone on the roster is here.
					</li>{/each}
			</ul>
		</div>
	</dialog>
</div>
