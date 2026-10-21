<script lang="ts">
	import Avatar from '$lib/components/ui/Avatar.svelte';
	let { compact = false }: { compact?: boolean } = $props();
	const next = ['Dara', 'Raka', 'Nina', 'Bima'];
</script>

<div
	class:compact
	class="session-preview"
	aria-label="Contoh tampilan pertandingan dengan data fiktif"
>
	<div class="sample-match">
		<div class="sample-club"><strong>Klub Sabtu</strong><span>Contoh</span></div>
		<p class="sample-meta">Match 3 · Set 1 selesai</p>
		<div class="sample-teams"><span>Andi + Sari</span><span>Dika + Reno</span></div>
		<div class="sample-scores"><span>21</span><b>:</b><span>18</span></div>
		<p class="sample-result">Skor akhir set</p>
	</div>
	<div class="sample-next">
		<strong>Berikutnya</strong>
		<div>
			{#each next as name (name)}<span><Avatar {name} size="sm" /><small>{name}</small></span
				>{/each}
		</div>
	</div>
	<p class="caption">Tampilan contoh · data fiktif</p>
</div>

<style>
	.session-preview {
		width: 100%;
		color: var(--court-chalk);
	}
	.sample-match {
		background: var(--court-ink);
		border: 1px solid #789586;
		border-radius: 10px;
		padding: 19px 18px 24px;
		box-shadow: 0 12px 30px rgb(12 36 31 / 24%);
	}
	.sample-club {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-size: 11px;
	}
	.sample-club span {
		font-size: 9px;
		color: #d2ddd4;
		border: 1px solid #577c6c;
		border-radius: 20px;
		padding: 3px 7px;
	}
	.sample-meta {
		text-align: center;
		font-size: 10px;
		margin: 24px 0 18px;
		color: #d2ddd4;
	}
	.sample-teams {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
		text-align: center;
		font-size: 11px;
		font-weight: 650;
	}
	.sample-scores {
		display: grid;
		grid-template-columns: 1fr 14px 1fr;
		align-items: center;
		gap: 12px;
		margin-top: 12px;
		text-align: center;
	}
	.sample-scores span {
		border: 1px solid #66877a;
		border-radius: 6px;
		background: rgb(255 250 240 / 7%);
		font-size: 40px;
		font-weight: 800;
		padding: 6px 0;
		font-variant-numeric: tabular-nums;
	}
	.sample-scores b {
		font-size: 20px;
	}
	.sample-result {
		font-size: 9px;
		text-align: center;
		color: #d2ddd4;
		margin-top: 10px;
	}
	.sample-next {
		position: relative;
		margin: -2px -12px 0;
		background: var(--court-chalk);
		padding: 16px;
		border: 1px solid var(--court-line);
		border-radius: 10px;
		color: var(--court-ink);
		box-shadow: 0 8px 24px rgb(12 36 31 / 12%);
	}
	.sample-next > strong {
		font-size: 11px;
	}
	.sample-next > div {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
	}
	.sample-next > div > span {
		display: flex;
		align-items: center;
		flex-direction: column;
		gap: 6px;
	}
	.sample-next small {
		font-size: 9px;
	}
	.caption {
		font-size: 9px;
		text-align: center;
		color: var(--court-chalk);
		margin-top: 10px;
		text-shadow: 0 1px 4px var(--court-ink);
	}
	.compact .sample-meta {
		margin: 16px 0;
	}
	.compact .sample-match {
		padding: 16px;
	}
	.compact .sample-scores span {
		font-size: 32px;
	}
</style>
