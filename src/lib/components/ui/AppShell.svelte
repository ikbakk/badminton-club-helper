<script lang="ts">
	import { resolve } from '$app/paths';
	import { clubHref, selectedClubId } from '$lib/club-context';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { getClub, prefetchPublicSurface, type Club } from '$lib/data/dashboard';
	import { authState, loadCachedClub, setCachedClub } from '$lib/auth-state.svelte';
	import { History, House, Settings, UsersRound, Wallet } from '@lucide/svelte';

	let {
		children,
		current,
		clubName = 'Klub',
		mode,
		headerActions,
		onaccesschange
	}: {
		children: Snippet;
		current: string;
		clubName?: string;
		mode?: string;
		headerActions?: Snippet;
		onaccesschange?: (club: Club | null) => void;
	} = $props();

	const links = [
		{ href: '/live', route: '/clubs/[clubId]/live', label: 'Live', icon: House },
		{ href: '/players', route: '/clubs/[clubId]/players', label: 'Pemain', icon: UsersRound },
		{ href: '/history', route: '/clubs/[clubId]/history', label: 'Riwayat', icon: History },
		{ href: '/fund', route: '/clubs/[clubId]/fund', label: 'Kas', icon: Wallet },
		{ href: '/settings', route: '/clubs/[clubId]/settings', label: 'Pengaturan', icon: Settings }
	] as const;
	let shareNotice = $state('');
	async function copyClubLink() {
		try {
			await navigator.clipboard.writeText(new URL(clubHref('/live'), window.location.origin).href);
			shareNotice = 'Tautan klub disalin.';
		} catch {
			shareNotice = 'Tautan belum bisa disalin. Bagikan alamat halaman Live dari browser.';
		}
	}
	let visibleLinks = $derived(
		links.filter(
			(link) =>
				link.href !== '/settings' ||
				Boolean(authState.club?.id === selectedClubId() && authState.club?.is_club_admin)
		)
	);

	const activeMode = $derived(
		mode ??
			(current === '/live'
				? 'LIVE COURT'
				: current === '/history'
					? 'ARSIP SESI'
					: current === '/fund'
						? 'KAS KLUB'
						: current === '/players'
							? 'PEMAIN'
							: 'PENGATURAN')
	);

	onMount(() => {
		let active = true;
		loadCachedClub();
		void getClub(selectedClubId())
			.then((club) => {
				if (active) setCachedClub(club);
			})
			.catch(() => {
				if (active) setCachedClub(null);
			});
		return () => {
			active = false;
		};
	});
	$effect(() => onaccesschange?.(authState.club?.id === selectedClubId() ? authState.club : null));
</script>

<main class="min-h-dvh bg-[#f4f1e8] text-[#163630] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
	<aside
		class="border-b border-[#b9c5bb] bg-[#fffaf0] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0"
	>
		<nav
			class="flex border-b border-[#b9c5bb] lg:grid lg:overflow-visible lg:border-0 lg:px-4 lg:pt-7"
			aria-label="Navigasi utama"
		>
			{#each visibleLinks as link (link.href)}
				{@const Icon = link.icon}
				<a
					href={resolve(link.route, { clubId: selectedClubId() })}
					data-sveltekit-preload-data="hover"
					onmouseenter={() => void prefetchPublicSurface(link.href)}
					onfocus={() => void prefetchPublicSurface(link.href)}
					aria-current={current === link.href ? 'page' : undefined}
					class={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-r border-[#b9c5bb] px-1 text-center text-[10px] font-black transition last:border-r-0 lg:flex-row lg:justify-start lg:gap-2 lg:border-r-0 lg:border-b lg:px-3 lg:text-left lg:text-xs ${current === link.href ? 'bg-[#163630] text-[#fffaf0] lg:border-[#163630]' : 'text-[#527169] hover:bg-[#e5ece5]'}`}
					><Icon size={16} strokeWidth={2.25} /><span>{link.label}</span></a
				>
			{/each}
		</nav>
		<div class="px-4 py-4 lg:mt-auto lg:border-t lg:border-[#b9c5bb] lg:px-6 lg:py-6">
			<div class="flex min-w-0 items-stretch gap-3 lg:block">
				<a
					class="flex min-w-0 flex-1 items-center gap-3"
					href={resolve('/clubs/[clubId]/live', { clubId: selectedClubId() })}
					data-sveltekit-preload-data="hover"
				>
					<span
						class="grid size-10 shrink-0 place-items-center bg-[#163630] text-xs font-black tracking-[-0.1em] text-[#f5bb61] shadow-[0_6px_14px_rgba(22,54,48,0.18)]"
						>{clubName.slice(0, 2).toUpperCase()}</span
					>
					<span class="min-w-0"
						><span class="block truncate text-sm font-black tracking-tight">{clubName}</span><span
							class="mt-0.5 block text-[11px] font-black tracking-[0.12em] text-[#527169]"
							>KLUB BULUTANGKIS</span
						></span
					>
				</a>
				{#if headerActions}<div
						class="flex min-h-11 min-w-0 flex-1 items-center lg:mt-4 lg:border-t lg:border-[#b9c5bb] lg:pt-4"
					>
						{@render headerActions()}
					</div>{/if}
			</div>
			<div class="mt-3 flex items-center gap-4 border-t border-[#b9c5bb] pt-1">
				<button class="min-h-11 flex-1 text-left text-xs font-bold underline" onclick={copyClubLink}
					>Salin tautan klub</button
				>
				<a
					href={resolve('/start')}
					class="flex min-h-11 flex-1 items-center text-xs font-bold underline"
					>Akun &amp; klub saya</a
				>
			</div>
			{#if shareNotice}<p role="status" class="text-xs leading-5">{shareNotice}</p>{/if}
			<p class="mt-4 hidden text-xs leading-5 text-[#527169] lg:block">
				Courtside · Teman mengelola sesi klub.
			</p>
		</div>
	</aside>
	<section class="relative overflow-hidden px-4 py-5 sm:px-6 lg:px-12 lg:py-8">
		<p
			class="pointer-events-none absolute top-5 right-[-0.08em] z-0 text-right text-[clamp(5rem,15vw,13rem)] leading-[0.75] font-black tracking-[-0.04em] break-words text-[#163630]/[0.06] select-none"
			aria-hidden="true"
		>
			{activeMode}
		</p>
		<div class="relative z-10 mx-auto max-w-2xl">
			{@render children()}
		</div>
	</section>
</main>
