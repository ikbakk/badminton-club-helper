<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import {
		getPublicClub,
		getPublicSessionAttendance,
		getPublicSessionFinanceRecap,
		getPublicSessionHistory,
		getPublicSessionMatches,
		type PublicSessionAttendee,
		type PublicSessionFinanceRecap,
		type PublicSessionHistory,
		type PublicSessionMatch
	} from '$lib/data/dashboard';
	let { params }: { params: { id: string } } = $props();
	let clubName = $state('PB NEWBIE');
	let session = $state<PublicSessionHistory | null>(null);
	let matches = $state<PublicSessionMatch[]>([]);
	let attendees = $state<PublicSessionAttendee[]>([]);
	let financeRecap = $state<PublicSessionFinanceRecap | null>(null);
	let cardUrl = $state('');
	let shareNotice = $state('');
	let loading = $state(true);
	const date = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(
			new Date(value)
		);
	const time = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(
			new Date(value)
		);
	const money = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
	if (browser)
		void (async () => {
			try {
				const [club, sessions] = await Promise.all([getPublicClub(), getPublicSessionHistory()]);
				clubName = club?.name ?? clubName;
				session = sessions.find((item) => item.id === params.id && item.closed_at) ?? null;
				if (session) {
					[matches, attendees, financeRecap] = await Promise.all([
						getPublicSessionMatches(params.id),
						getPublicSessionAttendance(params.id),
						getPublicSessionFinanceRecap(params.id)
					]);
				}
			} finally {
				loading = false;
			}
		})();

	function recapText() {
		if (!session) return '';
		const dateText = new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(session.started_at));
		const expenseTotal =
			(financeRecap?.court_expenses ?? 0) +
			(financeRecap?.shuttlecock_expenses ?? 0) +
			(financeRecap?.other_expenses ?? 0);
		const completedSets = matches.reduce(
			(sum, match) => sum + Number(match.set_one_a !== null) + Number(match.set_two_a !== null),
			0
		);
		return [
			`${clubName} — ${dateText}`,
			`Pemain: ${session.attendance} · Match: ${matches.length} · Set: ${completedSets}`,
			financeRecap?.fee_per_person
				? `Biaya: ${money(financeRecap.fee_per_person)} / orang`
				: 'Biaya sesi belum dikonfirmasi',
			financeRecap?.expected_fees ? `Perkiraan iuran: ${money(financeRecap.expected_fees)}` : '',
			expenseTotal
				? `Pengeluaran resmi: ${money(expenseTotal)}`
				: 'Belum ada pengeluaran resmi tercatat'
		]
			.filter(Boolean)
			.join('\n');
	}

	async function shareRecap() {
		const text = recapText();
		try {
			if (navigator.share) await navigator.share({ title: `${clubName} — Recap`, text });
			else {
				await navigator.clipboard.writeText(text);
				shareNotice = 'Ringkasan disalin. Tempelkan ke WhatsApp.';
			}
		} catch (error) {
			if (error instanceof Error && error.name !== 'AbortError')
				shareNotice = 'Ringkasan belum dapat dibagikan.';
		}
	}

	function createShareCard() {
		if (!session) return;
		const canvas = document.createElement('canvas');
		canvas.width = 1080;
		canvas.height = 1350;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#163630';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = 'rgba(255,250,240,.12)';
		ctx.lineWidth = 2;
		for (let x = 60; x < 1080; x += 240) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, 1350);
			ctx.stroke();
		}
		ctx.fillStyle = '#f5bb61';
		ctx.font = '700 28px system-ui';
		ctx.fillText(`${clubName.toUpperCase()} · CATATAN SESI`, 76, 102, 920);
		ctx.fillStyle = '#fffaf0';
		ctx.font = '800 72px system-ui';
		ctx.fillText(
			new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long' }).format(
				new Date(session.started_at)
			),
			76,
			220,
			920
		);
		ctx.font = '600 34px system-ui';
		ctx.fillStyle = '#c8d9d0';
		ctx.fillText(`${session.attendance} pemain  ·  ${matches.length} match`, 78, 286);
		ctx.strokeStyle = '#78948a';
		ctx.beginPath();
		ctx.moveTo(76, 340);
		ctx.lineTo(1004, 340);
		ctx.stroke();
		let y = 410;
		for (const match of matches.slice(0, 5)) {
			ctx.fillStyle = '#fffaf0';
			ctx.font = '700 28px system-ui';
			ctx.fillText(`MATCH ${match.sequence_number}`, 80, y);
			ctx.font = '500 24px system-ui';
			ctx.fillStyle = '#c8d9d0';
			ctx.fillText(
				`${match.team_a.join(' + ')}   VS   ${match.team_b.join(' + ')}`,
				80,
				y + 42,
				900
			);
			ctx.fillStyle = '#f5bb61';
			ctx.font = '700 26px system-ui';
			const scores = [
				match.set_one_a !== null ? `${match.set_one_a}–${match.set_one_b}` : '',
				match.set_two_a !== null ? `${match.set_two_a}–${match.set_two_b}` : ''
			]
				.filter(Boolean)
				.join('     ');
			ctx.fillText(scores || 'Hasil belum tercatat', 80, y + 82);
			y += 138;
		}
		if (matches.length > 5) {
			ctx.fillStyle = '#c8d9d0';
			ctx.font = '500 22px system-ui';
			ctx.fillText(`+ ${matches.length - 5} match lainnya`, 80, 1120);
		}
		const expenses =
			(financeRecap?.court_expenses ?? 0) +
			(financeRecap?.shuttlecock_expenses ?? 0) +
			(financeRecap?.other_expenses ?? 0);
		ctx.strokeStyle = '#78948a';
		ctx.beginPath();
		ctx.moveTo(76, 1190);
		ctx.lineTo(1004, 1190);
		ctx.stroke();
		ctx.fillStyle = '#fffaf0';
		ctx.font = '700 30px system-ui';
		ctx.fillText(
			financeRecap?.fee_per_person
				? `${money(financeRecap.fee_per_person)} / orang`
				: 'Biaya belum dikonfirmasi',
			78,
			1250
		);
		ctx.fillStyle = '#c8d9d0';
		ctx.font = '500 25px system-ui';
		ctx.fillText(
			expenses ? `Pengeluaran resmi ${money(expenses)}` : 'Pengeluaran resmi belum tercatat',
			78,
			1300
		);
		cardUrl = canvas.toDataURL('image/png');
	}

	function downloadCard() {
		if (!cardUrl) return;
		const link = document.createElement('a');
		link.href = cardUrl;
		link.download = 'pb-newbie-recap.png';
		link.click();
	}

	async function shareCard() {
		if (!cardUrl) return;
		const response = await fetch(cardUrl);
		const file = new File([await response.blob()], 'pb-newbie-recap.png', { type: 'image/png' });
		try {
			if (navigator.canShare?.({ files: [file] }) && navigator.share)
				await navigator.share({ files: [file], title: `${clubName} — Recap` });
			else shareNotice = 'Kartu siap diunduh. Bagikan gambarnya ke WhatsApp.';
		} catch (error) {
			if (error instanceof Error && error.name !== 'AbortError')
				shareNotice = 'Kartu belum dapat dibagikan.';
		}
	}
</script>

<svelte:head><title>Detail sesi — PB NEWBIE</title></svelte:head>
<AppShell current="/history" {clubName}>
	<a href={resolve('/history')} class="text-sm font-black text-[#38675b]">‹ Riwayat</a>
	{#if loading}<section
			class="mt-6"
			role="status"
			aria-busy="true"
			aria-label="Membuka catatan sesi"
		>
			<div class="w-2/3"><LoadingSkeleton height="2rem" /></div>
			<div class="mt-3 w-1/2"><LoadingSkeleton height="0.75rem" /></div>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Hadir</h2>
				<div
					class="mt-3 grid border-y border-[#b9c5bb] bg-[#fffaf0] px-4 sm:grid-cols-2"
					aria-hidden="true"
				>
					{#each [1, 2, 3, 4] as row (row)}<div
							class="flex min-h-12 items-center border-b border-[#e5ece5]"
						>
							<div class="w-2/5"><LoadingSkeleton /></div>
						</div>{/each}
				</div>
			</section>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Match</h2>
				<div class="mt-4 grid gap-3" aria-hidden="true">
					{#each [1, 2] as row (row)}<div class="border border-[#b9c5bb] bg-[#fffaf0] p-5">
							<div class="w-20"><LoadingSkeleton /></div>
							<div class="mt-5 grid grid-cols-2 gap-4"><LoadingSkeleton /><LoadingSkeleton /></div>
							<div class="mt-5 w-20"><LoadingSkeleton height="2rem" /></div>
						</div>{/each}
				</div>
			</section>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Rekap dana sesi</h2>
				<div
					class="mt-3 divide-y divide-[#b9c5bb] border-y border-[#b9c5bb] bg-[#fffaf0] px-4"
					aria-hidden="true"
				>
					{#each [1, 2, 3, 4] as row (row)}<div class="flex min-h-12 items-center justify-between">
							<div class="w-1/3"><LoadingSkeleton /></div>
							<div class="w-20"><LoadingSkeleton /></div>
						</div>{/each}
				</div>
			</section>
		</section>
	{:else if session}<section class="mt-6">
			<h1 class="text-3xl font-black tracking-[-0.05em]">{date(session.started_at)}</h1>
			<p class="mt-2 text-sm font-bold text-[#527169]">
				{time(session.started_at)} — {session.closed_at ? time(session.closed_at) : ''} · {session.attendance}
				pemain
			</p>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Hadir & pembayaran ({attendees.length})</h2>
				<ul
					class="mt-3 grid gap-1 text-xs leading-5 font-bold text-[#38675b]"
					aria-label="Keterangan warna status pembayaran"
				>
					<li class="flex items-center gap-2">
						<span class="size-3 shrink-0 bg-[#dceadf]"></span><b>Hijau:</b> lunas
					</li>
					<li class="flex items-center gap-2">
						<span class="size-3 shrink-0 bg-[#f9e0d8]"></span><b>Terakota:</b> belum bayar
					</li>
					<li class="flex items-center gap-2">
						<span class="size-3 shrink-0 bg-[#e5e9e6]"></span><b>Abu-abu:</b> iuran belum ditetapkan
					</li>
				</ul>
				{#if attendees.length}<ul
						class="mt-3 grid gap-x-6 border-y border-[#b9c5bb] bg-[#fffaf0] px-4 sm:grid-cols-2"
					>
						{#each attendees as attendee (attendee.player_id)}<li
								class={`flex min-h-12 items-center justify-between gap-3 border-b border-[#fffaf0]/70 px-3 text-sm last:border-0 ${attendee.is_paid === null ? 'bg-[#e5e9e6]' : attendee.is_paid ? 'bg-[#dceadf]' : 'bg-[#f9e0d8]'}`}
							>
								<b>{attendee.display_name}</b><span
									class="flex items-center gap-3 text-xs font-bold text-[#527169]"
									>{attendee.membership_type === 'GUEST' ? 'Tamu' : 'Anggota klub'}<span
										class="sr-only"
										role="img"
										aria-label={attendee.is_paid === null
											? 'Iuran belum ditetapkan'
											: attendee.is_paid
												? 'Lunas'
												: 'Belum bayar'}
										>{attendee.is_paid === null
											? 'Iuran belum ditetapkan'
											: attendee.is_paid
												? 'Lunas'
												: 'Belum bayar'}</span
									></span
								>
							</li>{/each}
					</ul>{:else}<p class="mt-2 text-sm text-[#527169]">
						Daftar hadir tidak tersedia untuk sesi ini.
					</p>{/if}
			</section>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Match</h2>
				{#if matches.length}<ol class="mt-4 grid gap-3">
						{#each matches as match (match.id)}<li class="border border-[#b9c5bb] bg-[#fffaf0] p-5">
								<div class="flex items-center justify-between gap-3">
									<b>Match {match.sequence_number}</b><span
										class="text-xs font-black text-[#527169]"
										>{match.status === 'COMPLETED' ? 'SELESAI' : match.status}</span
									>
								</div>
								<div class="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
									<p class="font-bold">{match.team_a.join(' + ') || '—'}</p>
									<span class="font-black text-[#e2653e]">VS</span>
									<p class="font-bold">{match.team_b.join(' + ') || '—'}</p>
								</div>
								<div class="mt-4 flex flex-wrap gap-2">
									{#if match.set_one_a !== null}<span
											class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-sm font-bold"
											>Set 1 · {match.set_one_a}–{match.set_one_b}</span
										>{/if}{#if match.set_two_a !== null}<span
											class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-sm font-bold"
											>Set 2 · {match.set_two_a}–{match.set_two_b}</span
										>{/if}
								</div>
							</li>{/each}
					</ol>{:else}<p class="mt-2 text-sm text-[#527169]">
						Tidak ada match yang selesai pada sesi ini.
					</p>{/if}
			</section>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Rekap dana sesi</h2>
				{#if financeRecap}<dl
						class="mt-3 divide-y divide-[#b9c5bb] border-y border-[#b9c5bb] bg-[#fffaf0] px-4"
					>
						<div class="flex min-h-12 items-center justify-between gap-4">
							<dt>Biaya per orang</dt>
							<dd class="font-black">
								{financeRecap.fee_per_person
									? money(financeRecap.fee_per_person)
									: 'Belum ditetapkan'}
							</dd>
						</div>
						<div class="flex min-h-12 items-center justify-between gap-4">
							<dt>Perkiraan iuran sesi</dt>
							<dd class="font-black">{money(financeRecap.expected_fees)}</dd>
						</div>
						<div class="flex min-h-12 items-center justify-between gap-4">
							<dt>Biaya lapangan resmi</dt>
							<dd class="font-black">{money(financeRecap.court_expenses)}</dd>
						</div>
						<div class="flex min-h-12 items-center justify-between gap-4">
							<dt>Biaya kok resmi</dt>
							<dd class="font-black">{money(financeRecap.shuttlecock_expenses)}</dd>
						</div>
						{#if financeRecap.other_expenses}<div
								class="flex min-h-12 items-center justify-between gap-4"
							>
								<dt>Pengeluaran lain</dt>
								<dd class="font-black">{money(financeRecap.other_expenses)}</dd>
							</div>{/if}
					</dl>
					<p class="mt-2 text-xs leading-5 text-[#527169]">
						Perkiraan iuran bukan jumlah pembayaran yang diterima. Pengeluaran hanya mencakup biaya
						resmi yang sudah dikonfirmasi.
					</p>{/if}
			</section>
			<section class="mt-7 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Bagikan sesi</h2>
				<div class="mt-3 flex flex-wrap gap-3">
					<button
						class="min-h-11 bg-[#e2653e] px-4 text-sm font-black text-[#163630] hover:bg-[#ef825e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163630]"
						onclick={shareRecap}>Bagikan ringkasan</button
					>
					<button
						class="min-h-11 border border-[#163630] px-4 text-sm font-black text-[#163630] hover:bg-[#e5ece5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#163630]"
						onclick={createShareCard}>Buat kartu recap</button
					>
				</div>
				{#if cardUrl}<div class="mt-4 max-w-sm border border-[#b9c5bb] bg-[#fffaf0] p-3">
						<img
							class="h-auto w-full"
							src={cardUrl}
							alt={`Kartu recap sesi ${date(session.started_at)}: ${session.attendance} pemain dan ${matches.length} match`}
						/>
						<div class="mt-3 flex flex-wrap gap-2">
							<button
								class="min-h-11 bg-[#163630] px-4 text-sm font-black text-[#fffaf0]"
								onclick={downloadCard}>Unduh kartu</button
							><button
								class="min-h-11 border border-[#163630] px-4 text-sm font-black"
								onclick={shareCard}>Bagikan gambar</button
							>
						</div>
					</div>{/if}
				{#if shareNotice}<p class="mt-3 text-sm font-bold text-[#38675b]" role="status">
						{shareNotice}
					</p>{/if}
			</section>
		</section>
	{:else}<section class="mt-7 border border-[#b9c5bb] bg-[#fffaf0] p-6">
			<h1 class="text-2xl font-black">Sesi tidak ditemukan.</h1>
			<p class="mt-2 text-sm text-[#527169]">
				Detail hanya tersedia untuk sesi yang sudah selesai.
			</p>
		</section>{/if}
</AppShell>
