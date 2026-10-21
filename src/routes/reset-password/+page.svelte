<script lang="ts">
	import AuthFrame from '$lib/components/ui/AuthFrame.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { supabase } from '$lib/supabase';
	import { invalidatePublicData } from '$lib/data/dashboard';
	import { setCachedClub } from '$lib/auth-state.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	let checking = $state(true);
	let authorized = $state(false);
	let password = $state('');
	let confirmation = $state('');
	let pending = $state(false);
	let saved = $state(false);
	let error = $state('');
	const queryClient = useQueryClient();
	onMount(() => {
		let active = true;
		void (async () => {
			try {
				if (!supabase) throw new Error('Layanan akun belum dikonfigurasi.');
				const result = await supabase.auth.getUser();
				if (!active) return;
				authorized = !result.error && Boolean(result.data.user);
				if (!authorized)
					error = 'Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru.';
			} catch {
				if (active)
					error = 'Tidak dapat memeriksa tautan. Coba buka kembali saat koneksi tersedia.';
			} finally {
				if (active) checking = false;
			}
		})();
		return () => {
			active = false;
		};
	});
	async function save() {
		if (!authorized || !supabase || pending) return;
		if (!saved && password !== confirmation) {
			error = 'Kedua kata sandi harus sama.';
			return;
		}
		pending = true;
		error = '';
		try {
			if (!saved) {
				const result = await supabase.auth.updateUser({ password });
				if (result.error) throw result.error;
				saved = true;
				password = '';
				confirmation = '';
			}
			const result = await supabase.auth.signOut();
			if (result.error)
				throw new Error(
					'Kata sandi tersimpan, tetapi akun belum keluar. Coba lanjutkan ke masuk lagi.'
				);
			queryClient.clear();
			invalidatePublicData();
			setCachedClub(null);
			await goto(resolve('/start?password=updated'));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Kata sandi belum tersimpan. Coba lagi.';
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head
	><title>Kata sandi baru — Courtside</title><meta name="robots" content="noindex" /><meta
		name="referrer"
		content="no-referrer"
	/></svelte:head
>
<AuthFrame>
	<h1 class="text-4xl font-bold tracking-tight">Kata sandi baru.</h1>
	{#if checking}<p role="status" class="mt-5">Memeriksa tautan…</p>
	{:else if authorized}
		{#if saved}<p role="status" class="mt-5">Kata sandi tersimpan.</p>{/if}
		<form
			class="mt-6"
			onsubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			{#if !saved}
				<label class="block font-bold" for="new-password">Kata sandi baru</label>
				<input
					id="new-password"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					bind:value={password}
					disabled={pending}
					class="mt-2 min-h-12 w-full rounded-md border border-[#d6ddd3] bg-[#fffaf0] px-3"
				/>
				<p class="mt-2 text-xs text-[#527169]">Minimal 8 karakter.</p>
				<label class="mt-5 block font-bold" for="confirm-password">Ulangi kata sandi</label>
				<input
					id="confirm-password"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					bind:value={confirmation}
					disabled={pending}
					class="mt-2 min-h-12 w-full rounded-md border border-[#d6ddd3] bg-[#fffaf0] px-3"
				/>
			{/if}
			<AppButton type="submit" disabled={pending} class="mt-6 w-full justify-center"
				>{pending ? 'Memproses…' : saved ? 'Lanjutkan ke masuk' : 'Simpan kata sandi'}</AppButton
			>
		</form>
	{/if}
	{#if error}<p
			role="alert"
			class="mt-5 rounded-md border border-[#e7b8aa] bg-[#fff1ec] p-4 text-sm"
		>
			{error}
		</p>{/if}
	<a
		href={resolve('/start')}
		class="mt-5 inline-flex min-h-11 items-center text-sm font-bold underline">Kembali ke masuk</a
	>
</AuthFrame>
