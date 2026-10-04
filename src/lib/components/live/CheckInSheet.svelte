<script lang="ts">
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CourtSheet from '$lib/components/ui/CourtSheet.svelte';
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
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
		oncheckin: (playerIds: string[]) => Promise<boolean | void>;
		onaddguest: (name: string) => Promise<void>;
		onclose: () => void;
	} = $props();

	let guestName = $state('');
	let selectedPlayerIds = $state<string[]>([]);
	let absentPlayers = $derived(roster.filter((player) => !checkedInIds.has(player.id)));
	let playerOptions = $derived(
		absentPlayers.map((player) => ({ value: player.id, label: player.display_name }))
	);

	async function checkInSelected() {
		if (!selectedPlayerIds.length) return;
		const succeeded = await oncheckin(selectedPlayerIds);
		if (succeeded !== false) {
			selectedPlayerIds = [];
			onclose();
		}
	}

	async function addGuest() {
		const name = guestName.trim();
		if (!name) return;
		await onaddguest(name);
		guestName = '';
	}
</script>

{#snippet sheetHeader()}
	<div class="border-b border-[#b9c5bb] bg-[#fffaf0] p-5">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-xs font-black tracking-[0.14em] text-[#38675b]">KEDATANGAN</p>
				<h2 id="checkin-title" class="mt-1 text-2xl font-black tracking-[-0.04em] text-[#163630]">
					Check in pemain
				</h2>
			</div>
			<AppButton variant="secondary" onclick={onclose}>Selesai</AppButton>
		</div>
		<p class="mt-3 text-sm text-[#527169]">
			Pilih semua anggota yang datang, lalu check in sekaligus. Semua akan berstatus READY.
		</p>
	</div>
{/snippet}

{#snippet sheetFooter()}
	<div class="border-t border-[#b9c5bb] bg-[#fffaf0] p-4">
		<AppButton
			class="w-full justify-center"
			disabled={!selectedPlayerIds.length || Boolean(pending)}
			onclick={() => void checkInSelected()}
		>
			{pending ||
				(selectedPlayerIds.length
					? `Catat ${selectedPlayerIds.length} pemain hadir`
					: 'Check in pemain')}
		</AppButton>
	</div>
{/snippet}

<CourtSheet
	open
	title="Check in pemain"
	fixedLayout
	header={sheetHeader}
	footer={sheetFooter}
	onOpenChange={(open) => !open && onclose()}
>
	<div class="mx-auto w-full max-w-lg p-5">
		<form
			class="flex gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				void addGuest();
			}}
		>
			<label class="sr-only" for="guest-name">Nama pemain tamu</label><input
				id="guest-name"
				class="min-h-11 min-w-0 flex-1 border border-[#b9c5bb] bg-[#fffaf0] px-3 outline-none focus:border-[#e2653e] focus:ring-4 focus:ring-[#f2c6b9]"
				bind:value={guestName}
				placeholder="Nama tamu"
			/><AppButton type="submit" disabled={!guestName.trim() || Boolean(pending)}
				>Tambah tamu</AppButton
			>
		</form>
		<div class="mt-5 overflow-hidden border border-[#b9c5bb]">
			<p
				class="border-b border-[#b9c5bb] bg-[#e5ece5] px-4 py-3 text-xs font-black tracking-[0.14em] text-[#38675b]"
			>
				{pending || 'BELUM HADIR'}
			</p>
			<MultiSelect
				options={playerOptions}
				selected={selectedPlayerIds}
				onSelectionChange={(value) => (selectedPlayerIds = value)}
				label="Pilih pemain yang datang"
				emptyMessage="Semua anggota sudah datang."
			/>
		</div>
	</div>
</CourtSheet>
