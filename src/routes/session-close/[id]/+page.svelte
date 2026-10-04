<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { ArrowLeft } from '@lucide/svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import {
		getClub,
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
	let clubName = $state('PB NEWBIE');
	let session = $state<PublicSessionHistory | null>(null);
	let attendees = $state<FinanceSessionAttendee[]>([]);
	let matchCount = $state(0);
	let fee = $state('');
	let loading = $state(true);
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
		loading = true;
		notice = '';
		try {
			invalidatePublicData();
			const [publicClub, accountClub, history, matches] = await Promise.all([
				getPublicClub(),
				getClub(),
				getPublicSessionHistory(),
				getPublicSessionMatches(params.id)
			]);
			club = accountClub;
			clubName = accountClub?.name ?? publicClub?.name ?? clubName;
			session = history.find((item) => item.id === params.id && item.closed_at) ?? null;
			matchCount = matches.length;
			if (!session) return;
			fee = session.fee_per_person ? String(session.fee_per_person) : '';
			if (isAdmin) {
				if (!fee) {
					const suggestion = await suggestSessionFee(params.id);
					if (suggestion) fee = String(suggestion);
				}
				if (session.fee_per_person)
					attendees = await getFinanceSessionAttendees(accountClub!.id, params.id);
			}
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Data sesi tidak dapat dimuat.';
		} finally {
			loading = false;
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

	async function flushPaidChange(playerId: string): Promise<void> {
		const timer = paidTimers.get(playerId);
		if (timer) {
			clearTimeout(timer);
			paidTimers.delete(playerId);
		}
		if (!club || !session) return;

		const activeWrite = paidWrites.get(playerId);
		if (activeWrite) {
			await activeWrite;
			if (pendingPaidChanges.has(playerId) && !paidTimers.has(playerId))
				await flushPaidChange(playerId);
			return;
		}
		if (!pendingPaidChanges.has(playerId)) return;

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
			await flushPaidChange(playerId);
			return;
		}
		if (saved && !pendingPaidChanges.has(playerId) && !paidTimers.has(playerId))
			await refreshPaymentAttendees(playerId);
	}

	onDestroy(() => {
		for (const playerId of paidTimers.keys()) void flushPaidChange(playerId);
	});

	if (browser) void load();

	async function saveFee() {
		const amount = Number(fee);
		if (!session || !Number.isSafeInteger(amount) || amount <= 0) return;
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
			await goto(resolve('/live'));
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Sesi tidak dapat dibuka kembali.';
		}
	}
</script>

<svelte:head><title>Tutup sesi — {clubName}</title></svelte:head>
<AppShell current="" mode="REKAP SESI" {clubName}>
	<a
		href={resolve('/live')}
		class="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#38675b]"
		><ArrowLeft size={18} />Kembali ke Live</a
	>
	{#if loading}
		<section class="mt-6 border-y border-[#b9c5bb] py-6" role="status" aria-busy="true">
			<p class="text-sm font-bold text-[#527169]">Memuat rekap malam ini…</p>
			<div class="mt-3 h-3 animate-pulse bg-[#d9e2da]"></div>
		</section>
	{:else if !session}
		<section class="mt-6 border-y border-[#b9c5bb] py-6">
			<h1 class="text-3xl font-black tracking-[-0.05em]">Sesi tidak ditemukan</h1>
			<p class="mt-3 text-sm leading-6 text-[#527169]">
				Sesi mungkin belum ditutup atau sudah dihapus.
			</p>
		</section>
	{:else}
		<header
			class="mt-6 border-y border-[#163630] bg-[#163630] px-5 py-6 text-[#fffaf0] shadow-[0_12px_28px_rgba(22,54,48,0.16)]"
		>
			<div class="flex flex-wrap items-start justify-between gap-3">
				<h1 class="text-3xl font-black tracking-[-0.05em]">Rekap sesi selesai</h1>
				{#if isAdmin}
					<a
						class="inline-flex min-h-11 items-center bg-[#e2653e] px-4 text-sm font-black text-[#fffaf0]"
						href={resolve('/session-close/[id]/confirm', { id: params.id })}>Konfirmasi rekap</a
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
			<section class="mt-6 border border-[#b9c5bb] bg-[#fffaf0] p-5">
				<h2 class="text-xl font-black">Masuk sebagai admin klub</h2>
				<p class="mt-2 text-sm leading-6 text-[#527169]">
					Login admin diperlukan untuk menetapkan iuran dan mengubah checklist pembayaran.
				</p>
				<a
					class="mt-4 inline-flex min-h-11 items-center bg-[#163630] px-4 font-black text-[#fffaf0]"
					href={resolve('/live')}
				>
					Ke Live untuk login
				</a>
			</section>
		{:else}
			<section class="mt-6 border-b border-[#b9c5bb] pb-6">
				<h2 class="text-2xl font-black tracking-[-0.04em]">Tetapkan iuran per orang</h2>
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
						<label class="block text-sm font-bold" for="session-fee">Iuran per orang</label>
						<div class="mt-2 flex items-stretch gap-3">
							<span class="flex items-center border border-[#b9c5bb] bg-[#e5ece5] px-4 font-black"
								>Rp</span
							>
							<input
								id="session-fee"
								class="min-h-14 min-w-0 flex-1 border border-[#163630] bg-[#fffaf0] px-4 text-xl font-black tabular-nums"
								inputmode="numeric"
								required
								min="1"
								bind:value={fee}
							/>
						</div>
						<p class="mt-3 text-sm font-bold text-[#527169]">Total tagihan: {money(totalDue)}</p>
						<div class="mt-5 flex flex-wrap gap-3">
							<AppButton type="submit" disabled={savingFee || !Number(fee)}>
								{savingFee ? 'Menyimpan…' : 'Konfirmasi iuran & buat tagihan'}
							</AppButton>
							<AppButton variant="secondary" onclick={reopen}>Buka lagi sesi</AppButton>
						</div>
					</form>
				{:else}
					<p class="mt-4 text-3xl font-black tabular-nums">
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
						class="flex flex-wrap items-end justify-between gap-3 border-b border-[#b9c5bb] pb-4"
					>
						<div>
							<h2 class="text-2xl font-black tracking-[-0.04em]">Checklist pembayaran</h2>
							<p class="mt-1 text-sm text-[#527169]">Centang pemain yang sudah membayar.</p>
						</div>
						<p class="text-sm font-black tabular-nums">
							{paidCount}/{attendees.length} lunas
						</p>
					</div>
					{#if attendees.length}
						<ul class="divide-y divide-[#b9c5bb] border-b border-[#b9c5bb]">
							{#each attendees as person (person.player_id)}
								<li>
									<label class="flex min-h-16 cursor-pointer items-center gap-4 py-3">
										<input
											type="checkbox"
											class="size-6 accent-[#163630]"
											checked={isPaid(person)}
											onchange={(event) => queuePaidChange(person, event.currentTarget.checked)}
										/>
										<span class="min-w-0 flex-1">
											<b class="block truncate">{person.display_name}</b>
											<span class="text-sm text-[#527169]">{money(person.amount)}</span>
										</span>
										<span
											class={isPaid(person)
												? 'text-sm font-black text-[#38675b]'
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
						<p class="border-b border-[#b9c5bb] py-5 text-sm text-[#527169]">
							Belum ada pemain hadir pada sesi ini.
						</p>
					{/if}
				</section>
			{/if}
		{/if}
	{/if}

	{#if notice}
		<p class="mt-5 border border-[#b9c5bb] bg-[#e5ece5] p-4 text-sm font-bold" role="status">
			{notice}
		</p>
	{/if}
</AppShell>
