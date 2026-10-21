<script lang="ts">
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { onMount } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { publicSurfaceKey } from '$lib/data/query-client';
	import QueryNotice from '$lib/components/ui/QueryNotice.svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { selectedClubId } from '$lib/club-context';
	import { ArrowLeft } from '@lucide/svelte';
	import { ArrowRight } from '@lucide/svelte';
	import { getRatingConfidenceLabel } from '$lib/domain/rating';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import {
		getPublicClub,
		getPublicPlayerProfile,
		getPublicPlayerRating,
		getPublicPlayerSessionSummaries,
		type PublicPlayerProfile,
		type PublicPlayerSessionSummary
	} from '$lib/data/dashboard';
	let { params }: { params: { id: string } } = $props();
	const clubId = selectedClubId();
	const profileQuery = createQuery(() => ({
		queryKey: publicSurfaceKey(clubId, 'player', params.id),
		enabled: browser,
		retry: false,
		queryFn: async () => {
			const playerId = params.id;
			const [club, player, rating] = await Promise.all([
				getPublicClub(clubId),
				getPublicPlayerProfile(playerId, clubId),
				getPublicPlayerRating(playerId, clubId)
			]);
			return { club, player, rating };
		}
	}));
	onMount(() => {
		const refresh = () => void profileQuery.refetch();
		window.addEventListener('focus', refresh);
		return () => window.removeEventListener('focus', refresh);
	});

	let clubName = $derived(profileQuery.data?.club?.name ?? 'Klub');
	let player: PublicPlayerProfile | null = $derived(profileQuery.data?.player ?? null);
	const summaryQuery = createQuery(() => ({
		queryKey: publicSurfaceKey(clubId, 'player-summary', params.id),
		enabled: browser && Boolean(profileQuery.data?.player),
		retry: false,
		queryFn: () => getPublicPlayerSessionSummaries(params.id, clubId)
	}));
	let summaries: PublicPlayerSessionSummary[] = $derived(summaryQuery.data ?? []);
	let playerRating = $derived(profileQuery.data?.rating ?? null);
	let loading = $derived(profileQuery.isPending);
	let statisticsAvailable = $derived(Boolean(profileQuery.data));

	const date = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
</script>

<svelte:head><title>{player?.display_name ?? 'Pemain'} — Courtside</title></svelte:head>
<AppShell current="/players" mode={player?.display_name ?? 'PEMAIN'} {clubName}>
	<QueryNotice
		failed={profileQuery.isError}
		hasData={Boolean(profileQuery.data)}
		retry={() => profileQuery.refetch()}
		fetching={profileQuery.isFetching}
	/>
	<a
		href={resolve('/clubs/[clubId]/players', { clubId: selectedClubId() })}
		class="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#38675b]"
		><ArrowLeft size={18} />Kembali ke pemain</a
	>
	{#if loading}<section
			class="mt-6"
			role="status"
			aria-busy="true"
			aria-label="Membuka profil pemain"
		>
			<div class="w-3/5"><LoadingSkeleton height="2.5rem" /></div>
			<p class="mt-2 text-sm font-bold text-[#527169]">Anggota klub</p>
			<div
				class="mt-7 grid grid-cols-2 border border-[#d6ddd3] bg-[#fffaf0] sm:grid-cols-4"
				aria-hidden="true"
			>
				{#each ['Sesi', 'Set', 'Menang', 'Kalah'] as stat (stat)}<div
						class="border-r border-b border-[#d6ddd3] p-4 last:border-r-0"
					>
						<div class="w-12"><LoadingSkeleton height="1.75rem" /></div>
						<span class="mt-2 block text-sm">{stat}</span>
					</div>{/each}
			</div>
			<section class="mt-7 border-t border-[#d6ddd3] pt-5">
				<h2 class="text-xl font-bold">Rating</h2>
				<div class="mt-3 w-3/4"><LoadingSkeleton /></div>
			</section>
			<section class="mt-7 border-t border-[#d6ddd3] pt-5">
				<h2 class="text-xl font-bold">Sesi terbaru</h2>
				<div class="mt-3 border-y border-[#d6ddd3] bg-[#fffaf0]" aria-hidden="true">
					{#each [1, 2] as row (row)}<div
							class="flex min-h-12 items-center border-b border-[#e5ece5] px-4 last:border-0"
						>
							<div class="w-1/3"><LoadingSkeleton /></div>
						</div>{/each}
				</div>
			</section>
		</section>
	{:else if player}<section class="mt-6">
			<div class="player-identity">
				<Avatar name={player.display_name} size="lg" />
				<div>
					<h1>{player.display_name}</h1>
					<p>{player.membership_type === 'MEMBER' ? 'Anggota klub' : 'Tamu klub'}</p>
				</div>
			</div>

			<section class="court-panel profile-rating mt-6 p-5">
				<h2 class="text-xs font-semibold">Rating</h2>
				{#if playerRating}
					<p class="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#163630] tabular-nums">
						{Math.round(playerRating.rating)}
					</p>
					<p class="mt-1 text-sm font-bold text-[#527169]">
						{getRatingConfidenceLabel(playerRating.uncertainty) === 'ESTABLISHED'
							? 'Stabil'
							: 'Masih dikalibrasi'}
					</p>
				{:else}
					<p class="mt-2 text-sm leading-6 text-[#527169]">Rating belum tersedia.</p>
				{/if}
			</section>
			<section class="mt-6 border-y border-[#d6ddd3]" aria-label="Ringkasan per sesi">
				<div class="flex items-baseline justify-between gap-4 px-1 py-4">
					<h2 class="text-lg font-bold tracking-[-0.025em]">Sesi terbaru</h2>
					<span class="text-sm font-bold text-[#38675b]">{player.sessions} hadir</span>
				</div>
				<QueryNotice
					failed={summaryQuery.isError}
					hasData={Boolean(summaryQuery.data)}
					retry={() => summaryQuery.refetch()}
					fetching={summaryQuery.isFetching}
				/>
				{#if summaryQuery.isPending}<p class="py-4 text-sm" role="status">
						Membuka ringkasan sesi…
					</p>
				{:else if summaries.length}<ul>
						{#each summaries as summary (summary.session_id)}<li
								class="border-t border-[#d6ddd3] py-4"
							>
								<a
									class="inline-flex min-h-11 items-center gap-2 text-lg font-bold underline"
									href={summary.closed_at
										? resolve('/clubs/[clubId]/history/[id]', { clubId, id: summary.session_id })
										: resolve('/clubs/[clubId]/live', { clubId })}
									>{date(summary.started_at)}{summary.closed_at ? '' : ' · berlangsung'}<ArrowRight
										size={16}
									/></a
								>
								<p class="mt-1 text-sm font-bold">
									{summary.sets} set · {summary.wins} menang · {summary.losses} kalah
								</p>
								<p class="mt-1 text-sm text-[#527169]">
									Partner: {summary.partners.join(', ') || 'Belum ada set selesai'}
								</p>
								<p class="mt-1 text-sm text-[#527169]">
									{summary.rating_change === null
										? 'Perubahan rating belum tersedia untuk semua set.'
										: `Rating dari set: ${summary.rating_change > 0 ? '+' : ''}${Math.round(summary.rating_change * 10) / 10}`}
								</p>
							</li>{/each}
					</ul>{:else if !summaryQuery.isError}<p
						class="border-t border-[#d6ddd3] py-5 text-sm text-[#527169]"
					>
						Belum ada sesi yang tercatat.
					</p>{/if}
			</section>

			{#if statisticsAvailable}<section class="mt-6 border-y border-[#d6ddd3]">
					<div class="grid grid-cols-2 sm:grid-cols-4">
						<p class="border-r border-b border-[#d6ddd3] p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.sessions}</b>Sesi
						</p>
						<p class="border-r border-b border-[#d6ddd3] p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.sets}</b>Set
						</p>
						<p class="border-r border-[#d6ddd3] p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.wins}</b>Menang
						</p>
						<p class="p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.losses}</b>Kalah
						</p>
					</div>
				</section>{:else}<p
					class="mt-9 border-y border-[#d6ddd3] py-4 text-sm leading-6 text-[#527169]"
				>
					Statistik akan tersedia setelah read model profil pemain diterapkan.
				</p>{/if}
		</section>
	{:else if !profileQuery.isError}<section
			class="court-panel mt-7 border border-[#d6ddd3] bg-[#fffaf0] p-6"
		>
			<h1 class="text-2xl font-bold">Pemain tidak ditemukan.</h1>
			<p class="mt-2 text-sm text-[#527169]">Profil ini mungkin sudah tidak aktif.</p>
		</section>{/if}
</AppShell>

<style>
	.player-identity {
		display: flex;
		gap: 20px;
		align-items: center;
		margin: 24px 0;
	}
	.player-identity > div {
		min-width: 0;
	}
	.player-identity h1 {
		overflow-wrap: anywhere;
	}
	.player-identity p {
		margin-top: 7px;
		font-size: 13px;
		color: var(--court-muted);
	}
	.profile-rating {
		background: var(--court-chalk);
	}
</style>
