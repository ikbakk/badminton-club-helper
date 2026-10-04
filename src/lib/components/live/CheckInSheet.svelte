<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CourtSheet from '$lib/components/ui/CourtSheet.svelte';
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

<CourtSheet open title="Check in pemain" onOpenChange={(open) => !open && onclose()}>
	<div class="max-h-[85dvh] w-full max-w-lg overflow-y-auto p-5">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">KEDATANGAN</p>
				<h2 id="checkin-title" class="mt-1 text-2xl font-black tracking-[-0.04em] text-[#163630]">
					Check in pemain
				</h2>
			</div>
			<AppButton variant="secondary" onclick={onclose}>Done</AppButton>
		</div>
		<p class="mt-3 text-sm text-[#527169]">
			Tap anggota yang datang, atau tambahkan tamu. Semua langsung berstatus READY.
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
				class="min-h-11 min-w-0 flex-1 border border-[#b9c5bb] bg-[#fffaf0] px-3 outline-none focus:border-[#e2653e] focus:ring-4 focus:ring-[#f2c6b9]"
				bind:value={guestName}
				placeholder="Nama tamu"
			/><AppButton disabled={!guestName.trim() || Boolean(pending)}>+ Guest</AppButton>
		</form>
		<div class="mt-5 overflow-hidden border border-[#b9c5bb]">
			<p
				class="border-b border-[#b9c5bb] bg-[#e5ece5] px-4 py-3 text-xs font-black tracking-[0.14em] text-[#38675b]"
			>
				{pending || 'NOT HERE'}
			</p>
			<ul class="divide-y divide-[#d6ddd5]">
				{#each absentPlayers as player (player.id)}<li>
						<button
							class="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-[#edf3ec] disabled:opacity-50"
							onclick={() => oncheckin(player)}
							disabled={Boolean(pending)}
							><span class="grid size-9 place-items-center border-2 border-[#b9c5bb] text-[#527169]"
								>○</span
							><span class="flex-1 font-bold text-[#163630]">{player.display_name}</span><span
								class="text-sm font-bold text-[#b44c30]">Masuk</span
							></button
						>
					</li>{:else}<li class="px-4 py-7 text-center text-sm text-[#527169]">
						Semua anggota sudah datang.
					</li>{/each}
			</ul>
		</div>
	</div>
</CourtSheet>
