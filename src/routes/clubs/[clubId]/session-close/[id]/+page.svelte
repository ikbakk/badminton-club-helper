<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { publicSurfaceKey } from '$lib/data/query-client';
	import QueryNotice from '$lib/components/ui/QueryNotice.svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { selectedClubId } from '$lib/club-context';
	import { onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { ArrowLeft, ArrowRight } from '@lucide/svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import {
		getFinanceSessionAttendees,
		getPublicClub,
		getPublicSessionHistory,
		getPublicSessionMatches,
		invalidatePublicData,
		setSessionAttendeePaid,
		type Club,
		type FinanceSessionAttendee,
		type PublicSessionHistory
	} from '$lib/data/dashboard';
	import { confirmSessionFee, reopenSession, suggestSessionFee } from '$lib/data/live';

	let { params }: { params: { id: string } } = $props();
	let club = $state<Club | null>(null);

	const clubId = selectedClubId();
	const closeQuery = createQuery(() => ({
		queryKey: publicSurfaceKey(clubId, 'close', params.id),
		enabled: browser,
		retry: false,
		queryFn: async () => {
			const sessionId = params.id;
			const [publicClub, history, matches] = await Promise.all([
				getPublicClub(clubId),
				getPublicSessionHistory(clubId),
				getPublicSessionMatches(sessionId, clubId)
			]);
			return {
				publicClub,
				session: history.find((item) => item.id === sessionId && item.closed_at) ?? null,
				matchCount: matches.length
			};
		}
	}));
	let clubName = $derived(closeQuery.data?.publicClub?.name ?? 'Klub');
	let session: PublicSessionHistory | null = $derived(closeQuery.data?.session ?? null);
	let attendees = $state<FinanceSessionAttendee[]>([]);
	let matchCount = $derived(closeQuery.data?.matchCount ?? 0);
	let fee = $state('');
	let feeSuggested = $state(false);
	let loading = $derived(closeQuery.isPending);
	let savingFee = $state(false);
	let savingPlayers = $state<Record<string, boolean>>({});
	let queuedPlayers = $state<Record<string, boolean>>({});
	let paidOverrides = $state<Record<string, boolean>>({});
	let notice = $state('');
	let isAdmin = $derived(Boolean(club?.is_club_admin));
	let totalDue = $derived(Number(fee || session?.fee_per_person || 0) * (session?.attendance ?? 0));
	let paidCount = $derived(
		attendees.filter((person) => paidOverrides[person.player_id] ?? Boolean(person.paid_at)).length
	);
	const paidDebounceMs = 350;
	const paidTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	const pendingPaidChanges = new SvelteMap<string, boolean>();
	const paidWrites = new SvelteMap<string, Promise<boolean>>();
	const money = (amount: number) => `Rp${amount.toLocaleString('id-ID')}`;
	const date = (value: string) =>
		new Intl.DateTimeFormat('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date(value));

	async function load() {
		await closeQuery.refetch();
		await loadAdminData();
	}
	$effect(() => {
		if (session) {
			if (!fee && session.fee_per_person) fee = String(session.fee_per_person);
			void loadAdminData().catch(() => {
				notice = 'Data pembayaran belum dapat dimuat.';
			});
		}
	});

	async function loadAdminData() {
		if (!club?.is_club_admin || !session) return;
		if (!fee) {
			const suggestion = await suggestSessionFee(session.id);
			if (suggestion && !fee) {
				fee = String(suggestion);
				feeSuggested = true;
			}
		}
		if (session.fee_per_person) attendees = await getFinanceSessionAttendees(club.id, session.id);
	}

	async function handleAccessChange(accountClub: Club | null) {
		club = accountClub;
		try {
			await loadAdminData();
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Data pembayaran belum dapat dimuat.';
		}
	}

	function omitPlayer<T>(record: Record<string, T>, playerId: string) {
		const remaining = { ...record };
		delete remaining[playerId];
		return remaining;
	}

	function isPaid(person: FinanceSessionAttendee) {
		return paidOverrides[person.player_id] ?? Boolean(person.paid_at);
	}

	function queuePaidChange(person: FinanceSessionAttendee, paid: boolean) {
		const playerId = person.player_id;
		paidOverrides = { ...paidOverrides, [playerId]: paid };
		queuedPlayers = { ...queuedPlayers, [playerId]: true };
		pendingPaidChanges.set(playerId, paid);
		const previousTimer = paidTimers.get(playerId);
		if (previousTimer) clearTimeout(previousTimer);
		paidTimers.set(
			playerId,
			setTimeout(() => void flushPaidChange(playerId), paidDebounceMs)
		);
	}

	async function refreshPaymentAttendees(playerId: string) {
		if (!club || !session) return;
		try {
			attendees = await getFinanceSessionAttendees(club.id, session.id);
			if (
				!pendingPaidChanges.has(playerId) &&
				!paidTimers.has(playerId) &&
				!paidWrites.has(playerId)
			) {
				paidOverrides = omitPlayer(paidOverrides, playerId);
			}
		} catch (error) {
			notice =
				error instanceof Error
					? error.message
					: 'Status pembayaran tersimpan, tetapi daftar gagal diperbarui.';
		}
	}

	async function flushPaidChange(playerId: string): Promise<boolean> {
		const timer = paidTimers.get(playerId);
		if (timer) {
			clearTimeout(timer);
			paidTimers.delete(playerId);
		}
		if (!club || !session) return false;

		const activeWrite = paidWrites.get(playerId);
		if (activeWrite) {
			const saved = await activeWrite;
			if (pendingPaidChanges.has(playerId) && !paidTimers.has(playerId))
				return flushPaidChange(playerId);
			return saved;
		}
		if (!pendingPaidChanges.has(playerId)) return true;

		const paid = pendingPaidChanges.get(playerId)!;
		pendingPaidChanges.delete(playerId);
		queuedPlayers = omitPlayer(queuedPlayers, playerId);
		savingPlayers = { ...savingPlayers, [playerId]: true };
		notice = '';
		const clubId = club.id;
		const sessionId = session.id;
		const write = (async () => {
			try {
				await setSessionAttendeePaid(clubId, sessionId, playerId, paid);
				invalidatePublicData();
				return true;
			} catch (error) {
				if (!pendingPaidChanges.has(playerId)) paidOverrides = omitPlayer(paidOverrides, playerId);
				notice = error instanceof Error ? error.message : 'Status pembayaran gagal disimpan.';
				return false;
			} finally {
				savingPlayers = omitPlayer(savingPlayers, playerId);
			}
		})();
		paidWrites.set(playerId, write);
		const saved = await write;
		if (paidWrites.get(playerId) === write) paidWrites.delete(playerId);

		if (pendingPaidChanges.has(playerId) && !paidTimers.has(playerId)) {
			return flushPaidChange(playerId);
		}
		if (saved && !pendingPaidChanges.has(playerId) && !paidTimers.has(playerId))
			await refreshPaymentAttendees(playerId);
		return saved;
	}

	let continuing = $state(false);
	async function continueToRecap(event: MouseEvent) {
		event.preventDefault();
		if (continuing || savingFee) return;
		continuing = true;
		try {
			while (paidTimers.size || pendingPaidChanges.size || paidWrites.size) {
				const playerIds = new Set([
					...paidTimers.keys(),
					...pendingPaidChanges.keys(),
					...paidWrites.keys()
				]);
				const results = await Promise.all([...playerIds].map(flushPaidChange));
				if (results.some((saved) => !saved)) {
					notice = 'Pembayaran belum tersimpan. Periksa checklist sebelum melanjutkan.';
					return;
				}
			}

			invalidatePublicData();
			await goto(resolve('/clubs/[clubId]/session-close/[id]/confirm', { clubId, id: params.id }));
		} finally {
			continuing = false;
		}
	}

	onDestroy(() => {
		for (const playerId of paidTimers.keys()) void flushPaidChange(playerId);
	});

	async function saveFee() {
		const amount = Number(fee);
		if (
			savingFee ||
			!session ||
			session.attendance < 1 ||
			!Number.isSafeInteger(amount) ||
			amount <= 0
		)
			return;
		savingFee = true;
		notice = '';
		try {
			await confirmSessionFee(session.id, amount);
			invalidatePublicData();
			await load();
			notice = 'Iuran sesi tersimpan dan daftar pembayaran siap diperbarui.';
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Iuran sesi gagal disimpan.';
		} finally {
			savingFee = false;
		}
	}

	async function reopen() {
		if (
			!session ||
			!confirm('Buka kembali sesi? Iuran yang sudah dikonfirmasi tidak bisa dibatalkan.')
		)
			return;
		try {
			await reopenSession(session.id);
			invalidatePublicData();
			await goto(resolve('/clubs/[clubId]/live', { clubId: selectedClubId() }));
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Sesi tidak dapat dibuka kembali.';
		}
	}
</script>

<svelte:head><title>Tutup sesi — {clubName}</title></svelte:head>
<AppShell current="" mode="REKAP SESI" {clubName} onaccesschange={handleAccessChange}>
	<QueryNotice
		failed={closeQuery.isError}
		hasData={Boolean(closeQuery.data)}
		retry={() => closeQuery.refetch()}
		fetching={closeQuery.isFetching}
	/>
	<a
		href={resolve('/clubs/[clubId]/live', { clubId: selectedClubId() })}
		class="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#38675b]"
		><ArrowLeft size={18} />Kembali ke Live</a
	>
	{#if loading}
		<section class="mt-6 border-y border-[#d6ddd3] py-6" role="status" aria-busy="true">
			<p class="text-sm font-bold text-[#527169]">Memuat rekap malam ini…</p>
			<div class="mt-3 h-3 animate-pulse bg-[#d9e2da]"></div>
		</section>
	{:else if !session}
		<section class="mt-6 border-y border-[#d6ddd3] py-6">
			<h1 class="text-3xl font-bold tracking-[-0.035em]">Sesi tidak ditemukan</h1>
			<p class="mt-3 text-sm leading-6 text-[#527169]">
				Sesi mungkin belum ditutup atau sudah dihapus.
			</p>
		</section>
	{:else}
		<header
			class="mt-6 rounded-[10px] border border-[#163630] bg-[#163630] px-5 py-6 text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.16)]"
		>
			<div class="flex flex-wrap items-start justify-between gap-3">
				<h1 class="text-3xl font-bold tracking-[-0.035em]">Rekap sesi selesai</h1>
				{#if isAdmin}
					<a
						class="court-button court-button--primary"
						href={resolve('/clubs/[clubId]/session-close/[id]/confirm', {
							clubId: selectedClubId(),
							id: params.id
						})}
						onclick={continueToRecap}
						aria-disabled={continuing || savingFee}
						>{continuing ? 'Menyimpan pembayaran…' : 'Konfirmasi rekap'}</a
					>
				{/if}
			</div>
			<p class="mt-3 text-base font-bold">{date(session.started_at)}</p>
			<p class="mt-1 text-sm text-[#d4e1db]">
				{session.attendance} pemain hadir · {matchCount} match · sesi sudah ditutup
			</p>
			{#if session.fee_per_person === null}
				<p class="mt-3 text-xs font-bold text-[#f5bb61]">
					Rekap belum final — tetapkan iuran untuk menyelesaikan rekap ini.
				</p>
			{/if}
		</header>

		{#if !isAdmin}
			<section class="mt-7 border-y border-[#d6ddd3]">
				<div class="grid grid-cols-2 border-b border-[#d6ddd3] bg-[#e5ece5] sm:grid-cols-3">
					<p class="border-r border-[#d6ddd3] p-4 text-sm">
						<span class="block text-[#527169]">Pemain hadir</span><b
							class="mt-1 block text-2xl tabular-nums">{session.attendance}</b
						>
					</p>
					<p class="p-4 text-sm">
						<span class="block text-[#527169]">Match selesai</span><b
							class="mt-1 block text-2xl tabular-nums">{matchCount}</b
						>
					</p>
					<p
						class="col-span-2 border-t border-[#d6ddd3] p-4 text-sm sm:col-span-1 sm:border-t-0 sm:border-l"
					>
						<span class="block text-[#527169]">Iuran sesi</span><b
							class="mt-1 block text-xl tabular-nums"
							>{session.fee_per_person === null
								? 'Belum dikonfirmasi'
								: `${money(session.fee_per_person)} / orang`}</b
						>
					</p>
				</div>
				<div class="px-5 py-5">
					<h2 class="text-xl font-bold">Malam ini sudah tercatat.</h2>
					<p class="mt-2 max-w-prose text-sm leading-6 text-[#527169]">
						Riwayat pertandingan dan kehadiran tersedia untuk semua member setelah sesi ditutup.
					</p>
					<a
						class="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-[#38675b]"
						href={resolve('/clubs/[clubId]/history/[id]', {
							clubId: selectedClubId(),
							id: params.id
						})}>Lihat riwayat sesi <ArrowRight size={18} /></a
					>
				</div>
			</section>
		{:else}
			<section class="mt-6 border-b border-[#d6ddd3] pb-6">
				<h2 class="text-2xl font-bold tracking-[-0.04em]">Tetapkan iuran per orang</h2>
				<p class="mt-2 max-w-prose text-sm leading-6 text-[#527169]">
					Konfirmasi iuran membuat tagihan sesi untuk setiap pemain yang hadir. Nilai ini akan masuk
					ke riwayat.
				</p>
				{#if session.fee_per_person === null}
					<form
						class="mt-5"
						onsubmit={(event) => {
							event.preventDefault();
							void saveFee();
						}}
					>
						<p class="mt-3 text-sm leading-6 text-[#527169]" role="note">
							{#if feeSuggested}
								Nilai terisi dari iuran sesi terakhir. Tinjau atau ubah sebelum membuat tagihan.
							{:else}
								Belum ada iuran sesi sebelumnya. Masukkan nilai yang disepakati sebelum membuat
								tagihan.
							{/if}
						</p>
						<label class="block text-sm font-bold" for="session-fee">Iuran per orang</label>
						<div class="mt-2 flex items-stretch gap-3">
							<span class="flex items-center border border-[#d6ddd3] bg-[#e5ece5] px-4 font-bold"
								>Rp</span
							>
							<input
								id="session-fee"
								type="number"
								class="min-h-14 min-w-0 flex-1 rounded-md border border-[#163630] bg-[#fffaf0] px-4 text-xl font-bold tabular-nums"
								inputmode="numeric"
								required
								min="1"
								bind:value={fee}
							/>
						</div>
						<div class="mt-4 grid gap-1 border-y border-[#d6ddd3] py-3 text-sm">
							<p class="flex justify-between gap-3">
								<span>Jumlah pemain</span><b>{session.attendance}</b>
							</p>
							<p class="flex justify-between gap-3">
								<span>Iuran per orang</span><b
									>{Number(fee) > 0 ? money(Number(fee)) : 'Belum diisi'}</b
								>
							</p>
							<p class="flex justify-between gap-3 text-base">
								<span>Total tagihan yang akan dibuat</span><b
									>{Number(fee) > 0 ? money(totalDue) : 'Belum dihitung'}</b
								>
							</p>
						</div>
						{#if session.attendance === 0}
							<p class="mt-3 text-sm font-bold text-[#9a3d25]">
								Tidak ada pemain hadir, jadi tidak ada tagihan yang perlu dibuat.
							</p>
						{/if}
						<div class="mt-5 flex flex-wrap gap-3">
							<AppButton
								type="submit"
								disabled={savingFee || session.attendance === 0 || !Number(fee)}
							>
								{savingFee ? 'Menyimpan…' : 'Konfirmasi iuran & buat tagihan'}
							</AppButton>
							<AppButton variant="secondary" onclick={reopen}>Buka lagi sesi</AppButton>
						</div>
					</form>
				{:else}
					<p class="mt-4 text-3xl font-bold tabular-nums">
						{money(session.fee_per_person)} <span class="text-base">/ orang</span>
					</p>
					<p class="mt-1 text-sm text-[#527169]">
						Total tagihan: {money(session.fee_per_person * session.attendance)}
					</p>
				{/if}
			</section>

			{#if session.fee_per_person !== null}
				<section class="mt-6">
					<div
						class="flex flex-wrap items-end justify-between gap-3 border-b border-[#d6ddd3] pb-4"
					>
						<div>
							<h2 class="text-2xl font-bold tracking-[-0.04em]">Checklist pembayaran</h2>
							<p class="mt-1 text-sm text-[#527169]">Centang pemain yang sudah membayar.</p>
						</div>
						<p class="text-sm font-bold tabular-nums">
							{paidCount}/{attendees.length} lunas
						</p>
					</div>
					{#if attendees.length}
						<ul class="divide-y divide-[#b9c5bb] border-b border-[#d6ddd3]">
							{#each attendees as person (person.player_id)}
								<li>
									<label class="flex min-h-16 cursor-pointer items-center gap-4 py-3">
										<input
											type="checkbox"
											class="size-6 rounded-md accent-[#163630]"
											checked={isPaid(person)}
											disabled={continuing}
											onchange={(event) => queuePaidChange(person, event.currentTarget.checked)}
										/>
										<span class="min-w-0 flex-1">
											<b class="block truncate">{person.display_name}</b>
											<span class="text-sm text-[#527169]">{money(person.amount)}</span>
										</span>
										<span
											class={isPaid(person)
												? 'text-sm font-bold text-[#38675b]'
												: 'text-sm font-bold text-[#9a3d25]'}
										>
											{savingPlayers[person.player_id]
												? 'Menyimpan…'
												: queuedPlayers[person.player_id]
													? 'Menunggu…'
													: isPaid(person)
														? 'Lunas'
														: 'Belum bayar'}
										</span>
									</label>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="border-b border-[#d6ddd3] py-5 text-sm text-[#527169]">
							Belum ada pemain hadir pada sesi ini.
						</p>
					{/if}
				</section>
			{/if}
		{/if}
	{/if}

	{#if notice}
		<p class="mt-5 border border-[#d6ddd3] bg-[#e5ece5] p-4 text-sm font-bold" role="status">
			{notice}
		</p>
	{/if}
</AppShell>
