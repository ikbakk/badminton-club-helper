<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Share2 } from '@lucide/svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import CourtDialog from '$lib/components/ui/CourtDialog.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import {
		getPublicClub,
		getPublicSessionAttendance,
		getPublicSessionFinanceRecap,
		getPublicSessionHistory,
		getPublicSessionMatches,
		type Club,
		type PublicSessionAttendee,
		type PublicSessionFinanceRecap,
		type PublicSessionHistory,
		type PublicSessionMatch
	} from '$lib/data/dashboard';
	let { params }: { params: { id: string } } = $props();
	let clubName = $state('PB NEWBIE');
	let club = $state<Club | null>(null);
	let session = $state<PublicSessionHistory | null>(null);
	let matches = $state<PublicSessionMatch[]>([]);
	let attendees = $state<PublicSessionAttendee[]>([]);
	let financeRecap = $state<PublicSessionFinanceRecap | null>(null);
	let cardUrl = $state('');
	let shareNotice = $state('');
	let shareDialogOpen = $state(false);
	let loading = $state(true);
	let canManage = $derived(Boolean(club?.is_club_admin));
	const date = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(
			new Date(value)
		);
	const watermarkDate = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long' }).format(new Date(value));
	const time = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(
			new Date(value)
		);
	const money = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
	const teamPlayers = (players: string[]) => [...new Set(players)];
	const completedSetCount = (match: PublicSessionMatch) =>
		Number(match.set_one_a !== null) + Number(match.set_two_a !== null);
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
		const completedSets = matches.reduce(
			(sum, match) => sum + Number(match.set_one_a !== null) + Number(match.set_two_a !== null),
			0
		);
		return [
			`${clubName} — ${dateText}`,
			`Pemain: ${session.attendance} · Match: ${matches.length} · Set: ${completedSets}`,
			session.fee_per_person
				? `Iuran: ${money(session.fee_per_person)} / orang`
				: 'Biaya sesi belum dikonfirmasi',
			financeRecap?.expected_fees ? `Total tagihan: ${money(financeRecap.expected_fees)}` : '',
			`Pembayaran tercatat: ${attendees.filter((attendee) => attendee.is_paid === true).length}/${attendees.length} pemain`
		]
			.filter(Boolean)
			.join('\n');
	}

	async function copyShareText() {
		const text = recapText();
		try {
			await copyRecap(text);
			shareNotice = 'Teks recap berhasil disalin.';
		} catch {
			shareNotice = 'Teks belum dapat disalin. Coba lagi.';
		}
	}

	async function copyRecap(text: string) {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return;
		}
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.opacity = '0';
		document.body.append(textarea);
		textarea.select();
		const copied = document.execCommand('copy');
		textarea.remove();
		if (!copied) throw new Error('Clipboard unavailable');
	}

	function handleAccessChange(accountClub: Club | null) {
		club = accountClub;
	}

	function createShareCard() {
		if (!session || !canManage) return;
		const canvas = document.createElement('canvas');
		canvas.width = 1080;
		canvas.height = 1350;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = '#163630';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = 'rgba(255,250,240,.12)';
		ctx.lineWidth = 2;
		for (const x of [76, 540, 1004]) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, 1350);
			ctx.stroke();
		}
		ctx.beginPath();
		ctx.moveTo(76, 76);
		ctx.lineTo(1004, 76);
		ctx.lineTo(1004, 1274);
		ctx.lineTo(76, 1274);
		ctx.closePath();
		ctx.stroke();

		const fee = session.fee_per_person ?? financeRecap?.fee_per_person;
		const totalDue = financeRecap?.expected_fees ?? (fee ? fee * session.attendance : 0);
		const paidCount = attendees.filter((attendee) => attendee.is_paid === true).length;
		const sessionDate = new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date(session.started_at));

		ctx.textAlign = 'left';
		ctx.fillStyle = '#f5bb61';
		ctx.font = '700 28px system-ui';
		ctx.fillText(clubName.toUpperCase(), 112, 142, 856);
		ctx.fillStyle = '#fffaf0';
		ctx.font = '800 58px system-ui';
		ctx.fillText(sessionDate, 112, 220, 856);
		ctx.fillStyle = '#c8d9d0';
		ctx.font = '600 28px system-ui';
		ctx.fillText(`${session.attendance} pemain hadir · ${matches.length} match`, 114, 270, 856);

		ctx.textAlign = 'center';
		ctx.fillStyle = '#f5bb61';
		ctx.font = '800 34px system-ui';
		ctx.fillText('IURAN SESI', 540, 410);
		ctx.fillStyle = '#fffaf0';
		ctx.font = '800 126px system-ui';
		ctx.fillText(fee ? money(fee) : 'BELUM ADA', 540, 545, 860);
		ctx.fillStyle = '#c8d9d0';
		ctx.font = '600 34px system-ui';
		ctx.fillText(fee ? 'per pemain' : 'iuran belum dikonfirmasi', 540, 594);

		ctx.strokeStyle = '#78948a';
		ctx.beginPath();
		ctx.moveTo(112, 672);
		ctx.lineTo(968, 672);
		ctx.stroke();
		const metrics = [
			['TOTAL TAGIHAN', totalDue ? money(totalDue) : '—'],
			['SUDAH LUNAS', `${paidCount}/${attendees.length || session.attendance}`],
			['BELUM LUNAS', `${Math.max((attendees.length || session.attendance) - paidCount, 0)} pemain`]
		];
		for (const [index, [label, value]] of metrics.entries()) {
			const x = 254 + index * 286;
			ctx.fillStyle = '#a7c5b9';
			ctx.font = '700 20px system-ui';
			ctx.fillText(label, x, 738);
			ctx.fillStyle = '#fffaf0';
			ctx.font = '800 32px system-ui';
			ctx.fillText(value, x, 782);
		}

		ctx.strokeStyle = '#78948a';
		ctx.beginPath();
		ctx.moveTo(112, 850);
		ctx.lineTo(968, 850);
		ctx.stroke();
		ctx.fillStyle = '#f5bb61';
		ctx.font = '800 24px system-ui';
		ctx.fillText('HASIL PERTANDINGAN', 540, 908);
		let y = 962;
		for (const match of matches.slice(0, 3)) {
			const scores = [
				match.set_one_a !== null ? `${match.set_one_a}–${match.set_one_b}` : '',
				match.set_two_a !== null ? `${match.set_two_a}–${match.set_two_b}` : ''
			]
				.filter(Boolean)
				.join('  ·  ');
			ctx.fillStyle = '#c8d9d0';
			ctx.font = '700 21px system-ui';
			ctx.fillText(`MATCH ${match.sequence_number}`, 196, y);
			ctx.fillStyle = '#fffaf0';
			ctx.font = '700 23px system-ui';
			ctx.fillText(scores || 'HASIL BELUM TERCATAT', 650, y);
			y += 54;
		}
		if (matches.length > 3) {
			ctx.fillStyle = '#a7c5b9';
			ctx.font = '600 20px system-ui';
			ctx.fillText(`+ ${matches.length - 3} match lainnya`, 540, y + 8);
		}
		ctx.fillStyle = '#a7c5b9';
		ctx.font = '600 22px system-ui';
		ctx.fillText('PB NEWBIE · REKAP MALAM INI', 540, 1218);
		cardUrl = canvas.toDataURL('image/png');
	}

	function openShareDialog() {
		if (!canManage || !session) return;
		shareNotice = '';
		createShareCard();
		shareDialogOpen = true;
	}

	function downloadCard() {
		if (!cardUrl) return;
		const link = document.createElement('a');
		link.href = cardUrl;
		link.download = 'pb-newbie-recap.png';
		link.click();
	}
</script>

<svelte:head><title>Detail sesi — PB NEWBIE</title></svelte:head>
<AppShell
	current="/history"
	mode={session ? watermarkDate(session.started_at) : 'ARSIP SESI'}
	{clubName}
	onaccesschange={handleAccessChange}
>
	<div class="flex items-center justify-between gap-3">
		<a
			href={resolve('/history')}
			class="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#38675b]"
			><ArrowLeft size={18} />Riwayat</a
		>
		{#if canManage}<AppButton class="shrink-0" onclick={openShareDialog}
				><Share2 size={17} />Bagikan</AppButton
			>{/if}
	</div>
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
			<div
				class="border-y border-[#163630] bg-[#163630] px-5 py-6 text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.16)]"
			>
				<h1 class="text-4xl font-black tracking-[-0.055em]">{date(session.started_at)}</h1>
				<p class="mt-3 text-sm font-bold text-[#d4e1db]">
					{time(session.started_at)} — {session.closed_at ? time(session.closed_at) : ''} · {session.attendance}
					pemain
				</p>
				<div class="mt-6 grid grid-cols-3 border-t border-[#85a097]/55 pt-4 text-center text-sm">
					<p><b class="block text-2xl text-[#f5bb61] tabular-nums">{matches.length}</b>Match</p>
					<p>
						<b class="block text-2xl text-[#f5bb61] tabular-nums"
							>{matches.reduce((sum, match) => sum + completedSetCount(match), 0)}</b
						>Set
					</p>
					<p><b class="block text-2xl text-[#f5bb61] tabular-nums">{attendees.length}</b>Hadir</p>
				</div>
			</div>
			<section class="mt-9">
				<div class="flex items-baseline justify-between gap-4 border-b border-[#b9c5bb] pb-4">
					<h2 class="text-2xl font-black tracking-[-0.04em]">Urutan pertandingan</h2>
					<span class="text-sm font-black text-[#38675b]">{matches.length} match</span>
				</div>
				{#if matches.length}<ol class="border-b border-[#b9c5bb]">
						{#each matches as match (match.id)}<li class="border-t border-[#b9c5bb] py-5">
								<div class="grid grid-cols-[auto_1fr] gap-x-4">
									<span class="text-3xl font-black text-[#38675b] tabular-nums"
										>{String(match.sequence_number).padStart(2, '0')}</span
									>
									<div class="min-w-0">
										<div class="flex items-center justify-between gap-3">
											<h3 class="text-lg font-black">Match {match.sequence_number}</h3>
											<span class="text-xs font-black tracking-[0.1em] text-[#527169]"
												>{match.status === 'COMPLETED' ? 'SELESAI' : match.status}</span
											>
										</div>
										<div class="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
											<p class="font-bold">
												{#each teamPlayers(match.team_a) as player (player)}<span class="block"
														>{player}</span
													>{:else}—{/each}
											</p>
											<span class="font-black text-[#e2653e]">VS</span>
											<p class="font-bold">
												{#each teamPlayers(match.team_b) as player (player)}<span class="block"
														>{player}</span
													>{:else}—{/each}
											</p>
										</div>
										<div class="mt-4 flex flex-wrap gap-2">
											{#if match.set_one_a !== null}<span
													class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-sm font-black tabular-nums"
													>SET 1 · {match.set_one_a}–{match.set_one_b}</span
												>{/if}
											{#if match.set_two_a !== null}<span
													class="border border-[#b9c5bb] bg-[#e5ece5] px-3 py-2 text-sm font-black tabular-nums"
													>SET 2 · {match.set_two_a}–{match.set_two_b}</span
												>{/if}
											{#if !completedSetCount(match)}<span class="text-sm text-[#527169]"
													>Hasil set belum tercatat.</span
												>{/if}
										</div>
									</div>
								</div>
							</li>{/each}
					</ol>{:else}<p class="border-b border-[#b9c5bb] py-5 text-sm text-[#527169]">
						Tidak ada match yang selesai pada sesi ini.
					</p>{/if}
			</section>
			<section class="mt-9 border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Hadir & pembayaran ({attendees.length})</h2>
				{#if attendees.length}<ul
						class="mt-3 grid border-y border-[#b9c5bb] bg-[#fffaf0] sm:grid-cols-2"
					>
						{#each attendees as attendee (attendee.player_id)}<li
								class="flex min-h-14 items-center justify-between gap-3 border-b border-[#b9c5bb] px-4 text-sm last:border-b-0"
							>
								<span
									><b class="block">{attendee.display_name}</b><span
										class="mt-1 block text-xs font-black tracking-[0.1em] text-[#527169]"
										>{attendee.membership_type === 'GUEST' ? 'TAMU' : 'ANGGOTA KLUB'}</span
									></span
								>
								<span
									class={`text-xs font-black ${attendee.is_paid === true ? 'text-[#38675b]' : attendee.is_paid === false ? 'text-[#9a3d25]' : 'text-[#527169]'}`}
									>{attendee.is_paid === null
										? 'BELUM DITETAPKAN'
										: attendee.is_paid
											? 'LUNAS'
											: 'BELUM BAYAR'}</span
								>
							</li>{/each}
					</ul>{:else}<p class="mt-2 text-sm text-[#527169]">
						Daftar hadir tidak tersedia untuk sesi ini.
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
							<dt>Biaya lapangan</dt>
							<dd class="font-black">{money(financeRecap.court_expenses)}</dd>
						</div>
						<div class="flex min-h-12 items-center justify-between gap-4">
							<dt>Biaya kok</dt>
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
						yang sudah dikonfirmasi.
					</p>{/if}
			</section>
		</section>
	{:else}<section class="mt-7 border border-[#b9c5bb] bg-[#fffaf0] p-6">
			<h1 class="text-2xl font-black">Sesi tidak ditemukan.</h1>
			<p class="mt-2 text-sm text-[#527169]">
				Detail hanya tersedia untuk sesi yang sudah selesai.
			</p>
		</section>{/if}
	{#if canManage && session}
		<CourtDialog
			open={shareDialogOpen}
			title="Bagikan hasil sesi"
			onOpenChange={(open) => (shareDialogOpen = open)}
			panelClass="max-h-[90dvh] overflow-y-auto"
		>
			<div class="p-5 sm:p-6">
				<h2 class="text-2xl font-black tracking-[-0.04em]">Bagikan hasil sesi</h2>
				<p class="mt-1 text-sm text-[#527169]">{date(session.started_at)} · {clubName}</p>
				{#if cardUrl}
					<img
						class="mt-4 max-h-[48dvh] w-full border border-[#b9c5bb] object-contain object-top"
						src={cardUrl}
						alt={`Kartu recap sesi ${date(session.started_at)}: iuran ${session.fee_per_person ? `${money(session.fee_per_person)} per pemain` : 'belum dikonfirmasi'}, ${session.attendance} pemain, dan ${matches.length} match`}
					/>
				{/if}
				<div class="mt-5 grid gap-3">
					<AppButton class="w-full justify-center" variant="secondary" onclick={copyShareText}
						>Copy text</AppButton
					><AppButton class="w-full justify-center" onclick={downloadCard}>Unduh gambar</AppButton>
				</div>
				{#if shareNotice}<p class="mt-3 text-sm font-bold text-[#38675b]" role="status">
						{shareNotice}
					</p>{/if}
			</div>
		</CourtDialog>
	{/if}
</AppShell>
