<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	import { currentUser } from '$lib/auth';
	import { getClub, getPublicClub, type Club } from '$lib/data/dashboard';
	import { supabase } from '$lib/supabase';
	let club = $state<Club | null>(null);
	let publicClub = $state<{ id: string; name: string } | null>(null);
	let email = $state<string | null>(null);
	let loading = $state(true);
	let clubName = $derived(club?.name ?? publicClub?.name ?? 'PB NEWBIE');
	let isAdmin = $derived(Boolean(club?.is_club_admin || club?.is_finance_admin));
	function signOut() {
		void supabase?.auth.signOut();
		email = null;
		club = null;
	}
	if (browser)
		void (async () => {
			try {
				[publicClub, club] = await Promise.all([getPublicClub(), getClub()]);
				email = (await currentUser())?.email ?? null;
			} finally {
				loading = false;
			}
		})();
</script>

<svelte:head><title>Pengaturan — PB NEWBIE</title></svelte:head>
<AppShell current="/settings" {clubName}>
	<section class="border-b border-[#b9c5bb] pb-5">
		<h1 class="text-3xl font-black tracking-[-0.05em]">Pengaturan</h1>
		<p class="mt-2 text-sm leading-6 text-[#527169]">
			Rumah permanen untuk informasi dan otoritas klub.
		</p>
	</section>
	{#if loading}<div
			class="mt-5 grid gap-4"
			aria-busy="true"
			aria-label="Memeriksa akses pengaturan…"
		>
			{#each [1, 2, 3] as row (row)}<section
					class="flex min-h-18 items-center justify-between border border-[#b9c5bb] bg-[#fffaf0] px-5 py-4"
					aria-hidden="true"
				>
					<div class="space-y-2">
						<div class="w-24"><LoadingSkeleton height="1.25rem" /></div>
						<div class="w-48"><LoadingSkeleton height="0.75rem" /></div>
					</div>
					<div class="w-4"><LoadingSkeleton /></div>
				</section>{/each}
		</div>
	{:else if isAdmin}<div class="mt-5 grid gap-4">
			<section class="border border-[#b9c5bb] bg-[#fffaf0]">
				<a
					href={resolve('/settings')}
					class="flex min-h-18 items-center justify-between px-5 py-4 hover:bg-[#e5ece5]"
					><span
						><b class="block text-lg">Klub</b><span class="mt-1 block text-sm text-[#527169]"
							>{clubName} · nama dan tampilan klub</span
						></span
					><span class="text-lg text-[#38675b]">›</span></a
				>
			</section>
			<section class="border border-[#b9c5bb] bg-[#fffaf0]">
				<a
					href={resolve('/settings')}
					class="flex min-h-18 items-center justify-between px-5 py-4 hover:bg-[#e5ece5]"
					><span
						><b class="block text-lg">Pembayaran</b><span class="mt-1 block text-sm text-[#527169]"
							>Bank, ShopeePay, dan QRIS</span
						></span
					><span class="text-lg text-[#38675b]">›</span></a
				>
			</section>
			<section class="border border-[#b9c5bb] bg-[#fffaf0]">
				<a
					href={resolve('/settings')}
					class="flex min-h-18 items-center justify-between px-5 py-4 hover:bg-[#e5ece5]"
					><span
						><b class="block text-lg">Akses</b><span class="mt-1 block text-sm text-[#527169]"
							>Club Admin dan Finance Admin</span
						></span
					><span class="text-lg text-[#38675b]">›</span></a
				>
			</section>
			<section class="border border-[#b9c5bb] bg-[#fffaf0] p-5">
				<h2 class="text-lg font-black">Akun</h2>
				<p class="mt-1 text-sm text-[#527169]">{email ?? 'Admin klub'}</p>
				<div class="mt-4"><AppButton variant="secondary" onclick={signOut}>Keluar</AppButton></div>
			</section>
		</div>
	{:else}<section class="mt-5 border border-[#b9c5bb] bg-[#fffaf0] p-7">
			<h2 class="text-2xl font-black">Khusus admin klub.</h2>
			<p class="mt-3 max-w-sm text-sm leading-6 text-[#527169]">
				Pengaturan klub, tujuan pembayaran, dan otoritas hanya tersedia setelah masuk sebagai Club
				Admin atau Finance Admin.
			</p>
			<a
				class="mt-5 inline-flex min-h-11 items-center bg-[#163630] px-4 text-sm font-black text-[#fffaf0]"
				href={resolve('/live')}>Kembali ke Live</a
			>
		</section>{/if}
</AppShell>
