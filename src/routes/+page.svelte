<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, ArrowDown, UsersRound, Shuffle, Wallet } from '@lucide/svelte';
	import SessionPreview from '$lib/components/landing/SessionPreview.svelte';
	const features = [
		{
			icon: UsersRound,
			title: 'Siapa yang belum main?',
			text: 'Lihat pemain yang siap dan berapa set mereka sudah bermain. Rekomendasi giliran membantu admin memilih empat pemain berikutnya.'
		},
		{
			icon: Shuffle,
			title: 'Pasangannya siapa?',
			text: 'Dapatkan saran pasangan dari rating keempat pemain. Mau ganti susunan? Admin tetap bisa memilih sendiri.'
		},
		{
			icon: Wallet,
			title: 'Iurannya sudah beres?',
			text: 'Tentukan iuran setelah sesi selesai. Catat siapa yang sudah bayar, biaya lapangan, dan pemakaian kok.'
		}
	];
</script>

<svelte:head>
	<title>Courtside | Atur giliran main badminton klubmu</title>
	<meta
		name="description"
		content="Bantu admin klub badminton memilih giliran pemain, menyusun pasangan, mencatat skor dan iuran. Anggota bisa melihat sesi lewat tautan klub."
	/>
	<meta name="theme-color" content="#163630" />
	<link
		rel="preload"
		href="/fonts/barlow-condensed-800.ttf"
		as="font"
		type="font/ttf"
		crossorigin="anonymous"
	/>
</svelte:head>
<div class="landing">
	<a class="skip" href="#main">Lewati ke konten</a>
	<header>
		<a class="brand" href={resolve('/')} aria-label="Courtside beranda"
			><span class="mark" aria-hidden="true">C/</span>Courtside</a
		>
		<nav aria-label="Navigasi utama">
			<a class="section-link" href="#fitur">Fitur</a><a class="section-link" href="#cara-kerja"
				>Cara kerja</a
			><a class="login" href={resolve('/start')}>Masuk <ArrowRight size={16} /></a>
		</nav>
	</header>
	<main id="main">
		<section class="hero" aria-labelledby="hero-title">
			<div class="intro">
				<h1 id="hero-title">
					Lebih banyak main.<br /><span>Giliran biar<br />Courtside bantu.</span>
				</h1>
				<p class="lead">
					Yang datang belakangan jangan sampai lupa diajak main. Courtside bantu admin mengatur
					giliran, menyusun pasangan, dan mencatat hasil pertandingan klub.
				</p>
				<div class="actions">
					<a class="primary" href={resolve('/signup')}>Buat klubmu <ArrowRight size={19} /></a><a
						class="secondary"
						href="#contoh">Lihat tampilan <ArrowDown size={17} /></a
					>
				</div>
				<p class="note">Anggota cukup buka tautan klub. Tidak perlu akun.</p>
				<div class="hero-foot">
					<span>Untuk main bareng.<br />Satu klub, satu lapangan.</span><span
						class="rule"
						aria-hidden="true"
					></span>
				</div>
			</div>
			<div id="contoh" class="visual">
				<img
					class="court-photo"
					src="/images/landing-court.webp"
					alt="Kok di atas lapangan badminton hijau"
					fetchpriority="high"
				/>
				<div class="app"><SessionPreview /></div>
			</div>
		</section>
		<section id="fitur" class="features" aria-label="Bantuan untuk admin klub">
			{#each features as feature (feature.title)}{@const Icon = feature.icon}
				<article>
					<Icon size={25} strokeWidth={1.8} />
					<h2>{feature.title}</h2>
					<p>{feature.text}</p>
				</article>{/each}
		</section>
		<section id="cara-kerja" class="workflow">
			<div class="workflow-visual">
				<img
					src="/images/landing-court.webp"
					alt="Garis lapangan dan kok badminton"
					loading="lazy"
				/>
				<p>Jadwal mainnya rutin.<br />Catatannya ikut rapi.</p>
			</div>
			<div class="workflow-copy">
				<h2>Dari pemain datang<br />sampai <span>pulang.</span></h2>
				<ol>
					<li>
						<h3>Buat klub dan daftar pemain</h3>
						<p>Daftar sebagai admin, beri nama klubmu, lalu tambahkan anggota.</p>
					</li>
					<li>
						<h3>Catat yang hadir, mulai main</h3>
						<p>
							Check in pemain saat datang. Pilih empat pemain dan pasangan, lalu simpan skor tiap
							set. Pemain bisa istirahat atau pulang lebih dulu.
						</p>
					</li>
					<li>
						<h3>Tutup sesi dan catat iuran</h3>
						<p>
							Riwayat pertandingan tersimpan. Tentukan iuran per orang dan tandai pembayaran yang
							sudah diterima.
						</p>
					</li>
				</ol>
			</div>
		</section>
		<section class="closing">
			<div>
				<h2>Main berikutnya, coba pakai Courtside.</h2>
				<p>Buat klubmu, lalu bagikan tautannya ke grup.</p>
			</div>
			<a class="primary" href={resolve('/signup')}>Buat klubmu <ArrowRight size={20} /></a>
		</section>
	</main>
	<footer>
		<a class="brand" href={resolve('/')}>Courtside</a><span>Untuk klub badminton.</span><a
			href={resolve('/start')}>Sudah punya akun? Masuk</a
		>
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
		--ink: #163630;
		--ground: #f4f1e8;
		--chalk: #fffaf0;
		--clay: #e2653e;
		--line: #b9c5bb;
		max-width: 1440px;
		margin: auto;
		color: var(--ink);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 24px 48px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 28px;
		font-weight: 900;
		letter-spacing: -0.04em;
	}
	.mark {
		color: var(--clay);
		font-style: italic;
		font-weight: 900;
	}
	nav {
		display: flex;
		gap: 30px;
		align-items: center;
		font-size: 14px;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	.login {
		gap: 16px;
		background: var(--ink);
		color: var(--chalk);
		padding: 0 20px;
		border-radius: 3px;
		font-weight: 700;
	}
	.hero {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: stretch;
	}
	.intro {
		padding: 54px 42px 54px 48px;
	}
	h1,
	.workflow h2 {
		font-family: 'Barlow Condensed', sans-serif;
		font-weight: 800;
		letter-spacing: -0.025em;
		line-height: 0.96;
	}
	h1 {
		font-size: clamp(64px, 7.2vw, 104px);
		margin: 0 0 30px;
	}
	h1 span {
		color: #38675b;
	}
	.lead {
		max-width: 440px;
		font-size: 17px;
		line-height: 1.7;
		margin: 0 0 28px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.primary,
	.secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 22px;
		min-height: 52px;
		padding: 14px 22px;
		border-radius: 3px;
		font-size: 15px;
		font-weight: 800;
	}
	.primary {
		background: var(--clay);
		color: #0c241f;
	}
	.primary:hover {
		background: #ee8765;
	}
	.secondary {
		border: 1px solid var(--ink);
	}
	.secondary:hover {
		background: #e5ece5;
	}
	.note {
		color: #38675b;
		font-size: 12px;
		line-height: 1.6;
		margin-top: 15px;
	}
	.hero-foot {
		display: flex;
		align-items: center;
		gap: 25px;
		margin-top: 48px;
		font-size: 11px;
		line-height: 1.7;
	}
	.rule {
		display: block;
		height: 1px;
		width: 120px;
		background: var(--line);
	}
	.visual {
		position: relative;
		background: var(--ink);
		padding: 52px 34px 74px;
		min-width: 0;
		scroll-margin-top: 24px;
	}
	.court-photo {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.app {
		position: relative;
		max-width: 425px;
		margin: auto;
		transform: translateX(-18px);
	}
	.features {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		padding: 36px 48px 40px;
		border-block: 1px solid var(--line);
		scroll-margin-top: 24px;
	}
	.features article {
		padding: 0 28px;
	}
	.features article:first-child {
		padding-left: 0;
	}
	.features article:last-child {
		padding-right: 0;
	}
	.features article + article {
		border-left: 1px solid var(--line);
	}
	.features :global(svg) {
		color: #b44c30;
		margin-bottom: 16px;
	}
	.features h2 {
		font-size: 21px;
		font-weight: 800;
		letter-spacing: -0.025em;
		margin: 0 0 12px;
	}
	.features p,
	.workflow p {
		font-size: 14px;
		line-height: 1.7;
		color: #38675b;
	}
	.workflow {
		display: grid;
		grid-template-columns: 1fr 1fr;
		scroll-margin-top: 24px;
	}
	.workflow-visual {
		position: relative;
		min-height: 540px;
		overflow: hidden;
		background: var(--ink);
	}
	.workflow-visual img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		position: absolute;
	}
	.workflow-visual p {
		position: relative;
		color: var(--chalk);
		font-size: 20px;
		font-weight: 700;
		padding: 36px 48px;
		text-shadow: 0 2px 8px #163630;
	}
	.workflow-copy {
		padding: 46px 48px;
	}
	.workflow h2 {
		font-size: clamp(46px, 5.2vw, 70px);
		margin-bottom: 32px;
	}
	.workflow h2 span {
		text-decoration: underline;
		text-decoration-color: var(--clay);
		text-underline-offset: 6px;
		text-decoration-thickness: 4px;
	}
	ol {
		list-style: decimal;
		padding-left: 25px;
	}
	li {
		padding-left: 10px;
		margin-bottom: 22px;
	}
	li::marker {
		color: #b44c30;
		font-weight: 800;
	}
	h3 {
		font-size: 16px;
		font-weight: 800;
		margin-bottom: 7px;
	}
	.closing {
		padding: 50px 48px;
		border-top: 1px solid var(--line);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 28px;
	}
	.closing h2 {
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.03em;
	}
	.closing p {
		color: #38675b;
		font-size: 14px;
		margin-top: 10px;
	}
	footer {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 24px 48px;
		border-top: 1px solid var(--line);
		font-size: 12px;
		color: #38675b;
	}
	footer .brand {
		font-size: 20px;
		color: var(--ink);
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
		top: -100px;
		left: 16px;
		padding: 12px;
		background: var(--chalk);
		z-index: 10;
	}
	.skip:focus {
		top: 8px;
	}
	a:focus-visible {
		outline: 3px solid var(--clay);
		outline-offset: 5px;
	}
	@media (max-width: 1000px) {
		header {
			padding: 20px 28px;
		}
		.intro {
			padding: 36px 28px;
		}
		h1 {
			font-size: 76px;
		}
		.visual {
			padding: 40px 20px;
		}
		.app {
			transform: none;
		}
		.features {
			padding: 32px 28px;
		}
		.workflow-copy {
			padding: 36px 28px;
		}
		.workflow-visual p {
			padding: 32px 28px;
		}
	}
	@media (max-width: 700px) {
		header {
			padding: 16px 20px;
		}
		.brand {
			font-size: 24px;
		}
		nav {
			gap: 12px;
		}
		.section-link {
			display: none;
		}
		.hero,
		.workflow {
			grid-template-columns: 1fr;
		}
		.intro {
			padding: 32px 20px 36px;
		}
		h1 {
			font-size: clamp(66px, 16vw, 96px);
		}
		.lead {
			font-size: 16px;
		}
		.hero-foot {
			margin-top: 28px;
		}
		.visual {
			padding: 30px 20px 54px;
		}
		.features {
			padding: 12px 20px;
			grid-template-columns: 1fr;
		}
		.features article,
		.features article:first-child,
		.features article:last-child {
			padding: 25px 0;
		}
		.features article + article {
			border-left: 0;
			border-top: 1px solid var(--line);
		}
		.features :global(svg) {
			float: left;
			margin: 0 16px 12px 0;
		}
		.features p {
			clear: both;
		}
		.workflow-visual {
			min-height: 260px;
		}
		.workflow-copy {
			padding: 34px 20px 16px;
		}
		.workflow h2 {
			font-size: 56px;
		}
		.closing {
			flex-direction: column;
			align-items: stretch;
			padding: 32px 20px;
		}
		.closing h2 {
			font-size: 26px;
		}
		footer {
			flex-wrap: wrap;
			gap: 12px 20px;
			padding: 20px;
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
