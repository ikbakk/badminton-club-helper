<script lang="ts">
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { createQuery } from '@tanstack/svelte-query';
	import { selectedClubId } from '$lib/club-context';
	import { getPublicClub } from '$lib/data/dashboard';
	import type { LayoutProps } from './$types';
	let { children, data }: LayoutProps = $props();
	const clubId = selectedClubId();
	const club = createQuery(() => ({
		queryKey: ['club', clubId],
		meta: { navigationCritical: true },
		queryFn: () => getPublicClub(clubId),
		initialData: data.initialPublicClub,
		initialDataUpdatedAt: data.initialDataUpdatedAt,
		enabled: browser,
		staleTime: 60_000
	}));
</script>

{#if !club.isPending && !club.data}
	<main class="mx-auto max-w-lg px-5 py-16">
		<h1 class="text-3xl font-bold">
			{club.isError ? 'Klub belum bisa dimuat.' : 'Klub tidak ditemukan.'}
		</h1>
		<p class="mt-4 leading-7">
			{club.isError
				? 'Periksa koneksi lalu coba lagi.'
				: 'Periksa tautan dari admin klub. Tautan ini tidak membuka klub lain secara otomatis.'}
		</p>
		{#if club.isError}<button
				class="mt-6 min-h-12 rounded-md bg-[#e2653e] px-5 font-bold"
				onclick={() => void club.refetch()}>Coba lagi</button
			>{/if}
		<a class="mt-6 flex min-h-11 items-center font-bold underline" href={resolve('/')}
			>Kembali ke beranda</a
		>
	</main>
{:else}
	{@render children()}
{/if}
