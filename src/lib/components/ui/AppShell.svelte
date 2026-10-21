<script lang="ts">
	import { resolve } from '$app/paths';
	import { clubHref, selectedClubId } from '$lib/club-context';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { getClub, prefetchPublicSurface, type Club } from '$lib/data/dashboard';
	import { authState, loadCachedClub, setCachedClub } from '$lib/auth-state.svelte';
	import { History, Radio, Settings, UsersRound, Wallet, Share2, UserRound } from '@lucide/svelte';
	import Avatar from './Avatar.svelte';
	import BrandMark from './BrandMark.svelte';

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
		{ href: '/live', route: '/clubs/[clubId]/live', label: 'Live', icon: Radio },
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

<div class="app-shell">
	<aside class="app-sidebar">
		<a class="app-brand" href={resolve('/')}><BrandMark />Courtside</a>
		<p class="sidebar-note">Ruang klubmu.</p>
		<nav class="app-navigation" aria-label="Navigasi utama">
			{#each visibleLinks.filter((link) => link.href !== '/settings') as link (link.href)}
				{@const Icon = link.icon}
				<a
					href={resolve(link.route, { clubId: selectedClubId() })}
					data-sveltekit-preload-data="hover"
					onmouseenter={() => void prefetchPublicSurface(link.href).catch(() => {})}
					onfocus={() => void prefetchPublicSurface(link.href).catch(() => {})}
					aria-current={current === link.href ? 'page' : undefined}
					class:active={current === link.href}
				>
					<Icon size={20} strokeWidth={1.8} /><span>{link.label}</span>
				</a>
			{/each}
		</nav>
		<div class="sidebar-footer">
			<span class="sidebar-logo"><BrandMark size={20} /></span><span
				>Teman main klub.<br />Catatan tetap rapi.</span
			>
		</div>
	</aside>
	<div class="app-workspace">
		<header class="club-header">
			<a class="club-identity" href={resolve('/clubs/[clubId]/live', { clubId: selectedClubId() })}>
				<Avatar name={clubName} size="sm" /><strong>{clubName}</strong>
			</a>
			<div class="club-tools">
				{#if authState.club?.id === selectedClubId() && authState.club?.is_club_admin}<span
						class="access-badge">Admin</span
					><a
						class="icon-control"
						href={resolve('/clubs/[clubId]/settings', { clubId: selectedClubId() })}
						aria-label="Pengaturan"><Settings size={19} /></a
					>{/if}
				<button class="icon-control" onclick={copyClubLink} aria-label="Salin tautan klub"
					><Share2 size={18} /></button
				>
				{#if headerActions}<details class="account-menu">
						<summary class="icon-control" aria-label="Akun dan klub saya"
							><UserRound size={19} /></summary
						>
						<div class="account-popover">
							<a href={resolve('/start')}>Akun &amp; klub saya</a>{@render headerActions()}
						</div>
					</details>{:else}<a
						class="icon-control"
						href={resolve('/start')}
						aria-label="Akun dan klub saya"><UserRound size={19} /></a
					>{/if}
			</div>
		</header>
		{#if shareNotice}<p role="status" class="share-notice">{shareNotice}</p>{/if}
		<main id="club-content" class="club-content">
			<span class="sr-only">{activeMode}</span>{@render children()}
		</main>
	</div>
</div>

<style>
	.account-menu {
		position: relative;
	}
	.account-menu summary {
		cursor: pointer;
		list-style: none;
	}
	.account-menu summary::-webkit-details-marker {
		display: none;
	}
	.account-popover {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 45;
		min-width: 190px;
		border: 1px solid var(--court-line);
		border-radius: 10px;
		background: var(--court-chalk);
		padding: 8px;
		box-shadow: 0 12px 32px rgb(22 54 48 / 12%);
	}
	.account-popover > a {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 10px 12px;
		font-size: 12px;
		font-weight: 700;
		border-radius: 6px;
	}
	.account-popover > a:hover {
		background: var(--court-soft);
	}

	.app-shell {
		min-height: 100dvh;
		background: var(--court-ground);
		color: var(--court-ink);
	}
	.app-sidebar {
		background: var(--court-chalk);
	}
	.app-brand,
	.sidebar-note,
	.sidebar-footer {
		display: none;
	}
	.app-navigation {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 35;
		display: flex;
		justify-content: space-around;
		background: var(--court-chalk);
		border-top: 1px solid var(--court-line);
		padding: 6px 8px max(8px, env(safe-area-inset-bottom));
	}
	.app-navigation a {
		position: relative;
		display: flex;
		min-height: 48px;
		min-width: 58px;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		color: var(--court-muted);
		font-size: 10px;
		font-weight: 650;
		border-radius: 6px;
	}
	.app-navigation a.active {
		color: var(--court-action-deep);
	}
	.app-navigation a.active:before {
		content: '';
		position: absolute;
		top: -7px;
		left: 25%;
		right: 25%;
		height: 2px;
		background: var(--court-action);
	}
	.app-navigation a:hover {
		background: var(--court-soft);
	}
	.app-workspace {
		min-width: 0;
		max-width: 1160px;
		margin: auto;
	}
	.club-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 18px 20px;
		background: var(--court-chalk);
	}
	.club-identity {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 10px;
	}
	.club-identity strong {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 15px;
		font-weight: 800;
		letter-spacing: -0.025em;
	}
	.club-tools {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}
	.icon-control {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 6px;
		color: var(--court-ink);
	}
	.icon-control:hover {
		background: var(--court-soft);
	}
	.access-badge {
		display: none;
		font-size: 11px;
		background: var(--court-soft);
		padding: 5px 10px;
		border-radius: 20px;
		font-weight: 700;
	}
	.club-content {
		max-width: 800px;
		margin: auto;
		padding: 20px 20px calc(96px + env(safe-area-inset-bottom));
	}
	.share-notice {
		max-width: 800px;
		padding: 8px 20px;
		margin: auto;
		font-size: 12px;
		color: var(--court-muted);
	}
	@media (min-width: 768px) {
		.access-badge {
			display: block;
		}
		.club-header {
			padding: 22px 36px;
		}
		.club-content {
			padding: 28px 36px calc(96px + env(safe-area-inset-bottom));
		}
	}
	@media (min-width: 1024px) {
		.club-content {
			padding-bottom: 48px;
		}
		.app-shell {
			display: grid;
			grid-template-columns: 224px minmax(0, 1fr);
		}
		.app-sidebar {
			position: sticky;
			top: 0;
			align-self: start;
			height: 100dvh;
			border-right: 1px solid var(--court-line);
			padding: 30px 20px;
			display: flex;
			flex-direction: column;
		}
		.app-brand {
			display: flex;
			gap: 8px;
			align-items: center;
			font-size: 22px;
			font-weight: 800;
			letter-spacing: -0.04em;
		}
		.sidebar-note {
			display: block;
			font-size: 12px;
			color: var(--court-muted);
			margin: 10px 0 36px 34px;
		}
		.app-navigation {
			position: static;
			display: grid;
			border: 0;
			padding: 0;
			gap: 6px;
		}
		.app-navigation a {
			flex-direction: row;
			justify-content: flex-start;
			padding: 12px 16px;
			gap: 14px;
			font-size: 13px;
		}
		.app-navigation a.active {
			color: var(--court-ink);
			background: var(--court-soft);
		}
		.app-navigation a.active:before {
			display: none;
		}
		.sidebar-footer {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-top: auto;
			padding-top: 24px;
			border-top: 1px solid var(--court-line);
			font-size: 11px;
			line-height: 1.7;
			color: var(--court-muted);
		}
		.sidebar-logo {
			opacity: 0.65;
		}
	}
	@media (max-width: 380px) {
		.club-header {
			padding: 12px 14px;
		}
		.club-identity {
			gap: 7px;
		}
		.club-identity strong {
			max-width: 140px;
		}
		.club-identity :global(.avatar) {
			display: none;
		}
		.club-tools {
			gap: 0;
		}
		.icon-control {
			width: 44px;
		}
		.club-content {
			padding-left: 16px;
			padding-right: 16px;
		}
	}
</style>
