export const SESSION_EVALUATION_THRESHOLDS = {
	closeSetMargin: 3,
	blowoutMargin: 10,
	maxReadyWaitMinutes: 45,
	rotationSpread: 2,
	pairingOverrideRate: 0.4,
	blowoutRate: 0.35,
	currentDebt: 4
} as const;

export type EvaluationPlayer = { id: string; name: string };
export type EvaluationPeriod = {
	playerId: string;
	status: string;
	startedAt: string;
	endedAt: string | null;
};
export type EvaluationRotation = {
	id: string;
	at: string;
	readyPlayerIds: string[];
	recommendedPlayerIds: string[];
	actualPlayerIds: string[];
};
export type EvaluationSet = {
	id: string;
	number: number;
	status: string;
	scoreA: number | null;
	scoreB: number | null;
	players: { playerId: string; team: 'A' | 'B' }[];
};
export type EvaluationMatch = {
	id: string;
	rotationRecommendationIds?: string[];
	pairing?: {
		recommendedPlayerTeams: { playerId: string; team: 'A' | 'B' }[];
		recommendedGap: number | null;
		actualGap?: number | null;
	};
	sets: EvaluationSet[];
};
export type SessionEvaluationInput = {
	sessionId: string;
	startedAt: string;
	closedAt: string | null;
	now?: string;
	players: EvaluationPlayer[];
	periods: EvaluationPeriod[];
	readyWaitComplete: boolean;
	rotations: EvaluationRotation[];
	matches: EvaluationMatch[];
	recommendationCount?: number;
	ratingObservations?: {
		playerId: string;
		source: string;
		ratingBefore: number;
		ratingAfter: number;
		setId: string | null;
	}[];
};

export function readyHistoryIsComplete(input: {
	participants: { playerId: string; checkedInAt: string }[];
	periods: EvaluationPeriod[];
	closedAt: string;
}) {
	const toleranceMs = 1000;
	const sessionEnd = Date.parse(input.closedAt);
	if (!Number.isFinite(sessionEnd) || input.participants.length === 0) return false;
	return input.participants.every((participant) => {
		const checkIn = Date.parse(participant.checkedInAt);
		const rows = input.periods
			.filter((period) => period.playerId === participant.playerId)
			.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
		if (!Number.isFinite(checkIn) || rows.length === 0) return false;
		let coveredUntil = checkIn;
		for (const row of rows) {
			const start = Date.parse(row.startedAt);
			const end = row.endedAt ? Date.parse(row.endedAt) : Number.NaN;
			if (!Number.isFinite(start) || !Number.isFinite(end) || start > coveredUntil + toleranceMs)
				return false;
			coveredUntil = Math.max(coveredUntil, end);
		}
		return coveredUntil >= sessionEnd - toleranceMs;
	});
}
const sorted = (ids: string[]) => [...ids].sort().join('|');
function samePartition(
	a: { playerId: string; team: 'A' | 'B' }[],
	b: { playerId: string; team: 'A' | 'B' }[]
) {
	if (a.length !== 4 || b.length !== 4) return false;
	const normalize = (teamA: string[], teamB: string[]) =>
		[sorted(teamA), sorted(teamB)].sort().join('::');
	return (
		normalize(
			a.filter((x) => x.team === 'A').map((x) => x.playerId),
			a.filter((x) => x.team === 'B').map((x) => x.playerId)
		) ===
		normalize(
			b.filter((x) => x.team === 'A').map((x) => x.playerId),
			b.filter((x) => x.team === 'B').map((x) => x.playerId)
		)
	);
}
const spread = (values: number[]) =>
	values.length ? Math.max(...values) - Math.min(...values) : 0;

export function evaluateSession(input: SessionEvaluationInput) {
	const endAt = Date.parse(input.closedAt ?? input.now ?? new Date().toISOString());
	const rotations = [...input.rotations].sort((a, b) => a.at.localeCompare(b.at));
	const playerRows = input.players.map((player) => {
		const playerPeriods = input.periods.filter((period) => period.playerId === player.id);
		let totalReadyMs = 0,
			maxReadyMs = 0;
		for (const period of playerPeriods)
			if (period.status === 'READY') {
				const start = Date.parse(period.startedAt),
					end = Math.min(period.endedAt ? Date.parse(period.endedAt) : endAt, endAt);
				if (Number.isFinite(start) && end > start) {
					totalReadyMs += end - start;
					maxReadyMs = Math.max(maxReadyMs, end - start);
				}
			}
		const played = rotations.filter((r) => r.actualPlayerIds.includes(player.id)).length;
		const eligible = rotations.filter((r) => r.readyPlayerIds.includes(player.id));
		const missed = eligible.filter((r) => !r.actualPlayerIds.includes(player.id)).length;
		const lastPlayedAt = eligible.reduce(
			(last, rotation, index) => (rotation.actualPlayerIds.includes(player.id) ? index : last),
			-1
		);
		const currentDebt = eligible
			.slice(lastPlayedAt + 1)
			.filter((r) => !r.actualPlayerIds.includes(player.id)).length;
		const fullRotations = played;
		const setsPlayed = input.matches
			.flatMap((m) => m.sets)
			.filter(
				(s) => s.status === 'COMPLETED' && s.players.some((p) => p.playerId === player.id)
			).length;
		const fillInSets = input.matches.flatMap((match) => {
			const selectedAtStart =
				rotations.find((rotation) => rotation.id === match.id)?.actualPlayerIds ?? [];
			return match.sets.filter(
				(set) =>
					set.status === 'COMPLETED' &&
					set.number === 2 &&
					set.players.some((p) => p.playerId === player.id && !selectedAtStart.includes(player.id))
			);
		}).length;
		return {
			playerId: player.id,
			name: player.name,
			eligibleOpportunities: eligible.length,
			missedOpportunities: missed,
			currentOpportunityDebt: Math.max(currentDebt, 0),
			rotationsPlayed: fullRotations,
			setsPlayed,
			maxReadyWaitMinutes: input.readyWaitComplete ? Math.round(maxReadyMs / 60000) : null,
			totalReadyWaitMinutes: input.readyWaitComplete ? Math.round(totalReadyMs / 60000) : null,
			consecutiveRotations: (() => {
				let n = 0;
				for (const r of [...rotations].reverse()) {
					if (!r.actualPlayerIds.includes(player.id)) break;
					n++;
				}
				return n;
			})(),
			fillInSets,
			starvation: eligible.length > 0 && fullRotations === 0,
			flags: [
				eligible.length > 0 && fullRotations === 0 ? 'STARVATION_FLAG' : null,
				currentDebt >= SESSION_EVALUATION_THRESHOLDS.currentDebt ? 'CURRENT_DEBT_HIGH' : null,
				input.readyWaitComplete &&
				maxReadyMs / 60000 >= SESSION_EVALUATION_THRESHOLDS.maxReadyWaitMinutes
					? 'MAX_WAIT_HIGH'
					: null
			].filter(Boolean)
		};
	});
	const comparedRotations = rotations.filter(
		(rotation) => rotation.recommendedPlayerIds.length === 4
	);
	const overrides = comparedRotations.filter(
		(r) => sorted(r.recommendedPlayerIds) !== sorted(r.actualPlayerIds)
	).length;
	const rotationCounts = playerRows.map((p) => p.rotationsPlayed),
		setCounts = playerRows.map((p) => p.setsPlayed),
		missedCounts = playerRows.map((p) => p.missedOpportunities);
	const pairingRows = input.matches
		.filter((m) => m.pairing)
		.map((match) => {
			const first = match.sets.find((set) => set.number === 1);
			const actual = first?.players ?? [];
			return {
				matchId: match.id,
				recommendedGap: match.pairing!.recommendedGap,
				actualGap: match.pairing!.actualGap ?? null,
				overridden: first ? !samePartition(match.pairing!.recommendedPlayerTeams, actual) : null
			};
		});
	const completed = input.matches.flatMap((m) =>
		m.sets
			.filter((s) => s.status === 'COMPLETED' && s.scoreA !== null && s.scoreB !== null)
			.map((s) => ({ setId: s.id, margin: Math.abs(s.scoreA! - s.scoreB!), matchId: m.id }))
	);
	const actualGaps = pairingRows
		.map((row) => row.actualGap)
		.filter((gap): gap is number => gap !== null);
	const pairingOverrideCount = pairingRows.filter((r) => r.overridden === true).length;
	const blowouts = completed.filter(
		(s) => s.margin >= SESSION_EVALUATION_THRESHOLDS.blowoutMargin
	).length;
	const maxWait = input.readyWaitComplete
		? Math.max(0, ...playerRows.map((p) => p.maxReadyWaitMinutes ?? 0))
		: null;
	const flags = [
		!input.readyWaitComplete ? 'READY_WAIT_INCOMPLETE' : null,
		playerRows.some((player) => player.starvation) ? 'STARVATION_FLAG' : null,
		playerRows.some(
			(player) => player.currentOpportunityDebt >= SESSION_EVALUATION_THRESHOLDS.currentDebt
		)
			? 'CURRENT_DEBT_HIGH'
			: null,
		maxWait !== null && maxWait >= SESSION_EVALUATION_THRESHOLDS.maxReadyWaitMinutes
			? 'MAX_WAIT_HIGH'
			: null,
		spread(rotationCounts) > SESSION_EVALUATION_THRESHOLDS.rotationSpread
			? 'ROTATION_SPREAD_HIGH'
			: null,
		pairingRows.length > 0 &&
		pairingOverrideCount / pairingRows.length > SESSION_EVALUATION_THRESHOLDS.pairingOverrideRate
			? 'PAIRING_OVERRIDE_HIGH'
			: null,
		completed.length > 0 && blowouts / completed.length > SESSION_EVALUATION_THRESHOLDS.blowoutRate
			? 'BLOWOUT_RATE_HIGH'
			: null
	].filter(Boolean);
	return {
		sessionId: input.sessionId,
		attendance: input.players.length,
		durationMinutes: Math.max(0, Math.round((endAt - Date.parse(input.startedAt)) / 60000)),
		algorithm1: {
			recommendations: input.recommendationCount ?? rotations.length,
			overrides,
			overrideRate: comparedRotations.length ? overrides / comparedRotations.length : 0,
			rotationSpread: spread(rotationCounts),
			setSpread: spread(setCounts),
			missedSpread: spread(missedCounts),
			readyWaitStatus: input.readyWaitComplete ? 'COMPLETE' : 'INCOMPLETE',
			maxReadyWaitMinutes: maxWait,
			starvationIncidents: playerRows.filter((p) => p.starvation).length,
			players: playerRows
		},
		algorithm2: {
			recommendations: pairingRows.length,
			accepted: pairingRows.filter((r) => r.overridden === false).length,
			overrides: pairingOverrideCount,
			overrideRate: pairingRows.length ? pairingOverrideCount / pairingRows.length : 0,
			averageRecommendedGap: average(
				pairingRows.map((r) => r.recommendedGap).filter((n): n is number => n !== null)
			),
			averageActualGap: average(actualGaps),
			completedSets: completed.length,
			averageScoreMargin: average(completed.map((s) => s.margin)),
			blowoutCount: blowouts,
			closeSetCount: completed.filter(
				(s) => s.margin <= SESSION_EVALUATION_THRESHOLDS.closeSetMargin
			).length,
			sets: completed
		},
		ratingObservations: input.ratingObservations ?? [],
		flags
	};
}
function average(values: number[]) {
	return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
}
