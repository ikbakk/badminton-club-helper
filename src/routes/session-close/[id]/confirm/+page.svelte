<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { ArrowLeft, ArrowRight, CircleDollarSign, ClipboardCheck } from '@lucide/svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import {
		getPublicSessionAttendance,
		getPublicSessionHistory,
		type PublicSessionAttendee,
		type PublicSessionHistory
	} from '$lib/data/dashboard';

	let { params }: { params: { id: string } } = $props();
	let session = $state<PublicSessionHistory | null>(null);
	let attendees = $state<PublicSessionAttendee[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let paidCount = $derived(attendees.filter((person) => person.is_paid === true).length);
	let unpaidCount = $derived(attendees.filter((person) => person.is_paid === false).length);
	let feesConfirmed = $derived(Boolean(session?.fee_per_person));

	if (browser) {
		void (async () => {
			try {
				const history = await getPublicSessionHistory();
				session = history.find((item) => item.id === params.id && item.closed_at) ?? null;
				if (session) attendees = await getPublicSessionAttendance(params.id);
			} catch (error) {
				loadError = error instanceof Error ? error.message : 'Data sesi tidak dapat dimuat.';
			} finally {
				loading = false;
			}
		})();
	}
</script>

<svelte:head><title>Pastikan sebelum keluar — PB NEWBIE</title></svelte:head>

<AppShell current="" mode="REKAP SESI">
	<div class="mx-auto max-w-lg">
		{#if loading}
			<p class="mt-8 text-sm font-bold" role="status">Memeriksa iuran dan pembayaran…</p>
		{:else if loadError || !session}
			<section class="mt-8 border-y border-[#b9c5bb] py-6">
				<h1 class="text-2xl font-black">Rekap tidak tersedia</h1>
				<p class="mt-2 text-sm text-[#527169]">{loadError || 'Sesi tidak ditemukan.'}</p>
				<a
					class="mt-5 inline-flex min-h-11 items-center font-black text-[#38675b]"
					href={resolve('/live')}
				>
					<ArrowLeft class="mr-2" size={18} /> Kembali ke Live
				</a>
			</section>
		{:else}
			<section>
				<h1 class="text-3xl font-black tracking-[-0.05em]">Sesi selesai. Lanjut ke riwayat?</h1>
				<p class="mt-3 text-sm leading-6 text-[#527169]">
					Pastikan rekap sesi sudah benar. Kamu masih bisa kembali untuk mengubah checklist
					pembayaran.
				</p>

				<dl class="mt-6 divide-y divide-[#b9c5bb] border-y border-[#b9c5bb] bg-[#fffaf0] px-4">
					<div class="flex min-h-14 items-center justify-between gap-4">
						<dt class="flex items-center gap-2 text-sm font-bold">
							<ClipboardCheck size={17} /> Hadir
						</dt>
						<dd class="font-black tabular-nums">{session.attendance} pemain</dd>
					</div>
					<div class="flex min-h-14 items-center justify-between gap-4">
						<dt class="flex items-center gap-2 text-sm font-bold">
							<CircleDollarSign size={17} /> Pembayaran
						</dt>
						<dd class="text-right text-sm font-black tabular-nums">
							{#if feesConfirmed}{paidCount} lunas · {unpaidCount} belum
							{:else}Iuran belum dikonfirmasi{/if}
						</dd>
					</div>
				</dl>

				<p class="mt-4 border-l-2 border-[#e2653e] pl-3 text-sm leading-6 text-[#527169]">
					{#if feesConfirmed && unpaidCount > 0}
						Masih ada {unpaidCount} pembayaran yang belum ditandai. Kamu dapat kembali dan memperbaruinya
						kapan saja.
					{:else if !feesConfirmed}
						Iuran belum dikonfirmasi. Kamu dapat kembali untuk menetapkan iuran dan mencatat
						pembayaran.
					{:else}
						Semua pembayaran sudah ditandai lunas. Kamu tetap dapat kembali untuk mengubah
						checklist.
					{/if}
				</p>

				<div class="mt-7 grid gap-3">
					<a
						class="flex min-h-12 items-center justify-center gap-2 border border-[#163630] bg-[#fffaf0] px-4 text-sm font-black hover:bg-[#e5ece5]"
						href={resolve('/session-close/[id]', { id: params.id })}
					>
						<ArrowLeft size={18} /> Kembali edit iuran & pembayaran
					</a>
					<a
						class="flex min-h-12 items-center justify-center gap-2 bg-[#163630] px-4 text-sm font-black text-[#fffaf0] hover:bg-[#38675b]"
						href={resolve('/history/[id]', { id: params.id })}
					>
						Selesai & lihat riwayat <ArrowRight size={17} />
					</a>
				</div>
			</section>
		{/if}
	</div>
</AppShell>
