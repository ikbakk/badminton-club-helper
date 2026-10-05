<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import { ArrowRight } from '@lucide/svelte';
	import {
		addPlayer,
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
	let name = $state('');
	let loading = $state(true);
	let notice = $state('');
	let displayName = $derived(club?.name ?? publicClub?.name ?? 'PB NEWBIE');
	let members = $derived(roster.filter((player) => player.membership_type === 'MEMBER'));
	let guests = $derived(roster.filter((player) => player.membership_type === 'GUEST'));

	async function loadPublicRoster() {
		try {
			publicClub = await getPublicClub();
			roster = publicClub ? await getPublicRoster(publicClub.id) : [];
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Daftar pemain belum bisa dimuat.';
		} finally {
			loading = false;
		}
	}

	async function loadAdminRoster() {
		if (!club?.is_club_admin) return;
		roster = await getRoster(club.id);
	}

	async function handleAccessChange(accountClub: Club | null) {
		club = accountClub;
		if (!accountClub?.is_club_admin) return;
		try {
			await loadAdminRoster();
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Daftar admin pemain belum dapat dimuat.';
		}
	}
	async function createPlayer() {
		if (!club || !name.trim()) return;
		try {
			await addPlayer(club.id, name);
			invalidatePublicData();
			name = '';
			await loadAdminRoster();
			notice = 'Pemain ditambahkan ke daftar klub.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Pemain belum bisa ditambahkan. Coba lagi.';
		}
	}
	async function promoteGuest(playerId: string) {
		if (
			!club ||
			!confirm('Jadikan pemain ini anggota tetap klub? Riwayat mainnya tetap tersimpan.')
		)
			return;
		try {
			await promoteGuestToMember(club.id, playerId);
			invalidatePublicData();
			await loadAdminRoster();
			notice = 'Tamu dipromosikan menjadi member.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Tamu belum dapat dipromosikan.';
		}
	}
	if (browser) void loadPublicRoster();
</script>

<svelte:head><title>Pemain — PB NEWBIE</title></svelte:head>
<AppShell current="/players" clubName={displayName} onaccesschange={handleAccessChange}>
	<section class="border-b border-[#b9c5bb] pb-5">
		<div class="flex items-end justify-between gap-4">
			<div>
				<h1 class="text-3xl font-black tracking-[-0.05em]">Pemain</h1>
				<p class="mt-2 text-sm leading-6 text-[#527169]">
					Anggota klub yang bisa ikut sesi malam ini.
				</p>
			</div>
			{#if loading}<span class="w-18 shrink-0"><LoadingSkeleton height="1rem" /></span>
			{:else}<p class="shrink-0 text-right text-sm font-black text-[#38675b]">
					{members.length} anggota{guests.length ? ` · ${guests.length} tamu` : ''}
				</p>{/if}
		</div>
	</section>
	{#if club?.is_club_admin}
		<section class="mt-5 border-y border-[#b9c5bb] bg-[#e5ece5] px-5 py-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h2 class="text-lg font-black">Tambah pemain</h2>
				<p class="text-sm text-[#527169]">Langsung masuk ke roster klub.</p>
			</div>
			<div class="mt-3 flex gap-3">
				<input
					class="min-h-11 min-w-0 flex-1 border border-[#b9c5bb] bg-[#fffaf0] px-3 font-bold"
					bind:value={name}
					placeholder="Nama pemain"
				/><AppButton disabled={!name.trim()} onclick={createPlayer}>Tambah</AppButton>
			</div>
		</section>
	{/if}
	<section class="mt-5 border-y border-[#b9c5bb] bg-[#fffaf0]">
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
		{:else if roster.length}
			{#snippet rosterGroup(title: string, players: typeof roster)}
				{#if players.length}<div>
						<h2
							class="border-b border-[#b9c5bb] bg-[#e5ece5] px-5 py-3 text-xs font-black tracking-[0.12em] text-[#38675b]"
						>
							{title} · {players.length}
						</h2>
						<ul>
							{#each players as player (player.id)}<li
									class="border-b border-[#b9c5bb] last:border-b-0"
								>
									<a
										class="group flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-[#e5ece5]"
										href={resolve('/players/[id]', { id: player.id })}
										data-sveltekit-preload-data="hover"
										onmouseenter={() => void prefetchPublicPlayer(player.id)}
										onfocus={() => void prefetchPublicPlayer(player.id)}
										><span
											><b class="block text-lg tracking-[-0.02em]">{player.display_name}</b><span
												class="mt-1 block text-xs font-black tracking-[0.1em] text-[#527169]"
												>{player.membership_type === 'MEMBER' ? 'ANGGOTA KLUB' : 'TAMU'}</span
											></span
										><ArrowRight
											class="shrink-0 text-[#38675b] transition-transform group-hover:translate-x-1"
											size={18}
										/></a
									>
									{#if club?.is_club_admin && player.membership_type === 'GUEST'}<button
											class="mb-3 ml-5 min-h-9 border border-[#b9c5bb] bg-[#fffaf0] px-3 text-xs font-black text-[#38675b]"
											onclick={() => void promoteGuest(player.id)}>Jadikan anggota</button
										>{/if}
								</li>{/each}
						</ul>
					</div>{/if}
			{/snippet}
			{@render rosterGroup('ANGGOTA', members)}
			{@render rosterGroup('TAMU', guests)}
		{:else}<div class="p-7">
				<h2 class="text-xl font-black">Belum ada member.</h2>
				<p class="mt-2 max-w-sm text-sm leading-6 text-[#527169]">
					Daftar pemain akan muncul di sini setelah admin klub menambahkan pemain.
				</p>
			</div>{/if}
	</section>
	{#if !club?.is_club_admin && roster.length}<p class="mt-5 text-sm leading-6 text-[#527169]">
			Profil pemain bisa dilihat semua orang. Hanya admin klub yang bisa mengelola daftar pemain.
		</p>{/if}
	{#if notice}<p
			class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm font-bold text-[#9a3d25]"
		>
			{notice}
		</p>{/if}
</AppShell>
