import type { Player, Team } from '../types';
export const PAIRING_VERSION = 'balance-v0';
export type PairingResult = { teams: [Team, Team]; balanceGap: number; algorithmVersion: string };
export function recommendPairing(players: Player[]): PairingResult {
	if (players.length !== 4) throw new Error('Pairing requires exactly four selected players.');
	const ids = players.map((p) => p.id);
	const rating = (id: string) => players.find((p) => p.id === id)!.rating;
	const choices: [Team, Team][] = [
		[
			[ids[0], ids[1]],
			[ids[2], ids[3]]
		],
		[
			[ids[0], ids[2]],
			[ids[1], ids[3]]
		],
		[
			[ids[0], ids[3]],
			[ids[1], ids[2]]
		]
	];
	const chosen = choices
		.map((teams) => ({
			teams,
			gap: Math.abs(
				rating(teams[0][0]) + rating(teams[0][1]) - rating(teams[1][0]) - rating(teams[1][1])
			)
		}))
		.sort((a, b) => a.gap - b.gap)[0];
	return { teams: chosen.teams, balanceGap: chosen.gap, algorithmVersion: PAIRING_VERSION };
}
