<script lang="ts">
	import { browser } from '$app/environment';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import CourtLoading from '$lib/components/ui/CourtLoading.svelte';
	import { getPublicClub, getPublicSessionHistory, getPublicSessionMatches, type PublicSessionHistory, type PublicSessionMatch } from '$lib/data/dashboard';
	let { params }: { params: { id: string } } = $props(); let clubName = $state('PB NEWBIE'); let session = $state<PublicSessionHistory | null>(null); let matches = $state<PublicSessionMatch[]>([]); let loading = $state(true);
	const date = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
	const time = (value: string) => new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
	if (browser) void (async () => { try { const [club, sessions] = await Promise.all([getPublicClub(), getPublicSessionHistory()]); clubName = club?.name ?? clubName; session = sessions.find((item) => item.id === params.id && item.closed_at) ?? null; if (session) matches = await getPublicSessionMatches(params.id); } finally { loading = false; } })();
</script>
<svelte:head><title>Detail sesi — PB NEWBIE</title></svelte:head>
<AppShell current="/history" {clubName}>
	<a href="/history" class="text-sm font-black text-[#38675b]">‹ Riwayat</a>
	{#if loading}<div class="mt-7"><CourtLoading label="Membuka catatan sesi…" /></div>
	{:else if session}<section class="mt-6"><h1 class="text-3xl font-black tracking-[-0.05em]">{date(session.started_at)}</h1><p class="mt-2 text-sm font-bold text-[#527169]">{time(session.started_at)} — {session.closed_at ? time(session.closed_at) : ''} · {session.attendance} pemain</p><section class="mt-7 border-t border-[#b9c5bb] pt-5"><h2 class="text-xl font-black">Match</h2>{#if matches.length}<ol class="mt-4 grid gap-3">{#each matches as match (match.id)}<li class="border border-[#b9c5bb] bg-[#fffaf0] p-5"><div class="flex items-center justify-between gap-3"><b>Match {match.sequence_number}</b><span class="text-xs font-black text-[#527169]">{match.status === 'COMPLETED' ? 'SELESAI' : match.status}</span></div><div class="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><p class="font-bold">{match.team_a.join(' + ') || '—'}</p><span class="font-black text-[#e2653e]">VS</span><p class="font-bold">{match.team_b.join(' + ') || '—'}</p></div><div class="mt-4 flex flex-wrap gap-2">{#if match.set_one_a !== null}<span class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-sm font-bold">Set 1 · {match.set_one_a}–{match.set_one_b}</span>{/if}{#if match.set_two_a !== null}<span class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-sm font-bold">Set 2 · {match.set_two_a}–{match.set_two_b}</span>{/if}</div></li>{/each}</ol>{:else}<p class="mt-2 text-sm text-[#527169]">Tidak ada match yang selesai pada sesi ini.</p>{/if}</section></section>
	{:else}<section class="mt-7 border border-[#b9c5bb] bg-[#fffaf0] p-6"><h1 class="text-2xl font-black">Sesi tidak ditemukan.</h1><p class="mt-2 text-sm text-[#527169]">Detail hanya tersedia untuk sesi yang sudah selesai.</p></section>{/if}
</AppShell>
