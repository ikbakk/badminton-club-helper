<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import BrandMark from './BrandMark.svelte';
	let { children }: { children: Snippet } = $props();
</script>

<main class="auth-frame">
	<div class="auth-story">
		<img src="/images/club-night.webp" alt="Pemain badminton berpasangan di lapangan indoor" /><a
			href={resolve('/')}
			class="story-brand"><BrandMark />Courtside</a
		>
		<div>
			<h2>Main bareng.<br />Ketemu lagi minggu depan.</h2>
			<p>Giliran pemain, hasil pertandingan, dan iuran klub.</p>
		</div>
	</div>
	<div class="auth-content">
		<a href={resolve('/')} class="auth-brand"><BrandMark />Courtside</a>
		<section class="auth-card">{@render children()}</section>
		<p class="auth-foot">Satu klub. Satu lapangan. Main bareng.</p>
	</div>
</main>

<style>
	.auth-frame {
		min-height: 100dvh;
		background: var(--court-ground);
		color: var(--court-ink);
	}
	.auth-story {
		display: none;
	}
	.auth-content {
		max-width: 520px;
		margin: auto;
		padding: 24px 20px 40px;
	}
	.auth-brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.04em;
		min-height: 44px;
	}
	.auth-card {
		margin-top: 32px;
		padding: 28px 24px;
		border: 1px solid var(--court-line);
		border-radius: 10px;
		background: var(--court-chalk);
		box-shadow: var(--court-shadow);
	}
	.auth-card :global(h1) {
		font-size: 30px;
		line-height: 1.2;
		letter-spacing: -0.035em;
	}
	.auth-card :global(label) {
		font-size: 13px;
	}
	.auth-card :global(input) {
		font-size: 16px;
	}
	.auth-foot {
		font-size: 11px;
		color: var(--court-muted);
		text-align: center;
		margin-top: 24px;
	}
	@media (min-width: 1024px) {
		.auth-frame {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
		.auth-story {
			display: block;
			position: relative;
			min-height: 100dvh;
			background: var(--court-ink);
			color: var(--court-chalk);
			overflow: hidden;
		}
		.auth-story img {
			width: 100%;
			height: 100%;
			position: absolute;
			object-fit: cover;
			object-position: 65% center;
			opacity: 0.5;
		}
		.story-brand {
			position: relative;
			display: flex;
			align-items: center;
			gap: 10px;
			margin: 40px;
			font-size: 26px;
			font-weight: 800;
		}
		.auth-story > div {
			position: absolute;
			bottom: 60px;
			left: 40px;
			right: 40px;
		}
		.auth-story h2 {
			font-size: 42px;
			font-weight: 800;
			letter-spacing: -0.04em;
			line-height: 1.15;
		}
		.auth-story p {
			font-size: 14px;
			line-height: 1.7;
			color: #d6e0d7;
			margin-top: 20px;
		}
		.auth-content {
			width: 100%;
			align-self: center;
			padding: 40px;
			max-width: 560px;
		}
		.auth-brand {
			display: none;
		}
		.auth-card {
			margin-top: 0;
		}
	}
	@media (max-width: 380px) {
		.auth-card {
			padding: 24px 18px;
		}
		.auth-card :global(h1) {
			font-size: 27px;
		}
	}
</style>
