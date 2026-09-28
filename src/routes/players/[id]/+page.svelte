<script lang="ts">
	import { browser } from '$app/environment';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import CourtLoading from '$lib/components/ui/CourtLoading.svelte';
	import { getPublicClub, getPublicPlayerProfile, getPublicPlayerRecentSessions, getPublicRoster, type PublicPlayerProfile, type PublicPlayerSession } from '$lib/data/dashboard';
	let { params }: { params: { id: string } } = $props();
	let clubName = $state('PB NEWBIE'); let player = $state<PublicPlayerProfile | null>(null); let sessions = $state<PublicPlayerSession[]>([]); let loading = $state(true); let statisticsAvailable = $state(true);
	const date = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
	if (browser) void (async () => {
		try {
			const club = await getPublicClub(); clubName = club?.name ?? clubName;
			try { [player, sessions] = await Promise.all([getPublicPlayerProfile(params.id), getPublicPlayerRecentSessions(params.id)]); }
			catch {
				const member = club ? (await getPublicRoster(club.id)).find((item) => item.id === params.id) : null;
				player = member ? { ...member, sessions: 0, sets: 0, wins: 0, losses: 0 } : null;
				statisticsAvailable = false;
			}
		} finally { loading = false; }
	})();
</script>
<svelte:head><title>{player?.display_name ?? 'Pemain'} — PB NEWBIE</title></svelte:head>
<AppShell current="/players" {clubName}>
	<a href="/players" class="text-sm font-black text-[#38675b]">‹ Semua pemain</a>
	{#if loading}<div class="mt-7"><CourtLoading label="Membuka profil pemain…" /></div>
	{:else if player}<section class="mt-6"><h1 class="text-4xl font-black tracking-[-0.06em]">{player.display_name}</h1><p class="mt-2 text-sm font-bold text-[#527169]">Member klub</p>{#if statisticsAvailable}<div class="mt-7 grid grid-cols-2 border border-[#b9c5bb] bg-[#fffaf0] sm:grid-cols-4"><p class="border-b border-r border-[#b9c5bb] p-4 text-sm"><b class="block text-2xl">{player.sessions}</b>Sesi</p><p class="border-b border-r border-[#b9c5bb] p-4 text-sm"><b class="block text-2xl">{player.sets}</b>Set</p><p class="border-b border-r border-[#b9c5bb] p-4 text-sm"><b class="block text-2xl">{player.wins}</b>Menang</p><p class="border-b border-[#b9c5bb] p-4 text-sm"><b class="block text-2xl">{player.losses}</b>Kalah</p></div>{:else}<p class="mt-7 border border-[#b9c5bb] bg-[#fffaf0] p-4 text-sm leading-6 text-[#527169]">Statistik akan tersedia setelah read model profil pemain diterapkan.</p>{/if}<section class="mt-7 border-t border-[#b9c5bb] pt-5"><h2 class="text-xl font-black">Rating</h2><p class="mt-2 text-sm leading-6 text-[#527169]">Belum cukup data match untuk menampilkan rating.</p></section><section class="mt-7 border-t border-[#b9c5bb] pt-5"><h2 class="text-xl font-black">Sesi terbaru</h2>{#if sessions.length}<ul class="mt-3 border border-[#b9c5bb] bg-[#fffaf0]">{#each sessions as session (session.id)}<li class="border-b border-[#b9c5bb] last:border-b-0"><a class="flex min-h-12 items-center justify-between px-4 font-bold hover:bg-[#e5ece5]" href={`/history/${session.id}`}>{date(session.started_at)}<span class="text-[#38675b]">›</span></a></li>{/each}</ul>{:else}<p class="mt-2 text-sm text-[#527169]">{statisticsAvailable ? 'Belum ada sesi yang tercatat.' : 'Riwayat personal akan tersedia setelah read model diterapkan.'}</p>{/if}</section></section>
	{:else}<section class="mt-7 border border-[#b9c5bb] bg-[#fffaf0] p-6"><h1 class="text-2xl font-black">Pemain tidak ditemukan.</h1><p class="mt-2 text-sm text-[#527169]">Profil ini mungkin sudah tidak aktif.</p></section>{/if}
</AppShell>
