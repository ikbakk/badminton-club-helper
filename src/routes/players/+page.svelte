<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import { currentUser } from '$lib/auth';
	import {
		addPlayer,
		getClub,
		getPublicClub,
		getPublicRoster,
		getRoster,
		invalidatePublicData,
		prefetchPublicPlayer,
		promoteGuestToMember,
		type Club
	} from '$lib/data/dashboard';

	let club = $state<Club | null>(null);
	let publicClub = $state<{ id: string; name: string } | null>(null);
	let roster = $state<{ id: string; display_name: string; membership_type: 'MEMBER' | 'GUEST' }[]>(
		[]
	);
	let signedIn = $state(false);
	let name = $state('');
	let loading = $state(true);
	let notice = $state('');
	let displayName = $derived(club?.name ?? publicClub?.name ?? 'PB NEWBIE');

	async function load() {
		try {
			publicClub = await getPublicClub();
			club = await getClub();
			signedIn = Boolean(await currentUser());
			roster = club
				? await getRoster(club.id)
				: publicClub
					? await getPublicRoster(publicClub.id)
					: [];
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Roster belum dapat dimuat.';
		} finally {
			loading = false;
		}
	}
	async function createPlayer() {
		if (!club || !name.trim()) return;
		try {
			await addPlayer(club.id, name);
			invalidatePublicData();
			name = '';
			await load();
			notice = 'Member ditambahkan.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Member belum dapat ditambahkan.';
		}
	}
	async function promoteGuest(playerId: string) {
		if (!club || !confirm('Jadikan tamu ini member klub? Riwayatnya tetap tersimpan.')) return;
		try {
			await promoteGuestToMember(club.id, playerId);
			invalidatePublicData();
			await load();
			notice = 'Tamu dipromosikan menjadi member.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Tamu belum dapat dipromosikan.';
		}
	}
	if (browser) void load();
</script>

<svelte:head><title>Pemain — PB NEWBIE</title></svelte:head>
<AppShell current="/players" clubName={displayName}>
	<section class="border-b border-[#b9c5bb] pb-5">
		<div class="flex items-end justify-between gap-4">
			<div>
				<h1 class="text-3xl font-black tracking-[-0.05em]">Pemain</h1>
				<p class="mt-2 text-sm leading-6 text-[#527169]">
					Anggota klub yang bisa ikut sesi malam ini.
				</p>
			</div>
			{#if loading}<span class="w-18 shrink-0"><LoadingSkeleton height="1rem" /></span>
			{:else}<p class="shrink-0 text-sm font-black text-[#38675b]">{roster.length} member</p>{/if}
		</div>
	</section>
	{#if club?.is_club_admin}
		<section class="mt-5 border border-[#b9c5bb] bg-[#e5ece5] p-5">
			<h2 class="text-lg font-black">Tambah member</h2>
			<div class="mt-4 flex gap-3">
				<input
					class="min-h-11 min-w-0 flex-1 border border-[#b9c5bb] bg-[#fffaf0] px-3 font-bold"
					bind:value={name}
					placeholder="Nama pemain"
				/><AppButton disabled={!name.trim()} onclick={createPlayer}>Tambah</AppButton>
			</div>
		</section>
	{/if}
	<section class="mt-5 border border-[#b9c5bb] bg-[#fffaf0]">
		{#if loading}<div
				class="divide-y divide-[#b9c5bb]"
				role="status"
				aria-busy="true"
				aria-label="Membaca roster"
			>
				{#each [1, 2, 3, 4] as row (row)}<div class="flex min-h-16 items-center px-5 py-3">
						<div class="w-full space-y-2">
							<div class="w-2/5"><LoadingSkeleton /></div>
							<div class="w-1/4"><LoadingSkeleton height="0.75rem" /></div>
						</div>
					</div>{/each}
			</div>
			<span class="sr-only">Membaca roster…</span>
		{:else if roster.length}<ul>
				{#each roster as player (player.id)}<li class="border-b border-[#b9c5bb] last:border-b-0">
						<a
							class="flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-[#e5ece5]"
							href={resolve('/players/[id]', { id: player.id })}
							data-sveltekit-preload-data="hover"
							onmouseenter={() => void prefetchPublicPlayer(player.id)}
							onfocus={() => void prefetchPublicPlayer(player.id)}
							><span
								><b class="block text-base">{player.display_name}</b><span
									class="mt-1 block text-sm text-[#527169]"
									>{player.membership_type === 'MEMBER' ? 'Member klub' : 'Tamu'}</span
								></span
							><span class="text-lg text-[#38675b]" aria-hidden="true">›</span></a
						>
						{#if club?.is_club_admin && player.membership_type === 'GUEST'}<button
								class="mb-3 ml-5 min-h-9 border border-[#b9c5bb] px-3 text-xs font-black text-[#38675b]"
								onclick={() => void promoteGuest(player.id)}>Jadikan member</button
							>{/if}
					</li>{/each}
			</ul>
		{:else}<div class="p-7">
				<h2 class="text-xl font-black">Belum ada member.</h2>
				<p class="mt-2 max-w-sm text-sm leading-6 text-[#527169]">
					Daftar pemain akan muncul di sini setelah Club Admin menambahkan member.
				</p>
			</div>{/if}
	</section>
	{#if !signedIn && roster.length}<p class="mt-5 text-sm leading-6 text-[#527169]">
			Profil pemain dapat dilihat semua orang. Pengelolaan roster hanya untuk Club Admin.
		</p>{/if}
	{#if notice}<p
			class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm font-bold text-[#9a3d25]"
		>
			{notice}
		</p>{/if}
</AppShell>
