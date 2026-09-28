<script lang="ts">
	import { browser } from '$app/environment';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import CourtLoading from '$lib/components/ui/CourtLoading.svelte';
	import { getPublicClub, getPublicFundActivity, getPublicFundSummary, type PublicFundActivity, type PublicFundSummary } from '$lib/data/dashboard';
	let clubName = $state('PB NEWBIE'); let summary = $state<PublicFundSummary | null>(null); let activity = $state<PublicFundActivity[]>([]); let loading = $state(true);
	const money = (value: number) => `Rp${value.toLocaleString('id-ID')}`; const date = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
	if (browser) void (async () => { try { const club = await getPublicClub(); clubName = club?.name ?? clubName; summary = await getPublicFundSummary(); try { activity = await getPublicFundActivity(); } catch { activity = []; } } finally { loading = false; } })();
</script>
<svelte:head><title>Dana klub — PB NEWBIE</title></svelte:head>
<AppShell current="/fund" {clubName}>
	{#if loading}<CourtLoading label="Membuka dana klub…" />{:else}<section class="bg-[#163630] p-6 text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.17)]"><h1 class="text-2xl font-black tracking-[-0.04em]">Dana klub</h1><p class="mt-6 text-sm font-bold text-[#a7c5b9]">Saldo klub</p><p class="mt-1 text-4xl font-black tracking-[-0.06em]">{money(summary?.balance ?? 0)}</p></section>
	<section class="mt-5 grid grid-cols-2 border border-[#b9c5bb] bg-[#fffaf0]"><p class="border-r border-[#b9c5bb] p-5 text-sm"><span class="block text-[#527169]">Dana masuk</span><b class="mt-1 block text-xl">{money(summary?.received ?? 0)}</b></p><p class="p-5 text-sm"><span class="block text-[#527169]">Pengeluaran</span><b class="mt-1 block text-xl">{money(summary?.expenses ?? 0)}</b></p></section>{/if}
	{#if !loading}<section class="mt-7 border-t border-[#b9c5bb] pt-5"><div class="flex items-baseline justify-between"><h2 class="text-xl font-black">Aktivitas terbaru</h2></div>{#if activity.length}<ul class="mt-4 border border-[#b9c5bb] bg-[#fffaf0]">{#each activity as item (item.id)}<li class="flex min-h-14 items-center justify-between gap-4 border-b border-[#b9c5bb] px-4 py-3 last:border-b-0"><span><b class="block">{item.label}</b><span class="text-xs text-[#527169]">{date(item.occurred_at)}</span></span><b class={item.amount >= 0 ? 'text-[#38675b]' : 'text-[#9a3d25]'}>{item.amount >= 0 ? '+' : '−'}{money(Math.abs(item.amount))}</b></li>{/each}</ul>{:else}<div class="mt-4 border border-[#b9c5bb] bg-[#fffaf0] p-6"><p class="text-lg font-black">Belum ada aktivitas dana.</p><p class="mt-2 max-w-sm text-sm leading-6 text-[#527169]">Dana yang diterima dari sesi serta biaya lapangan dan kok akan muncul di sini setelah dicatat.</p></div>{/if}</section>{/if}
</AppShell>
