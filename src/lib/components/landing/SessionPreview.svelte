<script lang="ts">
	import MatchCourt from '$lib/components/live/MatchCourt.svelte';
	import ParticipantGroup from '$lib/components/live/ParticipantGroup.svelte';
	import type { Participant } from '$lib/domain/types';
	import type { ActiveMatch } from '$lib/data/live';
	const participants: Participant[] = ['Dara', 'Raka', 'Nina', 'Bima'].map((name, i) => ({
		id: `demo-${i}`,
		name,
		membership: 'MEMBER',
		rating: 1200,
		uncertainty: 280,
		status: 'READY',
		consecutiveMatches: 0,
		opportunities: 0,
		missedOpportunities: 0,
		currentOpportunityDebt: 0,
		rotationsPlayed: 1,
		setsPlayed: 2
	}));
	const activeMatch: ActiveMatch = {
		id: 'demo-match',
		session_id: 'demo-session',
		sequence_number: 3,
		sets: [
			{
				id: 'demo-set',
				setNumber: 1,
				status: 'IN_PROGRESS',
				teamAScore: null,
				teamBScore: null,
				players: ['Andi', 'Sari', 'Dika', 'Reno'].map((name, i) => ({
					id: `playing-${i}`,
					name,
					team: i < 2 ? 'A' : 'B'
				}))
			}
		]
	};
</script>

<div class="preview" aria-label="Contoh tampilan aplikasi dengan data fiktif">
	<div class="heading"><strong>Klub Sabtu</strong><span>Contoh sesi</span></div>
	<div class="tabs">
		<strong>Live</strong><span>Pemain</span><span>Riwayat</span><span>Kas</span>
	</div>
	<MatchCourt
		{participants}
		{activeMatch}
		onpreparenext={async () => null}
		onstart={async () => false}
		oncomplete={async () => false}
		oncorrect={async () => false}
		onabandon={() => {}}
		onsubstitute={async () => false}
	/>
	<div class="waiting"><ParticipantGroup title="SIAP MAIN" status="READY" {participants} /></div>
	<p class="caption">
		Data contoh. Tampilan pertandingan dan daftar pemain dari aplikasi Courtside.
	</p>
</div>

<style>
	.preview {
		background: #f4f1e8;
		color: #163630;
		padding: 20px;
		box-shadow: 0 20px 50px rgb(0 0 0 / 20%);
	}
	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.heading strong {
		font-size: 22px;
		font-weight: 900;
		letter-spacing: -0.03em;
	}
	.heading span {
		font-size: 11px;
		color: #38675b;
	}
	.tabs {
		display: flex;
		justify-content: space-between;
		border-bottom: 1px solid #b9c5bb;
		margin: 12px 0 16px;
		font-size: 12px;
	}
	.tabs > * {
		padding: 10px 4px;
	}
	.tabs strong {
		border-bottom: 3px solid #e2653e;
	}
	.waiting {
		margin-top: 12px;
	}
	.caption {
		font-size: 10px;
		line-height: 1.5;
		color: #38675b;
		margin: 12px 0 0;
	}
	@media (max-width: 400px) {
		.preview {
			padding: 12px;
		}
	}
</style>
