<script lang="ts">
	import { browser } from '$app/environment';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import {
		getClub,
		getFinancePendingSubmissions,
		getFinanceSessionAttendees,
		getFinanceSessions,
		getPublicClub,
		getPublicFundActivity,
		getPublicFundSummary,
		invalidatePublicData,
		recordExpense,
		reviewFinanceSubmission,
		setSessionAttendeePaid,
		type Club,
		type FinanceSession,
		type FinanceSessionAttendee,
		type FinanceSubmission,
		type PublicFundActivity,
		type PublicFundSummary
	} from '$lib/data/dashboard';
	let clubName = $state('PB NEWBIE');
	let club = $state<Club | null>(null);
	let summary = $state<PublicFundSummary | null>(null);
	let activity = $state<PublicFundActivity[]>([]);
	let sessions = $state<FinanceSession[]>([]);
	let attendees = $state<Record<string, FinanceSessionAttendee[]>>({});
	let expandedSession = $state('');
	let pendingSubmissions = $state<FinanceSubmission[]>([]);
	let loading = $state(true);
	let pending = $state('');
	let notice = $state('');
	let expenseCategory = $state<'COURT' | 'SHUTTLECOCK' | 'OTHER'>('COURT');
	let expenseAmount = $state('');
	let expenseDescription = $state('');
	let canManage = $derived(Boolean(club?.is_club_admin || club?.is_finance_admin));
	const money = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
	const date = (value: string) =>
		new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));

	if (browser)
		void (async () => {
			try {
				const [publicClub, accountClub] = await Promise.all([getPublicClub(), getClub()]);
				clubName = accountClub?.name ?? publicClub?.name ?? clubName;
				club = accountClub;
				await refreshFinance();
			} catch (error) {
				notice = error instanceof Error ? error.message : 'Dana klub belum dapat dimuat.';
			} finally {
				loading = false;
			}
		})();

	async function refreshFinance() {
		invalidatePublicData();
		[summary, activity] = await Promise.all([
			getPublicFundSummary(),
			getPublicFundActivity().catch(() => [] as PublicFundActivity[])
		]);
		if (!club || !(club.is_club_admin || club.is_finance_admin)) return;
		[sessions, pendingSubmissions] = await Promise.all([
			getFinanceSessions(club.id),
			getFinancePendingSubmissions(club.id)
		]);
		if (expandedSession) {
			attendees = {
				...attendees,
				[expandedSession]: await getFinanceSessionAttendees(club.id, expandedSession)
			};
		}
	}

	async function toggleSession(sessionId: string) {
		if (expandedSession === sessionId) {
			expandedSession = '';
			return;
		}
		expandedSession = sessionId;
		if (club && !attendees[sessionId]) {
			try {
				attendees = {
					...attendees,
					[sessionId]: await getFinanceSessionAttendees(club.id, sessionId)
				};
			} catch (error) {
				notice = error instanceof Error ? error.message : 'Daftar hadir gagal dimuat.';
			}
		}
	}

	async function togglePaid(sessionId: string, person: FinanceSessionAttendee) {
		if (!club || pending) return;
		pending = 'Menyimpan status…';
		try {
			await setSessionAttendeePaid(club.id, sessionId, person.player_id, !person.paid_at);
			attendees = {
				...attendees,
				[sessionId]: await getFinanceSessionAttendees(club.id, sessionId)
			};
			await refreshFinance();
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Status pembayaran gagal disimpan.';
		} finally {
			pending = '';
		}
	}

	async function saveExpense(event: SubmitEvent) {
		event.preventDefault();
		if (!club) return;
		const amount = Number(expenseAmount);
		if (!Number.isInteger(amount) || amount <= 0) return;
		pending = 'Mencatat pengeluaran…';
		try {
			await recordExpense(club.id, expenseCategory, amount, expenseDescription);
			expenseAmount = '';
			expenseDescription = '';
			await refreshFinance();
			notice = 'Pengeluaran tercatat.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Pengeluaran gagal dicatat.';
		} finally {
			pending = '';
		}
	}

	async function reviewSubmission(id: string, confirm: boolean) {
		if (!club || pending) return;
		if (!window.confirm(confirm ? 'Konfirmasi laporan biaya ini?' : 'Tolak laporan biaya ini?'))
			return;
		pending = confirm ? 'Mengonfirmasi laporan…' : 'Menolak laporan…';
		try {
			await reviewFinanceSubmission(club.id, id, confirm);
			await refreshFinance();
			notice = confirm ? 'Biaya perkiraan dicatat.' : 'Laporan ditolak.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Laporan belum dapat ditinjau.';
		} finally {
			pending = '';
		}
	}
</script>

<svelte:head><title>Dana klub — PB NEWBIE</title></svelte:head>
<AppShell current="/fund" {clubName}>
	{#if loading}<div class="space-y-5" aria-busy="true" aria-label="Membuka dana klub…">
			<section
				class="border border-[#163630] bg-[#163630] p-6 text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.17)]"
			>
				<h1 class="text-2xl font-black tracking-[-0.04em]">Dana klub</h1>
				<p class="mt-6 text-sm font-bold text-[#a7c5b9]">Saldo kas (perkiraan)</p>
				<div class="mt-2 w-2/5" role="status" aria-busy="true" aria-label="Memuat saldo dana klub">
					<LoadingSkeleton height="2.5rem" />
				</div>
			</section>
			<section class="grid grid-cols-2 border border-[#b9c5bb] bg-[#fffaf0]">
				<p class="border-r border-[#b9c5bb] p-5 text-sm">
					<span class="block text-[#527169]">Dana masuk</span><span class="mt-2 block w-2/3"
						><LoadingSkeleton height="1.5rem" /></span
					>
				</p>
				<p class="p-5 text-sm">
					<span class="block text-[#527169]">Pengeluaran</span><span class="mt-2 block w-2/3"
						><LoadingSkeleton height="1.5rem" /></span
					>
				</p>
			</section>
			<section class="border-t border-[#b9c5bb] pt-5">
				<h2 class="text-xl font-black">Aktivitas terbaru</h2>
				<div
					class="mt-4 divide-y divide-[#b9c5bb] border border-[#b9c5bb] bg-[#fffaf0]"
					role="status"
					aria-busy="true"
					aria-label="Memuat aktivitas terbaru"
				>
					{#each [1, 2, 3] as row (row)}<div
							class="flex min-h-14 items-center justify-between gap-4 px-4 py-3"
						>
							<div class="w-32 space-y-2">
								<LoadingSkeleton />
								<div class="w-20"><LoadingSkeleton height="0.75rem" /></div>
							</div>
							<div class="w-16"><LoadingSkeleton /></div>
						</div>{/each}
				</div>
			</section>
		</div>{:else}
		<section class="bg-[#163630] p-6 text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.17)]">
			<h1 class="text-2xl font-black tracking-[-0.04em]">Dana klub</h1>
			<p class="mt-6 text-sm font-bold text-[#a7c5b9]">Saldo kas (perkiraan)</p>
			<p class="mt-1 text-4xl font-black tracking-[-0.06em]">{money(summary?.balance ?? 0)}</p>
		</section>
		<section class="mt-5 grid grid-cols-2 border border-[#b9c5bb] bg-[#fffaf0]">
			<p class="border-r border-[#b9c5bb] p-5 text-sm">
				<span class="block text-[#527169]">Dana masuk</span><b class="mt-1 block text-xl"
					>{money(summary?.received ?? 0)}</b
				>
			</p>
			<p class="p-5 text-sm">
				<span class="block text-[#527169]">Pengeluaran</span><b class="mt-1 block text-xl"
					>{money(summary?.expenses ?? 0)}</b
				>
			</p>
		</section>
	{/if}
	{#if !loading}
		<section class="mt-7 border-t border-[#b9c5bb] pt-5">
			<h2 class="text-xl font-black">Aktivitas terbaru</h2>
			{#if activity.length}<ul class="mt-4 border border-[#b9c5bb] bg-[#fffaf0]">
					{#each activity as item (item.id)}<li
							class="flex min-h-14 items-center justify-between gap-4 border-b border-[#b9c5bb] px-4 py-3 last:border-0"
						>
							<span
								><b class="block">{item.label}</b><span class="text-xs text-[#527169]"
									>{date(item.occurred_at)}</span
								></span
							><b class={item.amount >= 0 ? 'text-[#38675b]' : 'text-[#9a3d25]'}
								>{item.amount >= 0 ? '+' : '−'}{money(Math.abs(item.amount))}</b
							>
						</li>{/each}
				</ul>{:else}<p class="mt-4 border border-[#b9c5bb] bg-[#fffaf0] p-5 text-sm text-[#527169]">
					Belum ada aktivitas dana.
				</p>{/if}
		</section>
	{/if}
	{#if canManage}
		<section class="mt-7 border-t border-[#b9c5bb] pt-5">
			<h2 class="text-xl font-black">Iuran per sesi</h2>
			<p class="mt-2 text-sm leading-6 text-[#527169]">
				Buka sesi, lalu ketuk nama pemain untuk mengubah status Belum bayar / Lunas. Tidak ada saldo
				atau utang pemain.
			</p>
			{#if sessions.length}<ul
					class="mt-4 divide-y divide-[#b9c5bb] border border-[#b9c5bb] bg-[#fffaf0]"
				>
					{#each sessions as session (session.session_id)}<li>
							<button
								class="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left"
								onclick={() => void toggleSession(session.session_id)}
								aria-expanded={expandedSession === session.session_id}
							>
								<span
									><b class="block">{date(session.started_at)}</b><span
										class="text-sm text-[#527169]"
										>{session.paid_count}/{session.attendance} lunas · {money(
											session.fee_per_person
										)} per orang</span
									></span
								><span aria-hidden="true">{expandedSession === session.session_id ? '−' : '+'}</span
								>
							</button>
							{#if expandedSession === session.session_id}<ul
									class="border-t border-[#b9c5bb] bg-[#f4f1e8] p-2"
								>
									{#each attendees[session.session_id] ?? [] as person (person.player_id)}<li>
											<button
												class="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left"
												disabled={Boolean(pending)}
												onclick={() => void togglePaid(session.session_id, person)}
												><span>{person.display_name}</span><span
													class={person.paid_at
														? 'font-black text-[#38675b]'
														: 'font-bold text-[#9a3d25]'}
													>{person.paid_at ? 'Lunas' : 'Belum bayar'} · {money(person.amount)}</span
												></button
											>
										</li>{/each}
								</ul>{/if}
						</li>{/each}
				</ul>{:else}<p class="mt-4 border border-[#b9c5bb] bg-[#fffaf0] p-5 text-sm text-[#527169]">
					Sesi yang ditutup dan sudah ditetapkan biayanya akan muncul di sini.
				</p>{/if}
		</section>
		<section class="mt-7 border-t border-[#b9c5bb] pt-5">
			<h2 class="text-xl font-black">Pengeluaran & laporan biaya</h2>
			<p class="mt-2 text-sm leading-6 text-[#527169]">
				Biaya lapangan dan kok boleh berupa perkiraan; kas klub juga merupakan ringkasan perkiraan.
			</p>
			<form class="mt-4 border border-[#b9c5bb] bg-[#fffaf0] p-5" onsubmit={saveExpense}>
				<label class="block text-sm font-bold"
					>Kategori<select
						class="mt-2 min-h-11 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3"
						bind:value={expenseCategory}
						><option value="COURT">Lapangan</option><option value="SHUTTLECOCK">Kok</option><option
							value="OTHER">Lainnya</option
						></select
					></label
				>
				<label class="mt-3 block text-sm font-bold"
					>Jumlah perkiraan<input
						class="mt-2 min-h-11 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3"
						inputmode="numeric"
						bind:value={expenseAmount}
						placeholder="120000"
					/></label
				>
				<label class="mt-3 block text-sm font-bold"
					>Catatan (opsional)<input
						class="mt-2 min-h-11 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3"
						bind:value={expenseDescription}
						placeholder="Sewa lapangan"
					/></label
				>
				<button
					class="mt-5 min-h-11 bg-[#163630] px-4 text-sm font-black text-[#fffaf0] disabled:opacity-50"
					disabled={Boolean(pending) || Number(expenseAmount) <= 0}
					>{pending || 'Simpan pengeluaran'}</button
				>
			</form>
			{#if pendingSubmissions.length}<div class="mt-5 border border-[#b9c5bb] bg-[#fffaf0]">
					<h3 class="border-b border-[#b9c5bb] px-5 py-4 font-black">
						Laporan biaya menunggu tinjauan
					</h3>
					<ul>
						{#each pendingSubmissions as submission (submission.submission_id)}<li
								class="border-b border-[#b9c5bb] p-5 last:border-0"
							>
								<b>Sesi {date(submission.session_started_at)}</b>
								<div class="mt-2 flex flex-wrap gap-4 text-sm text-[#527169]">
									{#if submission.reported_court_cost}<span
											>Lapangan {money(submission.reported_court_cost)}</span
										>{/if}{#if submission.reported_shuttlecock_cost}<span
											>Kok {money(submission.reported_shuttlecock_cost)}</span
										>{/if}
								</div>
								{#if submission.notes}<p class="mt-2 text-sm">{submission.notes}</p>{/if}
								<div class="mt-4 flex gap-2">
									<button
										class="min-h-11 bg-[#163630] px-4 text-sm font-black text-[#fffaf0]"
										disabled={Boolean(pending)}
										onclick={() => void reviewSubmission(submission.submission_id, true)}
										>Konfirmasi perkiraan</button
									><button
										class="min-h-11 border border-[#9a3d25] px-4 text-sm font-black text-[#9a3d25]"
										disabled={Boolean(pending)}
										onclick={() => void reviewSubmission(submission.submission_id, false)}
										>Tolak</button
									>
								</div>
							</li>{/each}
					</ul>
				</div>{/if}
		</section>
	{/if}
	{#if notice}<p
			role="status"
			class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm font-bold text-[#9a3d25]"
		>
			{notice}
		</p>{/if}
</AppShell>
