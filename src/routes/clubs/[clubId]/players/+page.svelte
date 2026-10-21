<script lang="ts">
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { untrack } from 'svelte';

	import { publicSurfaceKey } from '$lib/data/query-client';
	import QueryNotice from '$lib/components/ui/QueryNotice.svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { selectedClubId } from '$lib/club-context';
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
	const clubId = selectedClubId();
	const rosterQuery = createQuery(() => ({
		queryKey: publicSurfaceKey(clubId, 'roster'),
		enabled: browser,
		retry: false,
		queryFn: async () => {
			const publicClub = await getPublicClub(clubId);
			return { publicClub, roster: publicClub ? await getPublicRoster(clubId) : [] };
		}
	}));
	const queryClient = useQueryClient();
	const adminRosterKey = ['admin-roster', clubId] as const;
	const adminRosterQuery = createQuery(() => ({
		queryKey: adminRosterKey,
		enabled: browser && Boolean(club?.is_club_admin),
		queryFn: () => getRoster(clubId),
		gcTime: 0,
		retry: false
	}));
	$effect(() => {
		if (!club?.is_club_admin)
			untrack(() => {
				void queryClient.cancelQueries({ queryKey: adminRosterKey });
				queryClient.removeQueries({ queryKey: adminRosterKey });
			});
	});

	let publicClub = $derived(rosterQuery.data?.publicClub ?? null);
	let roster = $derived(
		club?.is_club_admin ? (adminRosterQuery.data ?? []) : (rosterQuery.data?.roster ?? [])
	);
	let pending = $state(false);

	let name = $state('');
	let loading = $derived(rosterQuery.isPending);
	let notice = $state('');
	let displayName = $derived(club?.name ?? publicClub?.name ?? 'Klub');
	let members = $derived(roster.filter((player) => player.membership_type === 'MEMBER'));
	let guests = $derived(roster.filter((player) => player.membership_type === 'GUEST'));

	function handleAccessChange(accountClub: Club | null) {
		club = accountClub;
	}

	async function createPlayer() {
		if (!club || !name.trim() || pending) return;
		pending = true;
		try {
			await addPlayer(club.id, name);
			invalidatePublicData();
			name = '';
			await Promise.all([rosterQuery.refetch(), adminRosterQuery.refetch()]);
			notice = 'Pemain ditambahkan ke daftar klub.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Pemain belum bisa ditambahkan. Coba lagi.';
		} finally {
			pending = false;
		}
	}
	async function promoteGuest(playerId: string) {
		if (
			!club ||
			pending ||
			!confirm('Jadikan pemain ini anggota tetap klub? Riwayat mainnya tetap tersimpan.')
		)
			return;
		pending = true;
		try {
			await promoteGuestToMember(club.id, playerId);
			invalidatePublicData();
			await Promise.all([rosterQuery.refetch(), adminRosterQuery.refetch()]);
			notice = 'Tamu dipromosikan menjadi member.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Tamu belum dapat dipromosikan.';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head><title>Pemain — Courtside</title></svelte:head>
<AppShell current="/players" clubName={displayName} onaccesschange={handleAccessChange}>
	<QueryNotice
		failed={rosterQuery.isError}
		hasData={Boolean(rosterQuery.data)}
		retry={() => rosterQuery.refetch()}
		fetching={rosterQuery.isFetching}
	/>
	<QueryNotice
		failed={Boolean(club?.is_club_admin && adminRosterQuery.isError)}
		hasData={Boolean(adminRosterQuery.data)}
		retry={() => adminRosterQuery.refetch()}
		fetching={adminRosterQuery.isFetching}
	/>
	<section class="border-b border-[#d6ddd3] pb-5">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold tracking-[-0.035em]">Pemain</h1>
				<p class="mt-2 text-sm leading-6 text-[#527169]">
					Anggota klub yang bisa ikut sesi malam ini.
				</p>
			</div>
			{#if loading}<span class="w-18 shrink-0"><LoadingSkeleton height="1rem" /></span>
			{:else}<p class="shrink-0 text-right text-sm font-bold text-[#38675b]">
					{members.length} anggota{guests.length ? ` · ${guests.length} tamu` : ''}
				</p>{/if}
		</div>
	</section>
	{#if club?.is_club_admin}
		<section class="court-panel mt-5 border-y border-[#d6ddd3] bg-[#e5ece5] px-5 py-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h2 class="text-lg font-bold">Tambah pemain</h2>
				<p class="text-sm text-[#527169]">Langsung masuk ke roster klub.</p>
			</div>
			<div class="mt-3 flex gap-3">
				<input
					class="min-h-11 min-w-0 flex-1 rounded-md border border-[#d6ddd3] bg-[#fffaf0] px-3 font-bold"
					bind:value={name}
					placeholder="Nama pemain"
				/><AppButton disabled={!name.trim() || pending} onclick={createPlayer}>Tambah</AppButton>
			</div>
		</section>
	{/if}
	<section class="court-panel mt-5 border-y border-[#d6ddd3] bg-[#fffaf0]">
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
							class="border-b border-[#d6ddd3] bg-[#e5ece5] px-5 py-3 text-xs font-bold tracking-[0.12em] text-[#38675b]"
						>
							{title} · {players.length}
						</h2>
						<ul>
							{#each players as player (player.id)}<li
									class="border-b border-[#d6ddd3] last:border-b-0"
								>
									<a
										class="group flex min-h-20 items-center gap-4 px-5 py-4 hover:bg-[#e5ece5]"
										href={resolve('/clubs/[clubId]/players/[id]', {
											clubId: selectedClubId(),
											id: player.id
										})}
										data-sveltekit-preload-data="hover"
										onmouseenter={() => void prefetchPublicPlayer(player.id)}
										onfocus={() => void prefetchPublicPlayer(player.id)}
										><Avatar name={player.display_name} /><span class="min-w-0 flex-1"
											><b class="block text-base font-bold tracking-[-0.02em] break-words"
												>{player.display_name}</b
											><span class="mt-1 block text-xs font-bold tracking-[0.1em] text-[#527169]"
												>{player.membership_type === 'MEMBER' ? 'ANGGOTA KLUB' : 'TAMU'}</span
											></span
										><ArrowRight
											class="shrink-0 text-[#38675b] transition-transform group-hover:translate-x-1"
											size={18}
										/></a
									>
									{#if club?.is_club_admin && player.membership_type === 'GUEST'}<button
											class="mb-3 ml-5 min-h-11 rounded-md border border-[#d6ddd3] bg-[#fffaf0] px-3 text-xs font-bold text-[#38675b]"
											onclick={() => void promoteGuest(player.id)}>Jadikan anggota</button
										>{/if}
								</li>{/each}
						</ul>
					</div>{/if}
			{/snippet}
			{@render rosterGroup('ANGGOTA', members)}
			{@render rosterGroup('TAMU', guests)}
		{:else if !rosterQuery.isError}<div class="p-7">
				<h2 class="text-xl font-bold">Belum ada member.</h2>
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
