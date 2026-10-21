<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import LiveSessionPanel from '$lib/components/live/LiveSessionPanel.svelte';
	import BrandMark from '$lib/components/ui/BrandMark.svelte';
	import type { Participant } from '$lib/domain/types';
	import type { ActiveMatch } from '$lib/data/live';
	const players = ['Andi', 'Sari', 'Dika', 'Reno', 'Dara', 'Raka', 'Nina', 'Bima', 'Rafi', 'Adi'];
	const participants: Participant[] = players.map((name, i) => ({
		id: `demo-${i}`,
		name,
		membership: 'MEMBER',
		rating: 1200,
		uncertainty: 280,
		status: i < 4 ? 'PLAYING' : i < 8 ? 'READY' : 'RESTING',
		consecutiveMatches: 0,
		opportunities: 0,
		missedOpportunities: 0,
		currentOpportunityDebt: 0,
		rotationsPlayed: 1,
		setsPlayed: 2
	}));
	const lineup = players
		.slice(0, 4)
		.map((name, i) => ({ id: `demo-${i}`, name, team: i < 2 ? ('A' as const) : ('B' as const) }));
	const activeMatch: ActiveMatch = {
		id: 'demo-match',
		session_id: 'demo-session',
		sequence_number: 3,
		court_number: 1,
		sets: [
			{
				id: 'demo-set-1',
				setNumber: 1,
				status: 'COMPLETED',
				teamAScore: 21,
				teamBScore: 18,
				players: lineup
			},
			{
				id: 'demo-set-2',
				setNumber: 2,
				status: 'IN_PROGRESS',
				teamAScore: null,
				teamBScore: null,
				players: lineup
			}
		]
	};
</script>

<svelte:head
	><title>Demo Courtside | Lihat contoh sesi klub</title><meta
		name="robots"
		content="noindex"
	/></svelte:head
>
<div class="demo-page">
	<header>
		<a href={resolve('/')}><BrandMark />Courtside</a><a
			href={resolve('/signup')}
			class="court-button court-button--primary">Buat klub</a
		>
	</header>
	<div class="demo-intro">
		<h1>Coba Courtside</h1>
		<p>
			Ini contoh tampilan sesi untuk anggota klub. Data fiktif, tidak terhubung ke klub mana pun.
		</p>
	</div>
	<main>
		<LiveSessionPanel
			headingLevel={2}
			session={{
				id: 'demo-session',
				club_id: 'demo-club',
				started_at: '2026-10-17T11:00:00+08:00',
				court_count: 1
			}}
			{participants}
			activeMatches={[activeMatch]}
			onadminlogin={() => void goto(resolve('/signup'))}
			onstartsession={() => {}}
			oncheckin={() => {}}
			onendsession={() => {}}
			onselect={() => {}}
			onstartmatch={async () => false}
			onpreparenext={async () => null}
			oncompleteset={async () => false}
			oncorrectset={async () => false}
			onabandonmatch={() => {}}
			onsubstitute={async () => false}
			onstartdecider={async () => false}
			onskiptiedmatch={async () => false}
		/>
	</main>
</div>

<style>
	.demo-page {
		max-width: 600px;
		margin: auto;
		padding: 20px 20px 48px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	header > a:first-child {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 800;
		font-size: 22px;
		letter-spacing: -0.04em;
	}
	.demo-intro {
		padding: 32px 0 24px;
	}
	.demo-intro h1 {
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.035em;
	}
	.demo-intro p {
		font-size: 13px;
		line-height: 1.8;
		margin-top: 12px;
		color: var(--court-muted);
	}
</style>
