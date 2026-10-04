<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
	import { ArrowRight } from '@lucide/svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import {
		getPublicClub,
		getPublicPlayerProfile,
		getPublicPlayerRecentSessions,
		getPublicRoster,
		type PublicPlayerProfile,
		type PublicPlayerSession
	} from '$lib/data/dashboard';
	let { params }: { params: { id: string } } = $props();
	let clubName = $state('PB NEWBIE');
	let player = $state<PublicPlayerProfile | null>(null);
	let sessions = $state<PublicPlayerSession[]>([]);
	let loading = $state(true);
	let statisticsAvailable = $state(true);
	const date = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
	if (browser)
		void (async () => {
			try {
				const club = await getPublicClub();
				clubName = club?.name ?? clubName;
				try {
					[player, sessions] = await Promise.all([
						getPublicPlayerProfile(params.id),
						getPublicPlayerRecentSessions(params.id)
					]);
				} catch {
					const member = club
						? (await getPublicRoster(club.id)).find((item) => item.id === params.id)
						: null;
					player = member ? { ...member, sessions: 0, sets: 0, wins: 0, losses: 0 } : null;
					statisticsAvailable = false;
				}
			} finally {
				loading = false;
			}
		})();
</script>

<svelte:head><title>{player?.display_name ?? 'Pemain'} — PB NEWBIE</title></svelte:head>
<AppShell current="/players" mode={player?.display_name ?? 'PEMAIN'} {clubName}>
	<a
		href={resolve('/players')}
		class="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#38675b]"
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
				class="mt-7 grid grid-cols-2 border border-[#b9c5bb] bg-[#fffaf0] sm:grid-cols-4"
				aria-hidden="true"
			>
				{#each ['Sesi', 'Set', 'Menang', 'Kalah'] as stat (stat)}<div
						class="border-r border-b border-[#b9c5bb] p-4 last:border-r-0"
					>
						<div class="w-12"><LoadingSkeleton height="1.75rem" /></div>
						<span class="mt-2 block text-sm">{stat}</span>
					</div>{/each}
			</div>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Rating</h2>
				<div class="mt-3 w-3/4"><LoadingSkeleton /></div>
			</section>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Sesi terbaru</h2>
				<div class="mt-3 border-y border-[#b9c5bb] bg-[#fffaf0]" aria-hidden="true">
					{#each [1, 2] as row (row)}<div
							class="flex min-h-12 items-center border-b border-[#e5ece5] px-4 last:border-0"
						>
							<div class="w-1/3"><LoadingSkeleton /></div>
						</div>{/each}
				</div>
			</section>
		</section>
	{:else if player}<section class="mt-6">
			<h1 class="max-w-[12ch] text-5xl font-black tracking-[-0.065em] text-[#163630] sm:text-6xl">
				{player.display_name}
			</h1>
			<p class="mt-3 text-xs font-black tracking-[0.12em] text-[#527169]">
				{player.membership_type === 'MEMBER' ? 'ANGGOTA KLUB' : 'TAMU KLUB'}
			</p>
			<section class="mt-9 border-y border-[#b9c5bb]">
				<div class="flex items-baseline justify-between gap-4 px-1 py-4">
					<h2 class="text-2xl font-black tracking-[-0.04em]">Jejak sesi</h2>
					{#if statisticsAvailable}<span class="text-sm font-black text-[#38675b]"
							>{player.sessions} hadir</span
						>{/if}
				</div>
				{#if sessions.length}<ul>
						{#each sessions as session, index (session.id)}<li class="border-t border-[#b9c5bb]">
								<a
									class="group grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-4 px-1 py-3 hover:bg-[#e5ece5]"
									href={resolve('/history/[id]', { id: session.id })}
									><span class="text-2xl font-black text-[#38675b] tabular-nums"
										>{String(index + 1).padStart(2, '0')}</span
									><span
										><b class="block text-xl tracking-[-0.03em]">{date(session.started_at)}</b><span
											class="mt-1 block text-xs font-black tracking-[0.1em] text-[#527169]"
											>SESI KLUB</span
										></span
									><ArrowRight
										class="shrink-0 text-[#38675b] transition-transform group-hover:translate-x-1"
										size={18}
									/></a
								>
							</li>{/each}
					</ul>{:else}<p class="border-t border-[#b9c5bb] py-5 text-sm leading-6 text-[#527169]">
						{statisticsAvailable
							? 'Belum ada sesi yang tercatat.'
							: 'Riwayat personal akan tersedia setelah read model diterapkan.'}
					</p>{/if}
			</section>
			{#if statisticsAvailable}<section class="mt-9 border-y border-[#b9c5bb]">
					<div class="grid grid-cols-2 sm:grid-cols-4">
						<p class="border-r border-b border-[#b9c5bb] p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.sessions}</b>Sesi
						</p>
						<p class="border-r border-b border-[#b9c5bb] p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.sets}</b>Set
						</p>
						<p class="border-r border-[#b9c5bb] p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.wins}</b>Menang
						</p>
						<p class="p-4 text-sm">
							<b class="block text-2xl tabular-nums">{player.losses}</b>Kalah
						</p>
					</div>
				</section>{:else}<p
					class="mt-9 border-y border-[#b9c5bb] py-4 text-sm leading-6 text-[#527169]"
				>
					Statistik akan tersedia setelah read model profil pemain diterapkan.
				</p>{/if}
			<section class="mt-9 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Rating</h2>
				<p class="mt-2 text-sm leading-6 text-[#527169]">
					Belum cukup data match untuk menampilkan rating.
				</p>
			</section>
		</section>
	{:else}<section class="mt-7 border border-[#b9c5bb] bg-[#fffaf0] p-6">
			<h1 class="text-2xl font-black">Pemain tidak ditemukan.</h1>
			<p class="mt-2 text-sm text-[#527169]">Profil ini mungkin sudah tidak aktif.</p>
		</section>{/if}
</AppShell>
