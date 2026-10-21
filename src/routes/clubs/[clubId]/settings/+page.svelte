<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { selectedClubId } from '$lib/club-context';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { ArrowLeft } from '@lucide/svelte';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import { currentUser } from '$lib/auth';
	import { setCachedClub } from '$lib/auth-state.svelte';
	import { getClub, getPublicClub, invalidatePublicData } from '$lib/data/dashboard';
	import {
		getClubSettings,
		publicPaymentDestinationsQueryKey,
		updateClubSettings,
		type ClubSettings,
		type ClubSettingsInput
	} from '$lib/data/club-settings';
	import { supabase } from '$lib/supabase';

	type SettingsForm = {
		name: string;
		bankName: string;
		bankAccountName: string;
		bankAccountNumber: string;
		shopeepayName: string;
		shopeepayNumber: string;
		qrisImageUrl: string;
		publishPublicly: boolean;
	};

	const emptyForm: SettingsForm = {
		name: 'Klub',
		bankName: '',
		bankAccountName: '',
		bankAccountNumber: '',
		shopeepayName: '',
		shopeepayNumber: '',
		qrisImageUrl: '',
		publishPublicly: false
	};

	const queryClient = useQueryClient();
	const clubId = selectedClubId();
	const accountQuery = createQuery(() => ({
		queryKey: ['settings', 'account', clubId],
		queryFn: async () => {
			const [club, publicClub, user] = await Promise.all([
				getClub(clubId),
				getPublicClub(clubId).catch(() => null),
				currentUser()
			]);
			return { club, publicClub, email: user?.email ?? null };
		},
		enabled: browser,
		staleTime: 30_000
	}));
	const club = $derived(accountQuery.data?.club ?? null);
	const clubName = $derived(club?.name ?? accountQuery.data?.publicClub?.name ?? 'Klub');
	const isAdmin = $derived(Boolean(club?.is_club_admin));
	const clubSettingsQuery = createQuery(() => ({
		queryKey: ['settings', 'club', club?.id],
		queryFn: () => getClubSettings(club!.id),
		enabled: browser && isAdmin && Boolean(club?.id),
		staleTime: 60_000
	}));
	const saveMutation = createMutation(() => ({
		mutationFn: ({ clubId, settings }: { clubId: string; settings: ClubSettingsInput }) =>
			updateClubSettings(clubId, settings),
		onSuccess: async (_result, variables) => {
			invalidatePublicData();
			setCachedClub({ ...club!, name: variables.settings.name });
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['settings', 'account', clubId] }),
				queryClient.invalidateQueries({ queryKey: ['settings', 'club', variables.clubId] }),
				queryClient.invalidateQueries({
					queryKey: publicPaymentDestinationsQueryKey(variables.clubId)
				})
			]);
			notice = 'Pengaturan tersimpan.';
		}
	}));
	let form = $state<SettingsForm>({ ...emptyForm });
	let savedForm = $state<SettingsForm | null>(null);
	let formClubId = $state('');
	let notice = $state('');
	let errorMessage = $state('');
	let signOutPending = $state(false);
	let settingsRecord = $derived(clubSettingsQuery.data ?? null);
	let formReady = $derived(Boolean(settingsRecord && formClubId === settingsRecord.club_id));
	let dirty = $derived(Boolean(savedForm && JSON.stringify(form) !== JSON.stringify(savedForm)));
	let hasDestination = $derived(
		Boolean(
			form.bankAccountNumber.trim() || form.shopeepayNumber.trim() || form.qrisImageUrl.trim()
		)
	);
	let canSave = $derived(
		formReady &&
			!saveMutation.isPending &&
			dirty &&
			form.name.trim().length >= 2 &&
			form.name.trim().length <= 60 &&
			(!form.publishPublicly || hasDestination)
	);

	function fromSettings(settings: ClubSettings): SettingsForm {
		return {
			name: settings.name,
			bankName: settings.bank_name ?? '',
			bankAccountName: settings.bank_account_name ?? '',
			bankAccountNumber: settings.bank_account_number ?? '',
			shopeepayName: settings.shopeepay_name ?? '',
			shopeepayNumber: settings.shopeepay_number ?? '',
			qrisImageUrl: settings.qris_image_url ?? '',
			publishPublicly: settings.publish_publicly
		};
	}

	function toSettings(input: SettingsForm): ClubSettingsInput {
		const optional = (value: string) => value.trim() || null;
		return {
			name: input.name.trim(),
			bank_name: optional(input.bankName),
			bank_account_name: optional(input.bankAccountName),
			bank_account_number: optional(input.bankAccountNumber),
			shopeepay_name: optional(input.shopeepayName),
			shopeepay_number: optional(input.shopeepayNumber),
			qris_image_url: optional(input.qrisImageUrl),
			publish_publicly: input.publishPublicly
		};
	}

	$effect(() => {
		const settings = settingsRecord;
		if (!settings || formClubId === settings.club_id) return;
		form = fromSettings(settings);
		savedForm = { ...form };
		formClubId = settings.club_id;
	});

	async function saveSettings(event: SubmitEvent) {
		event.preventDefault();
		if (!club || !canSave) return;
		notice = '';
		errorMessage = '';
		try {
			await saveMutation.mutateAsync({ clubId: club.id, settings: toSettings(form) });
			savedForm = { ...form };
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Pengaturan belum tersimpan. Coba lagi.';
		}
	}

	async function signOut() {
		if (!supabase || signOutPending) return;
		signOutPending = true;
		errorMessage = '';
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			setCachedClub(null);
			await queryClient.removeQueries({ queryKey: ['settings'] });
			await goto(resolve('/clubs/[clubId]/live', { clubId: selectedClubId() }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Belum bisa keluar. Coba lagi.';
		} finally {
			signOutPending = false;
		}
	}
</script>

<svelte:head><title>Pengaturan — {clubName}</title></svelte:head>
<AppShell current="/settings" {clubName}>
	<section class="border-b border-[#d6ddd3] pb-5">
		<h1 class="text-3xl font-bold tracking-[-0.035em]">Pengaturan</h1>
		<p class="mt-2 text-sm leading-6 text-[#527169]">
			Atur profil klub dan petunjuk pembayaran manual.
		</p>
	</section>

	{#if accountQuery.isPending && !accountQuery.data}
		<div class="mt-5 grid gap-4" aria-busy="true" aria-label="Memeriksa akses pengaturan…">
			{#each [1, 2, 3] as row (row)}<section
					class="court-panel flex min-h-18 items-center justify-between border border-[#d6ddd3] bg-[#fffaf0] px-5 py-4"
					aria-hidden="true"
				>
					<div class="space-y-2">
						<div class="w-24"><LoadingSkeleton height="1.25rem" /></div>
						<div class="w-48"><LoadingSkeleton height="0.75rem" /></div>
					</div>
					<div class="w-4"><LoadingSkeleton /></div>
				</section>{/each}
		</div>
	{:else if accountQuery.isError && !accountQuery.data}
		<section class="court-panel mt-5 border-y border-[#d6ddd3] bg-[#fffaf0] p-5" role="alert">
			<h2 class="text-lg font-bold">Pengaturan belum bisa dimuat.</h2>
			<p class="mt-2 text-sm text-[#527169]">Periksa koneksi lalu coba lagi.</p>
			<AppButton class="mt-4" variant="secondary" onclick={() => void accountQuery.refetch()}
				>Coba lagi</AppButton
			>
		</section>
	{:else if isAdmin}
		{#if clubSettingsQuery.isPending && !clubSettingsQuery.data}
			<section
				class="court-panel mt-5 space-y-3 border border-[#d6ddd3] bg-[#fffaf0] p-5"
				aria-busy="true"
				aria-label="Memuat pengaturan klub"
			>
				<LoadingSkeleton height="1.25rem" />
				<LoadingSkeleton height="2.75rem" />
				<LoadingSkeleton height="2.75rem" />
			</section>
		{:else if clubSettingsQuery.isError && !clubSettingsQuery.data}
			<section class="court-panel mt-5 border-y border-[#d6ddd3] bg-[#fffaf0] p-5" role="alert">
				<h2 class="text-lg font-bold">Data klub belum bisa dimuat.</h2>
				<p class="mt-2 text-sm text-[#527169]">Pengaturan belum berubah.</p>
				<AppButton class="mt-4" variant="secondary" onclick={() => void clubSettingsQuery.refetch()}
					>Coba lagi</AppButton
				>
			</section>
		{:else if formReady}
			{#if accountQuery.isError || clubSettingsQuery.isError}<p
					class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm text-[#9a3d25]"
					role="status"
				>
					Menampilkan data terakhir yang berhasil dimuat. Periksa koneksi untuk memperbarui.
				</p>{/if}
			<form class="mt-5 grid gap-5" onsubmit={saveSettings}>
				<section class="court-panel border border-[#d6ddd3] bg-[#fffaf0] p-5">
					<h2 class="text-xl font-bold">Profil klub</h2>
					<p class="mt-1 text-sm leading-6 text-[#527169]">
						Nama ini tampil di navigasi dan halaman publik klub.
					</p>
					<label class="mt-4 block text-sm font-bold" for="club-name">Nama klub</label>
					<input
						id="club-name"
						class="mt-2 min-h-12 w-full rounded-md border border-[#d6ddd3] bg-white px-3 text-base"
						bind:value={form.name}
						maxlength="60"
						required
						minlength="2"
					/>
				</section>

				<section class="court-panel border border-[#d6ddd3] bg-[#fffaf0] p-5">
					<h2 class="text-xl font-bold">Tujuan pembayaran</h2>
					<p class="mt-1 text-sm leading-6 text-[#527169]">
						Isi metode yang dipakai klub. Petunjuk ini tidak mencatat atau mengonfirmasi pembayaran;
						admin tetap menandai pembayaran di Kas.
					</p>

					<fieldset class="mt-5 grid gap-4">
						<legend class="text-sm font-bold">Transfer bank</legend>
						<label class="grid gap-2 text-sm font-bold" for="bank-name"
							>Nama bank
							<input
								id="bank-name"
								class="min-h-12 rounded-md border border-[#d6ddd3] bg-white px-3 font-normal"
								bind:value={form.bankName}
								maxlength="60"
								placeholder="BCA"
							/>
						</label>
						<label class="grid gap-2 text-sm font-bold" for="bank-account-name"
							>Nama pemilik rekening
							<input
								id="bank-account-name"
								class="min-h-12 rounded-md border border-[#d6ddd3] bg-white px-3 font-normal"
								bind:value={form.bankAccountName}
								maxlength="100"
							/>
						</label>
						<label class="grid gap-2 text-sm font-bold" for="bank-account-number"
							>Nomor rekening
							<input
								id="bank-account-number"
								class="min-h-12 rounded-md border border-[#d6ddd3] bg-white px-3 font-normal"
								bind:value={form.bankAccountNumber}
								maxlength="40"
								inputmode="numeric"
							/>
						</label>
					</fieldset>

					<fieldset class="mt-6 grid gap-4 border-t border-[#d6ddd3] pt-5">
						<legend class="text-sm font-bold">ShopeePay</legend>
						<label class="grid gap-2 text-sm font-bold" for="shopeepay-name"
							>Nama akun
							<input
								id="shopeepay-name"
								class="min-h-12 rounded-md border border-[#d6ddd3] bg-white px-3 font-normal"
								bind:value={form.shopeepayName}
								maxlength="100"
							/>
						</label>
						<label class="grid gap-2 text-sm font-bold" for="shopeepay-number"
							>Nomor HP
							<input
								id="shopeepay-number"
								class="min-h-12 rounded-md border border-[#d6ddd3] bg-white px-3 font-normal"
								bind:value={form.shopeepayNumber}
								maxlength="40"
								inputmode="tel"
							/>
						</label>
					</fieldset>

					<fieldset class="mt-6 grid gap-4 border-t border-[#d6ddd3] pt-5">
						<legend class="text-sm font-bold">QRIS</legend>
						<label class="grid gap-2 text-sm font-bold" for="qris-url"
							>Tautan gambar QRIS
							<input
								id="qris-url"
								class="min-h-12 rounded-md border border-[#d6ddd3] bg-white px-3 font-normal"
								bind:value={form.qrisImageUrl}
								type="url"
								placeholder="https://…"
							/>
						</label>
						<p class="text-xs leading-5 text-[#527169]">
							Gunakan tautan gambar HTTPS yang dapat dibuka publik. Gambar hanya ditampilkan jika
							kamu mengaktifkan publikasi di bawah.
						</p>
					</fieldset>

					<label
						class="mt-6 flex min-h-14 items-start gap-3 border-t border-[#d6ddd3] pt-5 text-sm font-bold"
					>
						<input
							class="mt-1 size-5 rounded-md accent-[#163630]"
							type="checkbox"
							bind:checked={form.publishPublicly}
						/>
						<span>
							Tampilkan tujuan pembayaran di halaman Kas publik
							<span class="mt-1 block text-xs leading-5 font-normal text-[#527169]">
								Siapa pun yang membuka tautan klub dapat melihat nomor rekening, nomor ShopeePay,
								dan gambar QRIS yang diisi.
							</span>
						</span>
					</label>
					{#if form.publishPublicly && !hasDestination}
						<p class="mt-2 text-sm font-bold text-[#9a3d25]" role="status">
							Isi setidaknya satu nomor rekening, nomor ShopeePay, atau tautan gambar QRIS.
						</p>
					{/if}
				</section>

				<section class="court-panel border border-[#d6ddd3] bg-[#fffaf0] p-5">
					<h2 class="text-xl font-bold">Akses admin</h2>
					<p class="mt-1 text-sm leading-6 text-[#527169]">
						Akun yang sedang masuk dan memiliki wewenang Club Admin dapat mengubah pengaturan dan
						data klub. Pengaturan ini tidak menambah peran atau akun admin baru.
					</p>
					<p class="mt-3 text-sm font-bold break-all">{accountQuery.data?.email ?? 'Admin klub'}</p>
				</section>

				<section
					class="flex flex-wrap items-center justify-between gap-3 border-t border-[#d6ddd3] pt-4"
				>
					<AppButton type="submit" disabled={!canSave}>
						{saveMutation.isPending ? 'Menyimpan…' : 'Simpan pengaturan'}
					</AppButton>
					<AppButton type="button" variant="secondary" onclick={signOut} disabled={signOutPending}>
						{signOutPending ? 'Keluar…' : 'Keluar'}
					</AppButton>
				</section>
			</form>
		{/if}
	{:else}
		<section class="court-panel mt-5 border border-[#d6ddd3] bg-[#fffaf0] p-7">
			<h2 class="text-2xl font-bold">Khusus admin klub.</h2>
			<p class="mt-3 max-w-sm text-sm leading-6 text-[#527169]">
				Pengaturan klub hanya tersedia setelah masuk dengan akun Club Admin.
			</p>
			<a
				class="mt-5 inline-flex min-h-11 items-center gap-2 bg-[#163630] px-4 text-sm font-bold text-[#fffaf0]"
				href={resolve('/clubs/[clubId]/live', { clubId: selectedClubId() })}
				><ArrowLeft size={18} />Kembali ke Live</a
			>
		</section>
	{/if}

	{#if notice}<p
			class="mt-4 border border-[#a7c5b9] bg-[#e5ece5] p-3 text-sm font-bold"
			role="status"
		>
			{notice}
		</p>{/if}
	{#if errorMessage}<p
			class="mt-4 border border-[#e7b8aa] bg-[#fff1ec] p-3 text-sm font-bold text-[#9a3d25]"
			role="alert"
		>
			{errorMessage}
		</p>{/if}
</AppShell>
