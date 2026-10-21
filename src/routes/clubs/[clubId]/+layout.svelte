<script lang="ts">
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import { getPublicClub } from '$lib/data/dashboard';
	import { selectedClubId } from '$lib/club-context';
	let { children } = $props();
	const clubId = selectedClubId();
	const club = createQuery(() => ({
		queryKey: ['club', clubId],
		queryFn: () => getPublicClub(clubId),
		enabled: browser,
		staleTime: 60_000
	}));
</script>

{#if club.isPending}
	<main
		class="mx-auto min-h-dvh max-w-3xl px-5 py-8"
		role="status"
		aria-label="Membuka klub"
		aria-busy="true"
	>
		<div class="mb-10 w-1/3"><LoadingSkeleton height="1.5rem" /></div>
		<div class="mb-5 w-1/2"><LoadingSkeleton height="2rem" /></div>
		<LoadingSkeleton height="17rem" />
		<div class="mt-6 space-y-4">
			<LoadingSkeleton height="3.5rem" /><LoadingSkeleton height="3.5rem" />
		</div>
		<span class="sr-only">Membuka klub…</span>
	</main>
{:else if !club.data}
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
