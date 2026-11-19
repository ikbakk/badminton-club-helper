<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, UsersRound, Scale, Wallet, Check } from '@lucide/svelte';
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import SessionPreview from '$lib/components/landing/SessionPreview.svelte';
	const features = [
		{ icon: UsersRound, title: 'Giliran pemain', text: 'Bantu memilih empat pemain berikutnya.' },
		{ icon: Scale, title: 'Pasangan seimbang', text: 'Saran pasangan, admin tetap memilih.' },
		{ icon: Wallet, title: 'Catatan iuran', text: 'Kehadiran dan pembayaran tercatat.' }
	];
</script>

<svelte:head
	><title>Courtside | Main bareng, giliran lebih teratur</title><meta
		name="description"
		content="Bantu admin memilih pemain berikutnya, mencatat skor, dan mengurus iuran klub badminton. Buat klubmu dan bagikan tautannya ke anggota."
	/><meta name="theme-color" content="#163630" /><link
		rel="preload"
		href="/fonts/barlow-condensed-800.ttf"
		as="font"
		type="font/ttf"
		crossorigin="anonymous"
	/></svelte:head
>
<div class="landing">
	<a href="#main" class="skip">Lewati ke konten</a>
	<header class="landing-header">
		<a class="brand" href={resolve('/')} aria-label="Courtside beranda"><BrandMark />Courtside</a>
		<nav aria-label="Navigasi utama">
			<a href="#fitur" class="anchor-link">Fitur</a><a href="#cara-kerja" class="anchor-link"
				>Cara kerja</a
			><a class="login" href={resolve('/start')}>Masuk <ArrowRight size={16} /></a>
		</nav>
	</header>
	<main id="main">
		<section class="hero" aria-labelledby="hero-title">
			<div class="hero-photo">
				<img
					src="/images/club-night.webp"
					alt="Empat pemain sedang bermain ganda di lapangan badminton indoor"
					fetchpriority="high"
					width="1600"
					height="1067"
				/>
			</div>
			<div class="hero-copy">
				<h1 id="hero-title">Main bareng.<br />Giliran lebih<br />teratur.</h1>
				<p>Bantu admin memilih pemain berikutnya, mencatat skor, dan mengurus iuran klub.</p>
				<div class="hero-actions">
					<a href={resolve('/signup')} class="primary">Buat klub <ArrowRight size={18} /></a><a
						href={resolve('/demo')}
						class="secondary">Coba demo</a
					>
				</div>
				<p class="hero-note">Anggota cukup buka tautan klub. Tidak perlu akun.</p>
			</div>
			<div class="hero-preview"><SessionPreview /></div>
		</section>
		<section class="features" id="fitur" aria-label="Fitur Courtside">
			{#each features as feature (feature.title)}{@const Icon = feature.icon}
				<article>
					<Icon size={30} strokeWidth={1.7} />
					<div>
						<h2>{feature.title}</h2>
						<p>{feature.text}</p>
					</div>
				</article>{/each}
		</section>
		<section class="workflow" id="cara-kerja">
			<div class="workflow-intro">
				<h2>Dari datang<br />sampai <span>pulang.</span></h2>
				<p>Lebih banyak main, dengan catatan yang bisa dibuka lagi minggu depan.</p>
				<a href={resolve('/signup')} class="text-link">Siapkan klubmu <ArrowRight size={17} /></a>
			</div>
			<ol>
				<li>
					<span>1</span>
					<div>
						<h3>Buat klub dan daftar pemain</h3>
						<p>Beri nama klubmu, tambahkan anggota, lalu bagikan tautan klub ke grup.</p>
					</div>
				</li>
				<li>
					<span>2</span>
					<div>
						<h3>Catat yang hadir, mulai main</h3>
						<p>
							Check in pemain saat datang. Periksa saran giliran dan pasangan, lalu simpan skor tiap
							set.
						</p>
					</div>
				</li>
				<li>
					<span>3</span>
					<div>
						<h3>Tutup sesi dan catat iuran</h3>
						<p>
							Tentukan iuran per orang dan tandai pembayaran yang sudah diterima. Hasil pertandingan
							tersimpan di riwayat.
						</p>
					</div>
				</li>
			</ol>
		</section>
		<section class="closing">
			<div>
				<Check size={24} />
				<h2>Main berikutnya, coba pakai Courtside.</h2>
			</div>
			<a href={resolve('/signup')} class="primary">Buat klub <ArrowRight size={18} /></a>
		</section>
	</main>
	<footer>
		<a href={resolve('/')} class="brand"><BrandMark size={20} />Courtside</a><span
			>Untuk klub badminton.</span
		><a href={resolve('/start')}>Sudah punya akun? Masuk</a>
	</footer>
</div>

<style>
	@font-face {
		font-family: 'Barlow Condensed';
		src: url('/fonts/barlow-condensed-800.ttf') format('truetype');
		font-weight: 800;
		font-display: swap;
	}
	:global(html) {
		scroll-behavior: smooth;
	}
	.landing {
		max-width: 1440px;
		padding: 0 28px;
		margin: auto;
		color: var(--court-ink);
	}
	.landing-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 24px 12px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.04em;
	}
	.landing-header nav {
		display: flex;
		align-items: center;
		gap: 30px;
		font-size: 13px;
	}
	.landing-header nav a {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.login {
		gap: 16px;
		padding: 0 20px;
		border: 1px solid var(--court-line);
		border-radius: 6px;
		font-weight: 700;
	}
	.login:hover {
		background: var(--court-soft);
	}
	.hero {
		position: relative;
		min-height: 650px;
		isolation: isolate;
		background: var(--court-chalk);
		border-radius: 12px 12px 0 0;
		overflow: hidden;
	}
	.hero-photo {
		position: absolute;
		inset: 0 0 0 auto;
		width: 78%;
		z-index: -1;
	}
	.hero-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 68% center;
	}
	.hero-photo:after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			#fffaf0 0%,
			rgb(255 250 240 / 94%) 7%,
			rgb(255 250 240 / 62%) 22%,
			transparent 47%
		);
	}
	.hero-copy {
		padding: 66px 0 64px 44px;
		max-width: 490px;
		position: relative;
		z-index: 1;
	}
	h1 {
		font-family: 'Barlow Condensed', sans-serif;
		font-size: clamp(66px, 7vw, 100px);
		font-weight: 800;
		line-height: 0.94;
		letter-spacing: -0.025em;
		margin: 0 0 26px;
	}
	.hero-copy > p {
		font-size: 16px;
		line-height: 1.7;
		max-width: 315px;
	}
	.hero-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 28px;
	}
	.primary,
	.secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 22px;
		min-height: 50px;
		padding: 12px 23px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 800;
	}
	.primary {
		background: var(--court-action);
		color: var(--court-deep);
		border: 1px solid rgb(12 36 31 / 10%);
	}
	.primary:hover {
		background: #ec8666;
	}
	.secondary {
		background: var(--court-chalk);
		border: 1px solid var(--court-ink);
	}
	.secondary:hover {
		background: var(--court-soft);
	}
	.hero-copy > .hero-note {
		font-size: 10px;
		line-height: 1.6;
		margin-top: 16px;
		max-width: 320px;
		color: var(--court-muted);
	}
	.hero-preview {
		position: absolute;
		right: 5%;
		bottom: 30px;
		width: 270px;
	}
	.features {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		background: var(--court-chalk);
		border-top: 1px solid var(--court-line);
		padding: 28px 28px;
		border-radius: 0 0 12px 12px;
		scroll-margin-top: 24px;
	}
	.features article {
		display: flex;
		gap: 18px;
		padding: 4px 22px;
		align-items: flex-start;
	}
	.features article + article {
		border-left: 1px solid var(--court-line);
	}
	.features :global(svg) {
		color: var(--court-action-deep);
		flex-shrink: 0;
	}
	.features h2 {
		font-size: 15px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
	}
	.features p {
		font-size: 12px;
		line-height: 1.7;
		max-width: 220px;
		color: var(--court-muted);
	}
	.workflow {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 80px;
		padding: 86px 48px 74px;
		scroll-margin-top: 24px;
	}
	.workflow h2 {
		font-family: 'Barlow Condensed', sans-serif;
		font-weight: 800;
		font-size: 72px;
		letter-spacing: -0.025em;
		line-height: 0.95;
	}
	.workflow h2 span {
		text-decoration: underline;
		text-decoration-color: var(--court-action);
		text-underline-offset: 6px;
		text-decoration-thickness: 4px;
	}
	.workflow-intro > p {
		font-size: 14px;
		line-height: 1.8;
		max-width: 320px;
		margin-top: 24px;
		color: var(--court-muted);
	}
	.text-link {
		display: inline-flex;
		align-items: center;
		gap: 18px;
		font-size: 13px;
		font-weight: 800;
		min-height: 44px;
		margin-top: 18px;
	}
	.workflow ol {
		padding: 0;
		list-style: none;
	}
	.workflow li {
		display: flex;
		gap: 18px;
		padding: 0 0 24px;
		margin-bottom: 24px;
		border-bottom: 1px solid var(--court-line);
	}
	.workflow li > span {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--court-soft);
		font-size: 12px;
		font-weight: 800;
		flex-shrink: 0;
	}
	.workflow h3 {
		font-size: 15px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 2px 0 10px;
	}
	.workflow li p {
		font-size: 13px;
		line-height: 1.8;
		color: var(--court-muted);
	}
	.closing {
		padding: 32px 40px;
		border-block: 1px solid var(--court-line);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 24px;
	}
	.closing > div {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.closing :global(svg) {
		flex-shrink: 0;
	}
	.closing h2 {
		font-size: 21px;
		font-weight: 800;
		letter-spacing: -0.03em;
	}
	footer {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 28px 12px;
		font-size: 11px;
		color: var(--court-muted);
	}
	footer .brand {
		font-size: 20px;
		color: var(--court-ink);
	}
	footer > a:last-child {
		margin-left: auto;
		min-height: 44px;
		display: flex;
		align-items: center;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.skip {
		position: absolute;
		left: 16px;
		top: -100px;
		padding: 12px;
		background: var(--court-chalk);
		z-index: 10;
	}
	.skip:focus {
		top: 8px;
	}
	a:focus-visible {
		outline: 3px solid var(--court-action);
		outline-offset: 4px;
	}
	@media (min-width: 1600px) {
		.hero {
			min-height: 700px;
		}
		.hero-copy {
			padding-top: 80px;
		}
	}
	@media (max-width: 1000px) {
		.landing {
			padding: 0 20px;
		}
		.hero-copy {
			padding-left: 30px;
			max-width: 420px;
		}
		h1 {
			font-size: 80px;
		}
		.hero-preview {
			right: 3%;
			width: 235px;
		}
		.features {
			padding: 24px 12px;
		}
		.features article {
			padding: 4px 15px;
			gap: 12px;
		}
		.workflow {
			padding: 64px 28px;
			gap: 40px;
		}
	}
	@media (max-width: 700px) {
		.landing {
			padding: 0 14px;
		}
		.landing-header {
			padding: 16px 4px;
		}
		.brand {
			font-size: 23px;
		}
		.anchor-link {
			display: none !important;
		}
		.landing-header nav {
			gap: 12px;
		}
		.hero {
			padding-bottom: 0;
			min-height: 0;
		}
		.hero-copy {
			padding: 34px 24px 36px;
			max-width: none;
		}
		.hero-copy > p {
			font-size: 15px;
			max-width: 290px;
		}
		h1 {
			font-size: clamp(62px, 15.8vw, 88px);
			margin-bottom: 22px;
		}
		.hero-photo {
			position: relative;
			width: 100%;
			height: 390px;
			z-index: 0;
		}
		.hero-photo img {
			object-position: 68% center;
		}
		.hero-photo:after {
			display: none;
		}
		.hero {
			display: flex;
			flex-direction: column;
		}
		.hero-copy {
			order: -1;
		}
		.hero-preview {
			width: 205px;
			right: 22px;
			bottom: 22px;
		}
		.hero-actions {
			gap: 10px;
			flex-wrap: wrap;
		}
		.primary,
		.secondary {
			padding: 12px 20px;
		}
		.features {
			grid-template-columns: 1fr;
			padding: 10px 22px;
		}
		.features article {
			padding: 22px 0;
		}
		.features article + article {
			border-left: 0;
			border-top: 1px solid var(--court-line);
		}
		.features p {
			max-width: none;
		}
		.workflow {
			grid-template-columns: 1fr;
			padding: 48px 10px 24px;
			gap: 32px;
		}
		.workflow h2 {
			font-size: 60px;
		}
		.workflow ol {
			margin-top: 4px;
		}
		.closing {
			padding: 26px 10px;
			flex-direction: column;
			align-items: stretch;
		}
		.closing h2 {
			font-size: 19px;
		}
		.closing > div {
			align-items: flex-start;
		}
		footer {
			flex-wrap: wrap;
			padding: 20px 4px;
			gap: 16px;
		}
		footer > a:last-child {
			margin-left: 0;
			width: 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(html) {
			scroll-behavior: auto;
		}
	}
</style>
