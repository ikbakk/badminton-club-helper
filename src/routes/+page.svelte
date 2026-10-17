<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		ChevronDown,
		CircleCheck,
		UsersRound,
		Wallet,
		ListOrdered
	} from '@lucide/svelte';
</script>

<svelte:head>
	<title>Courtside — Sesi badminton, lebih tertata.</title>
	<meta
		name="description"
		content="Kelola pemain, rotasi doubles, skor, dan kas klub badminton dalam satu tempat. Buat klubmu sendiri dan bagikan tautan Live kepada anggota."
	/>
	<meta name="theme-color" content="#163630" />
</svelte:head>

<div class="landing">
	<a class="skip" href="#main">Lewati ke konten</a>
	<header>
		<a class="brand" href={resolve('/')} aria-label="Courtside beranda"
			><span class="mark" aria-hidden="true">C/</span>Courtside</a
		>
		<a class="login" href={resolve('/start')}>Masuk <ArrowRight size={16} /></a>
	</header>
	<main id="main">
		<section class="hero">
			<div class="intro">
				<p class="eyebrow">UNTUK KLUB BADMINTON KAMU</p>
				<h1>Lebih banyak main.<br /><span>Lebih sedikit repot.</span></h1>
				<p class="lead">
					Pemain datang silih berganti. Sesi tetap tertata. Kelola giliran doubles, catat skor, dan
					bereskan kas klub dari tepi lapangan.
				</p>
				<a class="primary" href={resolve('/signup')}>Buat klubmu <ArrowRight size={20} /></a>
				<p class="note">Anggota cukup membuka tautan klub. Admin yang mengelola sesi.</p>
				<a class="tour" href="#contoh">Lihat cara kerjanya <ChevronDown size={16} /></a>
			</div>
			<div class="court" aria-label="Contoh tampilan pertandingan dengan pemain fiktif">
				<div class="court-top">
					<span>CONTOH · KLUB SABTU</span><span class="live-dot">LIVE</span>
				</div>
				<p class="set">MATCH 03 · SET 2</p>
				<div class="teams">
					<div><span>TIM A</span><strong>Dara<br />Raka</strong></div>
					<div class="versus">VS</div>
					<div><span>TIM B</span><strong>Nina<br />Bima</strong></div>
				</div>
				<div class="scores"><strong>21</strong><span>SKOR SET 1</span><strong>18</strong></div>
				<div class="sideline">
					<CircleCheck size={18} /><span>6 pemain siap · 2 istirahat</span>
				</div>
				<p class="example">Ilustrasi, bukan sesi klub sungguhan.</p>
			</div>
		</section>
		<section id="contoh" class="workflow">
			<p class="eyebrow">DARI CHECK IN SAMPAI SELESAI</p>
			<h2>Satu tempat untuk satu malam main.</h2>
			<div class="steps">
				<article>
					<UsersRound size={24} /><span class="number">01</span>
					<h3>Siapkan pemain</h3>
					<p>
						Tambahkan anggota klub. Check in saat datang, atur istirahat, dan tangani pemain yang
						pulang duluan.
					</p>
				</article>
				<article>
					<ListOrdered size={24} /><span class="number">02</span>
					<h3>Jalankan lapangan</h3>
					<p>
						Rekomendasi membantu memilih empat pemain dan pasangan. Admin tetap memutuskan, lalu
						mencatat hasil setiap set.
					</p>
				</article>
				<article>
					<Wallet size={24} /><span class="number">03</span>
					<h3>Bereskan sesi</h3>
					<p>
						Simpan riwayat pertandingan, tentukan iuran sesi, dan catat pembayaran serta pengeluaran
						klub.
					</p>
				</article>
			</div>
		</section>
		<section class="closing">
			<div>
				<p class="eyebrow">KLUBMU, RUANGMU SENDIRI</p>
				<h2>Mulai dari nama klub.</h2>
				<p>Akun admin, daftar pemain, dan tautan Live untuk klub kamu.</p>
			</div>
			<a class="primary" href={resolve('/signup')}>Buat klubmu <ArrowRight size={20} /></a>
		</section>
	</main>
	<footer>
		<span>Courtside · Untuk klub yang suka main.</span><a href={resolve('/start')}
			>Sudah punya akun? Masuk</a
		>
	</footer>
</div>

<style>
	.landing {
		max-width: 1200px;
		margin: auto;
		padding: 0 24px;
	}
	header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 24px 0;
		border-bottom: 1px solid #b9c5bb;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 22px;
		font-weight: 900;
		letter-spacing: -0.04em;
	}
	.mark {
		background: #163630;
		color: #f5bb61;
		padding: 10px;
		font-size: 20px;
	}
	.login,
	.tour {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font-weight: 700;
	}
	.hero {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 64px;
		align-items: center;
		padding: 80px 0;
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.14em;
		color: #38675b;
	}
	h1 {
		font-size: clamp(40px, 5.2vw, 68px);
		line-height: 1.04;
		letter-spacing: -0.055em;
		font-weight: 900;
		margin: 20px 0;
	}
	h1 span {
		color: #38675b;
	}
	.lead {
		font-size: 18px;
		line-height: 1.65;
		max-width: 500px;
		margin: 24px 0;
	}
	.primary {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 24px;
		min-height: 52px;
		background: #e2653e;
		color: #163630;
		font-weight: 900;
		padding: 14px 22px;
	}
	.primary:hover {
		background: #f5bb61;
	}
	.note {
		font-size: 13px;
		line-height: 1.6;
		color: #527169;
		margin: 14px 0;
		max-width: 360px;
	}
	.tour {
		margin-top: 8px;
		font-size: 13px;
	}
	.court {
		position: relative;
		background: #163630;
		color: #fffaf0;
		padding: 28px;
		box-shadow: 12px 12px 0 #e5ece5;
		isolation: isolate;
	}
	.court:before {
		content: '';
		position: absolute;
		inset: 16px;
		border: 1px solid #b9c5bb55;
		z-index: -1;
	}
	.court:after {
		content: '';
		position: absolute;
		inset: 50% 16px auto;
		border-top: 1px solid #b9c5bb55;
		z-index: -1;
	}
	.court-top {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
	}
	.live-dot {
		color: #f5bb61;
	}
	.set {
		margin: 44px 0 20px;
		color: #b9c5bb;
		font-size: 12px;
		font-weight: 900;
	}
	.teams {
		display: grid;
		grid-template-columns: 1fr 32px 1fr;
		gap: 12px;
	}
	.teams > div:last-child {
		text-align: right;
	}
	.teams span {
		font-size: 10px;
		color: #b9c5bb;
		font-weight: 900;
	}
	.teams strong {
		display: block;
		font-size: 28px;
		line-height: 1.25;
		margin-top: 12px;
	}
	.versus {
		align-self: center;
		color: #b9c5bb;
		font-size: 11px;
	}
	.scores {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-block: 1px solid #b9c5bb66;
		margin: 30px 0 20px;
		padding: 12px 0;
	}
	.scores strong {
		font-size: 46px;
		font-weight: 900;
	}
	.scores span {
		font-size: 10px;
		color: #b9c5bb;
	}
	.sideline {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}
	.example {
		font-size: 10px;
		color: #b9c5bb;
		margin-top: 20px;
	}
	.workflow {
		border-top: 1px solid #b9c5bb;
		padding: 48px 0;
		scroll-margin-top: 20px;
	}
	h2 {
		font-size: clamp(28px, 3vw, 38px);
		font-weight: 900;
		line-height: 1.15;
		letter-spacing: -0.04em;
		margin: 12px 0 28px;
	}
	.steps {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-block: 1px solid #b9c5bb;
	}
	.steps article {
		position: relative;
		padding: 28px 24px 28px 0;
	}
	.steps article + article {
		border-left: 1px solid #b9c5bb;
		padding-left: 24px;
	}
	.number {
		position: absolute;
		top: 28px;
		right: 24px;
		color: #527169;
		font-size: 12px;
		font-weight: 900;
	}
	h3 {
		font-size: 20px;
		font-weight: 900;
		margin: 20px 0 10px;
	}
	article p,
	.closing p {
		font-size: 15px;
		line-height: 1.7;
		color: #527169;
	}
	.closing {
		display: flex;
		justify-content: space-between;
		gap: 32px;
		align-items: center;
		padding: 32px 0 56px;
	}
	.closing h2 {
		margin-bottom: 12px;
	}
	footer {
		border-top: 1px solid #b9c5bb;
		border-bottom: 0;
		font-size: 12px;
		color: #527169;
	}
	footer a {
		text-decoration: underline;
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.skip {
		position: absolute;
		left: 16px;
		top: -100px;
		background: #fffaf0;
		padding: 12px;
		z-index: 5;
	}
	.skip:focus {
		top: 8px;
	}
	a:focus-visible {
		outline: 3px solid #e2653e;
		outline-offset: 5px;
	}
	@media (max-width: 700px) {
		.landing {
			padding: 0 20px;
		}
		header {
			padding: 16px 0;
		}
		.hero {
			grid-template-columns: 1fr;
			gap: 36px;
			padding: 42px 0 48px;
		}
		.lead {
			font-size: 16px;
		}
		.court {
			padding: 28px;
		}
		.steps {
			grid-template-columns: 1fr;
		}
		.steps article + article {
			border-left: 0;
			border-top: 1px solid #b9c5bb;
			padding-left: 0;
		}
		.closing {
			align-items: stretch;
			flex-direction: column;
			gap: 20px;
		}
		footer {
			align-items: flex-start;
			flex-direction: column;
			gap: 4px;
		}
		.primary {
			width: 100%;
		}
	}
</style>
