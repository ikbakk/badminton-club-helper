<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { publicSurfaceKey } from '$lib/data/query-client';
	import QueryNotice from '$lib/components/ui/QueryNotice.svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { selectedClubId } from '$lib/club-context';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import { ArrowRight } from '@lucide/svelte';
	import {
		getPublicClub,
		getPublicSessionHistory,
		prefetchPublicSession,
		type PublicSessionHistory
	} from '$lib/data/dashboard';
	const clubId = selectedClubId();
	const historyQuery = createQuery(() => ({
		queryKey: publicSurfaceKey(clubId, 'history'),
		enabled: browser,
		retry: false,
		queryFn: async () => {
			const [club, history] = await Promise.all([
				getPublicClub(clubId),
				getPublicSessionHistory(clubId)
			]);
			return { club, history: history.filter((session) => session.closed_at) };
		}
	}));
	let clubName = $derived(historyQuery.data?.club?.name ?? 'Klub');
	let history: PublicSessionHistory[] = $derived(historyQuery.data?.history ?? []);
	let loading = $derived(historyQuery.isPending);
	let selectedMonth = $state('all');
	let attendanceFilter = $state<'all' | 'small' | 'regular' | 'busy'>('all');
	const date = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(
			new Date(value)
		);
	const duration = (start: string, end: string | null) => {
		if (!end) return '';
		const mins = Math.max(
			0,
			Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
		);
		return `${Math.floor(mins / 60)}j ${mins % 60}m`;
	};
	const monthKey = (value: string) => value.slice(0, 7);
	const monthLabel = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
			new Date(`${value}-01T00:00:00`)
		);
	let months = $derived([...new Set(history.map((session) => monthKey(session.started_at)))]);
	let filteredHistory = $derived(
		history.filter((session) => {
			if (selectedMonth !== 'all' && monthKey(session.started_at) !== selectedMonth) return false;
			if (attendanceFilter === 'small') return session.attendance < 8;
			if (attendanceFilter === 'regular') return session.attendance >= 8 && session.attendance < 12;
			if (attendanceFilter === 'busy') return session.attendance >= 12;
			return true;
		})
	);
</script>

<svelte:head><title>Riwayat — Courtside</title></svelte:head>
<AppShell current="/history" {clubName}>
	<QueryNotice
		failed={historyQuery.isError}
		hasData={Boolean(historyQuery.data)}
		retry={() => historyQuery.refetch()}
		fetching={historyQuery.isFetching}
	/>
	<section class="border-b border-[#d6ddd3] pb-5">
		<h1 class="text-3xl font-bold tracking-[-0.035em]">Riwayat</h1>
		<p class="mt-2 text-sm leading-6 text-[#527169]">
			Malam yang sudah selesai, untuk dilihat semua member.
		</p>
	</section>
	{#if loading}<section
			class="court-panel mt-5 border border-[#d6ddd3] bg-[#fffaf0]"
			role="status"
			aria-busy="true"
			aria-label="Membuka riwayat sesi"
		>
			{#each [1, 2, 3] as row (row)}<div
					class="flex min-h-20 items-center gap-4 border-b border-[#d6ddd3] px-5 py-4 last:border-0"
					aria-hidden="true"
				>
					<div class="flex-1 space-y-2">
						<div class="w-2/5"><LoadingSkeleton /></div>
						<div class="w-1/3"><LoadingSkeleton height="0.75rem" /></div>
					</div>
					<div class="w-4"><LoadingSkeleton /></div>
				</div>{/each}
		</section>
	{:else if history.length}
		<section class="court-panel mt-5 border-y border-[#d6ddd3] bg-[#e5ece5] px-5 py-4">
			<div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
				<label class="grid gap-2 text-xs font-bold tracking-[0.12em] text-[#38675b]"
					>PERIODE<select
						class="min-h-11 rounded-md border border-[#d6ddd3] bg-[#fffaf0] px-3 text-sm font-bold tracking-normal text-[#163630]"
						bind:value={selectedMonth}
					>
						<option value="all">Semua bulan</option>
						{#each months as month (month)}<option value={month}>{monthLabel(month)}</option>{/each}
					</select></label
				>
				<fieldset class="grid gap-2">
					<legend class="text-xs font-bold tracking-[0.12em] text-[#38675b]">KEHADIRAN</legend>
					<div class="flex flex-wrap gap-2">
						{#each [['all', 'Semua'], ['small', '< 8'], ['regular', '8–11'], ['busy', '12+']] as filter (filter[0])}<button
								class={`min-h-11 border px-3 text-sm font-bold ${attendanceFilter === filter[0] ? 'border-[#163630] bg-[#163630] text-[#fffaf0]' : 'border-[#d6ddd3] bg-[#fffaf0] text-[#38675b]'}`}
								onclick={() => (attendanceFilter = filter[0] as typeof attendanceFilter)}
								>{filter[1]}</button
							>{/each}
					</div>
				</fieldset>
			</div>
		</section>
		<section class="court-panel border-b border-[#d6ddd3] bg-[#fffaf0]">
			<div class="flex items-center justify-between gap-4 border-b border-[#d6ddd3] px-5 py-3">
				<h2 class="text-lg font-bold tracking-[-0.03em]">Sesi selesai</h2>
				<span class="text-sm font-bold text-[#38675b]">{filteredHistory.length} sesi</span>
			</div>
			<ul>
				{#each filteredHistory as session (session.id)}<li
						class="border-b border-[#d6ddd3] last:border-b-0"
					>
						<a
							class="group grid min-h-20 grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 hover:bg-[#e5ece5]"
							href={resolve('/clubs/[clubId]/history/[id]', {
								clubId: selectedClubId(),
								id: session.id
							})}
							data-sveltekit-preload-data="hover"
							onmouseenter={() => void prefetchPublicSession(session.id)}
							onfocus={() => void prefetchPublicSession(session.id)}
							><span
								><b class="block text-xl tracking-[-0.03em]">{date(session.started_at)}</b><span
									class="mt-1 block text-sm text-[#527169]"
									>{session.attendance} pemain · {duration(
										session.started_at,
										session.closed_at
									)}</span
								></span
							><ArrowRight
								class="text-[#38675b] transition-transform group-hover:translate-x-1"
								size={18}
							/></a
						>
					</li>{/each}
			</ul>
			{#if !filteredHistory.length}<p class="px-5 py-7 text-sm leading-6 text-[#527169]">
					Tidak ada sesi untuk filter ini. Pilih periode atau jumlah pemain lain.
				</p>{/if}
		</section>
	{:else if !historyQuery.isError}<section
			class="court-panel mt-5 border border-[#d6ddd3] bg-[#fffaf0] p-7"
		>
			<h2 class="text-2xl font-bold">Belum ada sesi selesai.</h2>
			<p class="mt-3 max-w-sm text-sm leading-6 text-[#527169]">
				Setelah sesi ditutup, daftar match dan hasil set akan tersimpan di sini.
			</p>
			<a
				class="mt-5 inline-flex min-h-11 items-center bg-[#163630] px-4 text-sm font-bold text-[#fffaf0]"
				href={resolve('/clubs/[clubId]/live', { clubId: selectedClubId() })}>Lihat Live</a
			>
		</section>{/if}
</AppShell>
