<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { prefetchPublicSurface } from '$lib/data/dashboard';

	let {
		children,
		current,
		clubName = 'PB NEWBIE'
	}: { children: Snippet; current: string; clubName?: string } = $props();

	const links = [
		{ href: '/live', label: 'Live' },
		{ href: '/players', label: 'Pemain' },
		{ href: '/history', label: 'Riwayat' },
		{ href: '/fund', label: 'Dana' },
		{ href: '/settings', label: 'Pengaturan' }
	] as const;
</script>

<main class="min-h-dvh bg-[#f4f1e8] pb-28 text-[#163630]">
	<div class="mx-auto max-w-2xl px-4 py-5 sm:px-6">
		<header class="mb-6 flex items-center justify-between gap-4 border-b border-[#b9c5bb] pb-4">
			<a
				class="flex min-w-0 items-center gap-3"
				href={resolve('/live')}
				data-sveltekit-preload-data="hover"
			>
				<span
					class="grid size-11 shrink-0 place-items-center bg-[#163630] text-sm font-black tracking-[-0.1em] text-[#f5bb61] shadow-[0_6px_14px_rgba(22,54,48,0.18)]"
					>PB</span
				>
				<span class="min-w-0"
					><span class="block truncate text-lg font-black tracking-tight">{clubName}</span><span
						class="block text-[10px] font-black tracking-[0.17em] text-[#527169]"
						>KLUB BULUTANGKIS</span
					></span
				>
			</a>
			<a
				class="min-h-11 border border-[#b9c5bb] bg-[#fffaf0] px-3 py-3 text-xs font-black text-[#38675b] hover:bg-[#e5ece5]"
				href={resolve('/settings')}
				data-sveltekit-preload-data="hover"
				onmouseenter={() => void prefetchPublicSurface('/settings')}
				onfocus={() => void prefetchPublicSurface('/settings')}>PENGATURAN</a
			>
		</header>
		{@render children()}
	</div>

	<nav
		class="fixed inset-x-0 bottom-0 z-20 border-t border-[#b9c5bb] bg-[#fffaf0]/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
		aria-label="Navigasi utama"
	>
		<div class="mx-auto grid max-w-2xl grid-cols-5 gap-1">
			{#each links as link (link.href)}
				<a
					href={resolve(link.href)}
					data-sveltekit-preload-data="hover"
					onmouseenter={() => void prefetchPublicSurface(link.href)}
					onfocus={() => void prefetchPublicSurface(link.href)}
					aria-current={current === link.href ? 'page' : undefined}
					class={`flex min-h-12 items-center justify-center px-1 text-center text-[11px] font-black transition ${current === link.href ? 'bg-[#163630] text-[#fffaf0]' : 'text-[#527169] hover:bg-[#e5ece5]'}`}
					>{link.label}</a
				>
			{/each}
		</div>
	</nav>
</main>
