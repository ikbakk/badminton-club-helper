<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { supabase } from '$lib/supabase';
	import { currentUser, signInWithPassword } from '$lib/auth';
	import { bootstrapClub, invalidatePublicData, type Club } from '$lib/data/dashboard';
	import { setCachedClub } from '$lib/auth-state.svelte';
	import AppButton from '$lib/components/ui/AppButton.svelte';
	import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
	let signup = $state(page.url.searchParams.get('mode') === 'signup');
	let recovery = $state(false);
	let email = $state('');
	let password = $state('');
	let clubName = $state('');
	let userEmail = $state<string | null>(null);
	let clubs = $state<Club[]>([]);
	let loading = $state(true);
	let accountLoadFailed = $state(false);
	let pending = $state(false);
	let notice = $state(
		page.url.searchParams.get('password') === 'updated'
			? 'Kata sandi diperbarui. Masuk dengan kata sandi baru.'
			: ''
	);
	let error = $state('');
	const queryClient = useQueryClient();
	function message(e: unknown) {
		return e && typeof e === 'object' && 'message' in e
			? String(e.message)
			: 'Belum berhasil. Coba lagi.';
	}
	async function loadAccount() {
		loading = true;
		accountLoadFailed = false;
		error = '';
		try {
			const user = await currentUser();
			userEmail = user?.email ?? null;
			if (user && supabase) {
				const result = await supabase.rpc('my_club');
				if (result.error) throw result.error;
				clubs = result.data ?? [];
			} else clubs = [];
		} catch (e) {
			accountLoadFailed = true;
			error = message(e);
		} finally {
			loading = false;
		}
	}
	onMount(() => {
		void loadAccount();
		const subscription = supabase?.auth.onAuthStateChange(() => {
			queueMicrotask(() => {
				queryClient.clear();
				invalidatePublicData();
				setCachedClub(null);
				void loadAccount();
			});
		});
		return () => subscription?.data.subscription.unsubscribe();
	});
	async function authenticate() {
		let justSignedIn = false;
		pending = true;
		error = '';
		notice = '';
		try {
			if (!supabase)
				throw new Error('Layanan akun belum dikonfigurasi. Hubungi pengelola aplikasi.');
			if (recovery) {
				const result = await supabase.auth.resetPasswordForEmail(email, {
					redirectTo: new URL(resolve('/reset-password'), window.location.origin).href
				});
				if (result.error) throw result.error;
				notice =
					'Jika email terdaftar, tautan pemulihan akan dikirim. Periksa email dan folder spam.';
				return;
			} else if (signup) {
				const { data, error: authError } = await supabase.auth.signUp({
					email,
					password,
					options: { emailRedirectTo: new URL(resolve('/start'), window.location.origin).href }
				});
				if (authError) throw authError;
				if (!data.session) {
					notice =
						'Periksa email untuk mengonfirmasi akun. Setelah itu, masuk di sini untuk membuat klub.';
					signup = false;
					password = '';
					return;
				}
			} else {
				await signInWithPassword(email, password);
				justSignedIn = true;
			}
			password = '';
			await loadAccount();
			if (justSignedIn && !accountLoadFailed)
				notice = 'Kamu sudah masuk. Pilih klub untuk melanjutkan.';
		} catch (e) {
			error = message(e);
		} finally {
			pending = false;
		}
	}
	async function createClub() {
		pending = true;
		error = '';
		try {
			const id = await bootstrapClub(clubName);
			invalidatePublicData();
			queryClient.clear();
			await goto(resolve('/clubs/[clubId]/live', { clubId: id }));
		} catch (e) {
			error = message(e);
		} finally {
			pending = false;
		}
	}
	async function signOut() {
		pending = true;
		try {
			const result = await supabase?.auth.signOut();
			if (result?.error) throw result.error;
			setCachedClub(null);
			queryClient.clear();
			invalidatePublicData();
			await loadAccount();
		} catch (e) {
			error = message(e);
		} finally {
			pending = false;
		}
	}
</script>

<svelte:head
	><title>{userEmail ? 'Klub saya' : signup ? 'Buat akun' : 'Masuk'} — Courtside</title><meta
		name="robots"
		content="noindex"
	/></svelte:head
>
<main class="mx-auto min-h-dvh max-w-lg px-5 py-8 text-[#163630]">
	<a href={resolve('/')} class="inline-flex min-h-11 items-center font-black">← Courtside</a>
	<section class="mt-10 border-y border-[#b9c5bb] py-8">
		{#if loading}
			<div
				class="grid gap-4 py-2"
				role="status"
				aria-busy="true"
				aria-label="Memeriksa akun dan klub"
			>
				<div class="max-w-xs"><LoadingSkeleton height="1.5rem" /></div>
				<div class="max-w-md"><LoadingSkeleton height="2.5rem" /></div>
				<div class="max-w-sm"><LoadingSkeleton height="1rem" /></div>
				<div class="mt-2"><LoadingSkeleton height="4.5rem" /></div>
			</div>
		{:else if accountLoadFailed}
			<div role="alert">
				<h1 class="text-2xl font-black tracking-tight">Klub belum bisa dimuat.</h1>
				<p class="mt-3 text-sm leading-6 text-[#527169]">
					{error || 'Daftar klub belum berhasil dibaca. Coba periksa lagi.'}
				</p>
				<AppButton class="mt-5" onclick={() => void loadAccount()} disabled={pending}
					>Coba lagi</AppButton
				>
			</div>
		{:else if userEmail}
			<p class="text-xs font-black tracking-widest text-[#527169]">AKUN ADMIN</p>
			<h1 class="mt-3 text-4xl font-black tracking-tight">
				{clubs.length ? 'Klub saya.' : 'Buat klubmu.'}
			</h1>
			<p class="mt-3 text-sm break-all text-[#527169]">{userEmail}</p>
			{#if clubs.length}
				{#each clubs as club (club.id)}<a
						class="mt-6 flex min-h-16 items-center justify-between border border-[#b9c5bb] bg-[#fffaf0] p-4 font-black"
						href={resolve('/clubs/[clubId]/live', { clubId: club.id })}
						>{club.name}<span aria-hidden="true">→</span></a
					>{/each}
			{:else}
				<p class="mt-5 text-sm leading-6">
					Kamu menjadi admin klub ini. Anggota bisa melihat sesi melalui tautan klub tanpa membuat
					akun.
				</p>
				<form
					class="mt-6"
					onsubmit={(event) => {
						event.preventDefault();
						void createClub();
					}}
				>
					<label class="block font-bold" for="club-name">Nama klub</label><input
						id="club-name"
						class="mt-2 min-h-12 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3"
						bind:value={clubName}
						required
						minlength="2"
						maxlength="80"
						placeholder="Contoh: Klub Sabtu"
						disabled={pending}
					/>
					<AppButton
						type="submit"
						class="mt-5 w-full justify-center"
						disabled={pending || clubName.trim().length < 2}
						>{pending ? 'Membuat klub…' : 'Buat klub'}</AppButton
					>
				</form>
			{/if}
			<AppButton class="mt-6" variant="ghost" onclick={signOut} disabled={pending}
				>Keluar dari akun</AppButton
			>
		{:else}
			<p class="text-xs font-black tracking-widest text-[#527169]">MULAI DARI KLUB KAMU</p>
			<h1 class="mt-3 text-4xl font-black tracking-tight">
				{recovery ? 'Pulihkan akun.' : signup ? 'Buat akun admin.' : 'Selamat datang lagi.'}
			</h1>
			<p class="mt-4 text-sm leading-6 text-[#527169]">
				{recovery
					? 'Kami akan mengirim tautan untuk membuat kata sandi baru.'
					: signup
						? 'Buat akun, beri nama klub, lalu siapkan sesi pertama.'
						: 'Masuk untuk membuka klub yang kamu kelola.'}
			</p>
			<form
				class="mt-6"
				onsubmit={(event) => {
					event.preventDefault();
					void authenticate();
				}}
			>
				<label class="block font-bold" for="email">Email</label><input
					id="email"
					type="email"
					autocomplete="email"
					class="mt-2 min-h-12 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3"
					bind:value={email}
					required
					disabled={pending}
				/>
				{#if !recovery}<label class="mt-5 block font-bold" for="password">Kata sandi</label><input
						id="password"
						type="password"
						autocomplete={signup ? 'new-password' : 'current-password'}
						minlength={signup ? 8 : undefined}
						class="mt-2 min-h-12 w-full border border-[#b9c5bb] bg-[#fffaf0] px-3"
						bind:value={password}
						required
						disabled={pending}
					/>
					{#if signup}<p class="mt-2 text-xs text-[#527169]">
							Minimal 8 karakter. Konfirmasi email mungkin diperlukan.
						</p>{/if}{/if}
				<AppButton type="submit" class="mt-6 w-full justify-center" disabled={pending}
					>{pending
						? 'Memproses…'
						: recovery
							? 'Kirim tautan pemulihan'
							: signup
								? 'Buat akun'
								: 'Masuk'}</AppButton
				>
			</form>
			<button
				class="mt-4 min-h-11 text-sm font-bold underline"
				disabled={pending}
				onclick={() => {
					if (recovery) recovery = false;
					else signup = !signup;
					error = '';
					notice = '';
				}}
				>{recovery
					? 'Kembali ke masuk'
					: signup
						? 'Sudah punya akun? Masuk'
						: 'Belum punya akun? Buat akun'}</button
			>
			{#if !signup && !recovery}<button
					class="ml-4 min-h-11 text-sm font-bold underline"
					disabled={pending}
					onclick={() => {
						recovery = true;
						error = '';
						notice = '';
						password = '';
					}}>Lupa kata sandi?</button
				>{/if}
			<p class="mt-6 border-t border-[#b9c5bb] pt-5 text-sm leading-6 text-[#527169]">
				Hanya ingin melihat sesi? Buka tautan klub yang dibagikan admin.
			</p>
		{/if}
		{#if error && !accountLoadFailed}<p
				role="alert"
				class="mt-5 border-l-4 border-[#9a3d25] bg-[#fff1ec] p-4 text-sm"
			>
				{error}
			</p>{/if}
		{#if notice}<p role="status" class="mt-5 border-l-4 border-[#38675b] bg-[#e5ece5] p-4 text-sm">
				{notice}
			</p>{/if}
	</section>
</main>
