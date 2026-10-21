<script lang="ts">
	let {
		failed,
		hasData,
		retry,
		fetching = false
	}: {
		failed: boolean;
		hasData: boolean;
		retry: () => unknown;
		fetching?: boolean;
	} = $props();
</script>

{#if failed}
	<section
		class="court-notice my-4 flex flex-wrap items-center justify-between gap-3 border border-[#e7b8aa] bg-[#fff1ec] p-4 text-sm text-[#9a3d25]"
		role="alert"
	>
		<p>
			{hasData
				? 'Menampilkan data terakhir. Pembaruan belum berhasil.'
				: 'Data belum bisa dimuat. Periksa koneksi lalu coba lagi.'}
		</p>
		<button
			class="min-h-11 rounded-md border border-current px-4 font-black disabled:opacity-50"
			disabled={fetching}
			onclick={() => retry()}>Coba lagi</button
		>
	</section>
{/if}
