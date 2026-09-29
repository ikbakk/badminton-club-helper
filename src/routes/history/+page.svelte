<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import {
		getPublicClub,
		getPublicSessionHistory,
		prefetchPublicSession,
		type PublicSessionHistory
	} from '$lib/data/dashboard';
	let clubName = $state('PB NEWBIE');
	let history = $state<PublicSessionHistory[]>([]);
	let loading = $state(true);
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
	if (browser)
		void (async () => {
			try {
				const club = await getPublicClub();
				clubName = club?.name ?? clubName;
				history = (await getPublicSessionHistory()).filter((session) => session.closed_at);
			} finally {
				loading = false;
			}
		})();
</script>

<svelte:head><title>Riwayat — PB NEWBIE</title></svelte:head>
<AppShell current="/history" {clubName}>
	<section class="border-b border-[#b9c5bb] pb-5">
		<h1 class="text-3xl font-black tracking-[-0.05em]">Riwayat</h1>
		<p class="mt-2 text-sm leading-6 text-[#527169]">
			Malam yang sudah selesai, untuk dilihat semua member.
		</p>
	</section>
	{#if loading}<section
			class="mt-5 border border-[#b9c5bb] bg-[#fffaf0]"
			role="status"
			aria-busy="true"
			aria-label="Membuka riwayat sesi"
		>
			{#each [1, 2, 3] as row (row)}<div
					class="flex min-h-20 items-center gap-4 border-b border-[#b9c5bb] px-5 py-4 last:border-0"
					aria-hidden="true"
				>
					<div class="flex-1 space-y-2">
						<div class="w-2/5"><LoadingSkeleton /></div>
						<div class="w-1/3"><LoadingSkeleton height="0.75rem" /></div>
					</div>
					<div class="w-4"><LoadingSkeleton /></div>
				</div>{/each}
		</section>
	{:else if history.length}<section class="mt-5 border border-[#b9c5bb] bg-[#fffaf0]">
			<ul>
				{#each history as session (session.id)}<li
						class="border-b border-[#b9c5bb] last:border-b-0"
					>
						<a
							class="flex min-h-20 items-center justify-between gap-4 px-5 py-4 hover:bg-[#e5ece5]"
							href={resolve('/history/[id]', { id: session.id })}
							data-sveltekit-preload-data="hover"
							onmouseenter={() => void prefetchPublicSession(session.id)}
							onfocus={() => void prefetchPublicSession(session.id)}
							><span
								><b class="block text-base">{date(session.started_at)}</b><span
									class="mt-1 block text-sm text-[#527169]"
									>{session.attendance} pemain · {duration(
										session.started_at,
										session.closed_at
									)}</span
								></span
							><span class="text-lg text-[#38675b]">›</span></a
						>
					</li>{/each}
			</ul>
		</section>
	{:else}<section class="mt-5 border border-[#b9c5bb] bg-[#fffaf0] p-7">
			<h2 class="text-2xl font-black">Belum ada sesi selesai.</h2>
			<p class="mt-3 max-w-sm text-sm leading-6 text-[#527169]">
				Setelah sesi ditutup, daftar match dan hasil set akan tersimpan di sini.
			</p>
			<a
				class="mt-5 inline-flex min-h-11 items-center bg-[#163630] px-4 text-sm font-black text-[#fffaf0]"
				href={resolve('/live')}>Lihat Live</a
			>
		</section>{/if}
</AppShell>
