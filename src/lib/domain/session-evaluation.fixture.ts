import type { SessionEvaluationInput } from './session-evaluation';

const ids = Array.from({ length: 12 }, (_, index) => `pb-${String(index + 1).padStart(2, '0')}`);
const lineups = [ids.slice(0, 4), ids.slice(4, 8), ids.slice(8, 12)];
const start = Date.parse('2026-09-12T09:00:00Z');
const at = (minutes: number) => new Date(start + minutes * 60000).toISOString();
const set = (id: string, number: number, scoreA: number, scoreB: number, players: string[]) => ({
	id,
	number,
	status: 'COMPLETED',
	scoreA,
	scoreB,
	players: players.map((playerId, index) => ({
		playerId,
		team: (index < 2 ? 'A' : 'B') as 'A' | 'B'
	}))
});

/** Stable 12-player PB NEWBIE post-session audit fixture; score values represent the corrected persisted result. */
export const pbNewbieSessionFixture: SessionEvaluationInput = {
	sessionId: 'pb-newbie-validation-12',
	startedAt: at(0),
	closedAt: at(180),
	players: ids.map((id, index) => ({ id, name: `Pemain ${index + 1}` })),
	periods: ids.flatMap((playerId, index) => {
		const arrival = index < 4 ? 0 : index < 8 ? 20 : 45;
		if (index === 8)
			return [
				{ playerId, status: 'READY', startedAt: at(arrival), endedAt: at(60) },
				{ playerId, status: 'RESTING', startedAt: at(60), endedAt: at(85) },
				{ playerId, status: 'READY', startedAt: at(85), endedAt: at(180) }
			];
		if (index === 9)
			return [
				{ playerId, status: 'READY', startedAt: at(arrival), endedAt: at(75) },
				{ playerId, status: 'AWAY', startedAt: at(75), endedAt: at(105) },
				{ playerId, status: 'READY', startedAt: at(105), endedAt: at(180) }
			];
		if (index === 11)
			return [
				{ playerId, status: 'READY', startedAt: at(arrival), endedAt: at(100) },
				{ playerId, status: 'LEFT', startedAt: at(100), endedAt: at(180) }
			];
		return [{ playerId, status: 'READY', startedAt: at(arrival), endedAt: at(180) }];
	}),
	readyWaitComplete: true,
	rotations: lineups.map((selected, index) => {
		const minute = 60 + index * 35;
		return {
			id: `match-${index + 1}`,
			at: at(minute),
			readyPlayerIds: ids.filter((_, playerIndex) => {
				const arrival = playerIndex < 4 ? 0 : playerIndex < 8 ? 20 : 45;
				return (
					arrival <= minute &&
					!(playerIndex === 8 && minute >= 60 && minute < 85) &&
					!(playerIndex === 9 && minute >= 75 && minute < 105) &&
					!(playerIndex === 11 && minute >= 100)
				);
			}),
			recommendedPlayerIds: index === 1 ? ids.slice(0, 4) : selected,
			actualPlayerIds: selected
		};
	}),
	matches: [
		{
			id: 'match-1',
			pairing: {
				recommendedGap: 18,
				actualGap: 18,
				recommendedPlayerTeams: ids
					.slice(0, 4)
					.map((playerId, index) => ({ playerId, team: (index < 2 ? 'A' : 'B') as 'A' | 'B' }))
			},
			sets: [
				set('set-1-1', 1, 21, 18, ids.slice(0, 4)),
				set('set-1-2', 2, 21, 19, [ids[0], ids[4], ids[2], ids[3]])
			]
		},
		{
			id: 'match-2',
			pairing: {
				recommendedGap: 12,
				actualGap: 31,
				recommendedPlayerTeams: ids
					.slice(4, 8)
					.map((playerId, index) => ({ playerId, team: (index < 2 ? 'A' : 'B') as 'A' | 'B' }))
			},
			sets: [
				set('set-2-1', 1, 21, 8, [ids[4], ids[6], ids[5], ids[7]]),
				set('set-2-2', 2, 17, 21, ids.slice(4, 8))
			]
		}
	],
	recommendationCount: 3,
	ratingObservations: [
		{
			playerId: ids[0],
			source: 'SET_RESULT',
			ratingBefore: 1200,
			ratingAfter: 1208,
			setId: 'set-1-1'
		}
	]
};
