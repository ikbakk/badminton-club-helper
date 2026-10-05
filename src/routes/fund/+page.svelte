<script lang="ts">
	import { browser } from '$app/environment';
	import { Tabs } from 'sve-ui';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import {
		getFinanceSessionAttendees,
		getFinanceSessions,
		getPublicClub,
		getPublicFundActivity,
		getPublicFundSummary,
		invalidatePublicData,
		recordExpense,
		setSessionAttendeePaid,
		type Club,
		type FinanceSession,
		type FinanceSessionAttendee,
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
	let loading = $state(true);
	let pending = $state('');
	let notice = $state('');
	let selectedTab = $state('income');
	let selectedMonth = $state('all');
	let expenseCategory = $state<'COURT' | 'SHUTTLECOCK'>('COURT');
	let expenseAmount = $state('');
	let expenseDescription = $state('');
	let canManage = $derived(Boolean(club?.is_club_admin));
	const monthKey = (value: string) => value.slice(0, 7);
	const monthLabel = (value: string) =>
		new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
			new Date(`${value}-01T00:00:00`)
		);
	let months = $derived(
		[
			...new Set([
				...activity.map((item) => monthKey(item.occurred_at)),
				...sessions.map((session) => monthKey(session.started_at))
			])
		].sort((a, b) => b.localeCompare(a))
	);
	let filteredActivity = $derived(
		activity.filter(
			(item) => selectedMonth === 'all' || monthKey(item.occurred_at) === selectedMonth
		)
	);
	let incomeActivity = $derived(filteredActivity.filter((item) => item.kind === 'INCOME'));
	let expenseActivity = $derived(filteredActivity.filter((item) => item.kind === 'EXPENSE'));
	let filteredSessions = $derived(
		sessions.filter(
			(session) => selectedMonth === 'all' || monthKey(session.started_at) === selectedMonth
		)
	);
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
				invalidatePublicData();
				const publicClub = await getPublicClub();
				clubName = publicClub?.name ?? clubName;
				await refreshPublicFund();
			} catch (error) {
				notice = error instanceof Error ? error.message : 'Dana klub belum dapat dimuat.';
			} finally {
				loading = false;
			}
		})();

	async function handleAccessChange(accountClub: Club | null) {
		club = accountClub;
		clubName = accountClub?.name ?? clubName;
		if (!accountClub?.is_club_admin) return;
		try {
			await refreshAdminFund();
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Data pengelolaan kas belum dapat dimuat.';
		}
	}

	async function refreshPublicFund() {
		[summary, activity] = await Promise.all([
			getPublicFundSummary(),
			getPublicFundActivity().catch(() => [] as PublicFundActivity[])
		]);
	}

	async function refreshAdminFund() {
		if (!club?.is_club_admin) return;
		sessions = await getFinanceSessions(club.id);
		if (expandedSession) {
			attendees = {
				...attendees,
				[expandedSession]: await getFinanceSessionAttendees(club.id, expandedSession)
			};
		}
	}

	async function refreshFinance() {
		invalidatePublicData();
		await refreshPublicFund();
		await refreshAdminFund();
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
</script>

<svelte:head><title>Dana klub — PB NEWBIE</title></svelte:head>
<AppShell current="/fund" {clubName} onaccesschange={handleAccessChange}>
	{#if loading}<section
			class="border-y border-[#163630] bg-[#163630] p-6 text-[#fffaf0]"
			role="status"
			aria-busy="true"
			aria-label="Membuka kas klub"
		>
			<h1 class="text-2xl font-black tracking-[-0.04em]">Kas klub</h1>
			<div class="mt-6 w-2/5"><LoadingSkeleton height="2.5rem" /></div>
		</section>
	{:else}<section
			class="border-y border-[#163630] bg-[#163630] p-6 text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.17)]"
		>
			<h1 class="text-2xl font-black tracking-[-0.04em]">Kas klub</h1>
			<p class="mt-6 text-sm font-bold text-[#a7c5b9]">
				Sisa kas dari iuran sesi dan pengeluaran klub
			</p>
			<p class="mt-1 text-5xl font-black tracking-[-0.065em] tabular-nums">
				{money(summary?.balance ?? 0)}
			</p>
		</section>

		<section class="mt-6 border-y border-[#b9c5bb] bg-[#e5ece5] px-5 py-4">
			<label class="grid gap-2 text-xs font-black tracking-[0.12em] text-[#38675b]"
				>PERIODE<select
					class="min-h-11 border border-[#b9c5bb] bg-[#fffaf0] px-3 text-sm font-bold tracking-normal text-[#163630]"
					bind:value={selectedMonth}
				>
					<option value="all">Semua periode</option>
					{#each months as month (month)}<option value={month}>{monthLabel(month)}</option>{/each}
				</select></label
			>
		</section>

		<Tabs.Root bind:value={selectedTab} class="mt-7">
			<Tabs.List class="border-[#b9c5bb]">
				<Tabs.Trigger value="income" class="min-h-12 px-4 text-sm font-black"
					>Pemasukan</Tabs.Trigger
				>
				<Tabs.Trigger value="expense" class="min-h-12 px-4 text-sm font-black"
					>Pengeluaran</Tabs.Trigger
				>
			</Tabs.List>

			<Tabs.Content value="income">
				<section class="pt-5">
					<h2 class="text-2xl font-black tracking-[-0.04em]">Iuran sesi</h2>
					<p class="mt-2 text-sm leading-6 text-[#527169]">
						Iuran yang sudah ditandai lunas akan masuk ke sisa kas.
					</p>
					{#if incomeActivity.length}<ul class="mt-4 border-y border-[#b9c5bb] bg-[#fffaf0]">
							{#each incomeActivity as item (item.id)}<li
									class="flex min-h-14 items-center justify-between gap-4 border-b border-[#b9c5bb] px-4 py-3 last:border-b-0"
								>
									<span
										><b class="block">{item.label}</b><span class="text-xs text-[#527169]"
											>{date(item.occurred_at)}</span
										></span
									><b class="text-[#38675b]">+{money(item.amount)}</b>
								</li>{/each}
						</ul>{:else}<p class="mt-4 border-y border-[#b9c5bb] py-5 text-sm text-[#527169]">
							Belum ada iuran lunas untuk periode ini.
						</p>{/if}
				</section>
				{#if canManage}<section class="mt-8 border-t border-[#b9c5bb] pt-5">
						<h2 class="text-xl font-black">Status pembayaran sesi</h2>
						{#if filteredSessions.length}<ul
								class="mt-4 divide-y divide-[#b9c5bb] border border-[#b9c5bb] bg-[#fffaf0]"
							>
								{#each filteredSessions as session (session.session_id)}<li>
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
											><span aria-hidden="true"
												>{expandedSession === session.session_id ? '−' : '+'}</span
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
																>{person.paid_at ? 'Lunas' : 'Belum bayar'} · {money(
																	person.amount
																)}</span
															></button
														>
													</li>{/each}
											</ul>{/if}
									</li>{/each}
							</ul>{:else}<p class="mt-4 border-y border-[#b9c5bb] py-5 text-sm text-[#527169]">
								Sesi yang ditutup dan sudah ditetapkan biayanya akan muncul di sini.
							</p>{/if}
					</section>{/if}
			</Tabs.Content>

			<Tabs.Content value="expense">
				<section class="pt-5">
					<h2 class="text-2xl font-black tracking-[-0.04em]">Pengeluaran klub</h2>
					<p class="mt-2 text-sm leading-6 text-[#527169]">
						Sewa lapangan dan tambahan kok mengurangi sisa kas klub.
					</p>
					{#if expenseActivity.length}<ul class="mt-4 border-y border-[#b9c5bb] bg-[#fffaf0]">
							{#each expenseActivity as item (item.id)}<li
									class="flex min-h-14 items-center justify-between gap-4 border-b border-[#b9c5bb] px-4 py-3 last:border-b-0"
								>
									<span
										><b class="block">{item.label}</b><span class="text-xs text-[#527169]"
											>{date(item.occurred_at)}</span
										></span
									><b class="text-[#9a3d25]">−{money(Math.abs(item.amount))}</b>
								</li>{/each}
						</ul>{:else}<p class="mt-4 border-y border-[#b9c5bb] py-5 text-sm text-[#527169]">
							Belum ada pengeluaran untuk periode ini.
						</p>{/if}
				</section>
				{#if canManage}<section class="mt-8 border-t border-[#b9c5bb] pt-5">
						<h2 class="text-xl font-black">Catat pengeluaran</h2>
						<form class="mt-4 border border-[#b9c5bb] bg-[#fffaf0] p-5" onsubmit={saveExpense}>
							<label class="block text-sm font-bold"
								>Kategori<select
									class="mt-2 min-h-11 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3"
									bind:value={expenseCategory}
									><option value="COURT">Sewa lapangan</option><option value="SHUTTLECOCK"
										>Tambahan kok</option
									></select
								></label
							>
							<label class="mt-3 block text-sm font-bold"
								>Jumlah<input
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
					</section>{/if}
			</Tabs.Content>
		</Tabs.Root>
		{#if !canManage}<section class="mt-8 border-y border-[#b9c5bb] bg-[#e5ece5] px-5 py-5">
				<h2 class="text-xl font-black tracking-[-0.04em]">Catatan kas klub</h2>
				<p class="mt-2 max-w-prose text-sm leading-6 text-[#527169]">
					Kas dihitung dari iuran sesi yang sudah ditandai lunas, dikurangi sewa lapangan dan
					tambahan kok. Riwayat di atas dapat dilihat semua member.
				</p>
			</section>{/if}
	{/if}
	{#if notice}<p
			role="status"
			class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm font-bold text-[#9a3d25]"
		>
			{notice}
		</p>{/if}
</AppShell>
