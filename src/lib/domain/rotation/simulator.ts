import { recommendNextPlayers } from './recommend';
import type {
	PlayerSimulationMetrics,
	RotationPlayerInput,
	SimulationEvent,
	SimulationOptions,
	SimulationResult
} from './types';

type State = RotationPlayerInput & {
	name: string;
	rotationsPlayed: number;
	fillInSets: number;
	totalReadyWaitMs: number;
	maximumContinuousReadyWaitMs: number;
	readySinceMs: number | null;
};

function distribution(values: number[]) {
	if (!values.length) return { min: 0, max: 0, mean: 0, standardDeviation: 0 };
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	return {
		min: Math.min(...values),
		max: Math.max(...values),
		mean,
		standardDeviation: Math.sqrt(
			values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
		)
	};
}

/** Deterministic, event-driven simulator. No wall clock, random source, or I/O. */
export function simulateSession(options: SimulationOptions): SimulationResult {
	const states = new Map<string, State>();
	for (const input of options.players) {
		const arrived = (input.arrivesAtMs ?? 0) <= 0;
		const status = arrived ? (input.initialStatus ?? 'READY') : 'OUT';
		states.set(input.id, {
			...input,
			name: input.name ?? input.id,
			status,
			readySinceMs: status === 'READY' ? 0 : null,
			eligibleOpportunities: 0,
			missedOpportunities: 0,
			currentOpportunityDebt: 0,
			setsPlayed: 0,
			consecutiveRotations: 0,
			rotationsPlayed: 0,
			fillInSets: 0,
			totalReadyWaitMs: 0,
			maximumContinuousReadyWaitMs: 0
		});
	}
	const eventQueue: SimulationEvent[] = [
		...(options.events ?? []),
		...options.players
			.filter((player) => (player.arrivesAtMs ?? 0) > 0)
			.map((player) => ({
				atMs: player.arrivesAtMs!,
				type: 'ARRIVE' as const,
				playerId: player.id,
				name: player.name
			}))
	].sort((a, b) => a.atMs - b.atMs || a.playerId.localeCompare(b.playerId));
	const selectionCount = options.rotations ?? options.matchDurationsMs.length;
	const selections: SimulationResult['selections'] = [];
	let nowMs = 0;
	let eventIndex = 0;
	let forcedThird = 0;
	let consecutiveCount = 0;
	const applyEventsThrough = (untilMs: number) => {
		while (eventIndex < eventQueue.length && eventQueue[eventIndex].atMs <= untilMs) {
			const event = eventQueue[eventIndex++];
			let state = states.get(event.playerId);
			if (!state && event.type === 'ARRIVE') {
				state = {
					id: event.playerId,
					name: event.name ?? event.playerId,
					status: 'OUT',
					readySinceMs: null,
					eligibleOpportunities: 0,
					missedOpportunities: 0,
					currentOpportunityDebt: 0,
					setsPlayed: 0,
					consecutiveRotations: 0,
					rotationsPlayed: 0,
					fillInSets: 0,
					totalReadyWaitMs: 0,
					maximumContinuousReadyWaitMs: 0
				};
				states.set(event.playerId, state);
			}
			if (!state) continue;
			if (event.type === 'ARRIVE') {
				if (state.status !== 'READY') {
					state.status = 'READY';
					state.readySinceMs = event.atMs;
				}
			} else {
				if (state.status === 'READY' && state.readySinceMs !== null) {
					state.totalReadyWaitMs += Math.max(0, event.atMs - state.readySinceMs);
					state.maximumContinuousReadyWaitMs = Math.max(
						state.maximumContinuousReadyWaitMs,
						event.atMs - state.readySinceMs
					);
				}
				state.status = event.status;
				state.readySinceMs = event.status === 'READY' ? event.atMs : null;
			}
		}
		nowMs = Math.max(nowMs, untilMs);
	};

	for (let index = 0; index < selectionCount; index++) {
		applyEventsThrough(nowMs);
		const ready = [...states.values()].filter((state) => state.status === 'READY');
		if (ready.length < 4) break;
		const recommendation = recommendNextPlayers(
			ready,
			nowMs,
			options.weights,
			options.starvationPolicy ?? null
		);
		const baselineSelection =
			options.strategy === 'LEAST_GAMES'
				? [...ready]
						.sort(
							(a, b) =>
								a.rotationsPlayed - b.rotationsPlayed ||
								a.setsPlayed - b.setsPlayed ||
								a.id.localeCompare(b.id)
						)
						.slice(0, 4)
						.map((p) => p.id)
				: options.strategy === 'FIFO'
					? [...ready]
							.sort(
								(a, b) =>
									(a.readySinceMs ?? nowMs) - (b.readySinceMs ?? nowMs) || a.id.localeCompare(b.id)
							)
							.slice(0, 4)
							.map((p) => p.id)
					: recommendation.selectedPlayerIds;
		const actual = options.overrides?.[index] ?? baselineSelection;
		if (
			actual.length !== 4 ||
			new Set(actual).size !== 4 ||
			actual.some((id) => !ready.some((p) => p.id === id))
		) {
			throw new Error(`Invalid actual selection at rotation ${index}: ${actual.join(',')}`);
		}
		const selected = new Set(actual);
		for (const state of ready) {
			state.eligibleOpportunities++;
			if (selected.has(state.id)) state.currentOpportunityDebt = 0;
			else {
				state.missedOpportunities++;
				state.currentOpportunityDebt++;
			}
		}
		let actualConsecutive = false;
		for (const state of ready) {
			if (!selected.has(state.id)) {
				state.consecutiveRotations = 0;
				continue;
			}
			if (state.readySinceMs !== null) {
				state.totalReadyWaitMs += Math.max(0, nowMs - state.readySinceMs);
				state.maximumContinuousReadyWaitMs = Math.max(
					state.maximumContinuousReadyWaitMs,
					nowMs - state.readySinceMs
				);
			}
			if (state.consecutiveRotations >= 2) {
				actualConsecutive = true;
				if (
					ready.filter((other) => other.id !== state.id && other.consecutiveRotations < 2).length >=
					4
				) {
					forcedThird++;
				}
			}
			state.consecutiveRotations++;
			state.rotationsPlayed++;
			state.setsPlayed += 2;
			state.status = 'PLAYING';
			state.readySinceMs = null;
		}
		if (actualConsecutive) consecutiveCount++;

		const fillInIds: string[] = [];
		for (const fill of options.fillIns?.[index] ?? []) {
			const outgoing = states.get(fill.outgoingPlayerId);
			const incoming = states.get(fill.incomingPlayerId);
			if (!outgoing || !incoming || !selected.has(outgoing.id) || incoming.status !== 'READY') {
				throw new Error(`Invalid Set 2 fill-in at rotation ${index}`);
			}
			outgoing.setsPlayed--;
			outgoing.status = 'RESTING';
			outgoing.consecutiveRotations = 0;
			incoming.setsPlayed++;
			incoming.fillInSets++;
			incoming.status = 'PLAYING';
			incoming.readySinceMs = null;
			fillInIds.push(incoming.id);
		}
		selections.push({
			rotation: index,
			recommended: recommendation.selectedPlayerIds,
			actual: [...actual],
			fillIns: fillInIds
		});
		const duration = Math.max(
			0,
			options.matchDurationsMs[index % options.matchDurationsMs.length] ?? 0
		);
		applyEventsThrough(nowMs + duration);
		for (const state of states.values()) {
			if (state.status === 'PLAYING') {
				state.status = 'READY';
				state.readySinceMs = nowMs;
			}
		}
	}
	for (const state of states.values()) {
		if (state.status === 'READY' && state.readySinceMs !== null) {
			state.maximumContinuousReadyWaitMs = Math.max(
				state.maximumContinuousReadyWaitMs,
				nowMs - state.readySinceMs
			);
		}
	}
	const players: PlayerSimulationMetrics[] = [...states.values()].map((state) => ({
		playerId: state.id,
		setsPlayed: state.setsPlayed,
		rotationsPlayed: state.rotationsPlayed,
		eligibleOpportunities: state.eligibleOpportunities,
		missedOpportunities: state.missedOpportunities,
		currentOpportunityDebt: state.currentOpportunityDebt,
		currentReadyWaitMs:
			state.status === 'READY' && state.readySinceMs !== null
				? Math.max(0, nowMs - state.readySinceMs)
				: 0,
		totalReadyWaitMs:
			state.totalReadyWaitMs +
			(state.status === 'READY' && state.readySinceMs !== null
				? Math.max(0, nowMs - state.readySinceMs)
				: 0),
		maximumContinuousReadyWaitMs: state.maximumContinuousReadyWaitMs,
		consecutiveRotations: state.consecutiveRotations,
		fillInSets: state.fillInSets
	}));
	const sets = distribution(players.map((player) => player.setsPlayed));
	const rotations = distribution(players.map((player) => player.rotationsPlayed));
	const missed = distribution(players.map((player) => player.missedOpportunities));
	const opportunities = distribution(players.map((player) => player.eligibleOpportunities));
	const waits = distribution(players.map((player) => player.currentReadyWaitMs));
	const totalWaits = distribution(players.map((player) => player.totalReadyWaitMs));
	return {
		rotationsCompleted: selections.length,
		forcedThirdConsecutiveSelections: forcedThird,
		selections,
		players,
		metrics: {
			setsPlayed: sets,
			rotationsPlayed: rotations,
			missedOpportunities: missed,
			eligibleOpportunities: opportunities,
			currentReadyWaitMs: waits,
			totalReadyWaitMs: totalWaits,
			maximumContinuousReadyWaitMs: Math.max(
				0,
				...players.map((player) => player.maximumContinuousReadyWaitMs)
			),
			consecutiveMatchSelections: consecutiveCount,
			selectionSpread: rotations.max - rotations.min,
			starvationIncidents: players.filter(
				(player) => player.eligibleOpportunities > 0 && player.rotationsPlayed === 0
			).length
		}
	};
}
