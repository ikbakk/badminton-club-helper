import { simulateSession } from '../src/lib/domain/rotation/simulator';
import { STARVATION_POLICIES } from '../src/lib/domain/rotation/score';
import type {
	SimulationEvent,
	SimulationOptions,
	SimulationResult
} from '../src/lib/domain/rotation/types';

export type SimulationSettings = {
	seed: number;
	players: number;
	minimum: number;
	maxRotations?: number;
	matchMinutes?: number;
};
export function seededRandom(seed: number) {
	let value = seed >>> 0;
	return () => {
		value = (value + 0x6d2b79f5) | 0;
		let n = Math.imul(value ^ (value >>> 15), 1 | value);
		n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
		return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
	};
}
export function buildScenario(settings: SimulationSettings) {
	const { seed, players, minimum } = settings;
	if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
		throw new Error('Seed must be an integer from 0 to 4294967295.');
	if (!Number.isInteger(players) || players < 4 || players > 40)
		throw new Error('Choose 4–40 players.');
	if (!Number.isInteger(minimum) || minimum < 3 || minimum > 30)
		throw new Error('Minimum rotations must be 3–30.');
	const cap = settings.maxRotations ?? players * minimum * 4;
	if (!Number.isInteger(cap) || cap < 1 || cap > 5000)
		throw new Error('Maximum rotations must be 1–5000.');
	const minutes = settings.matchMinutes ?? 2;
	if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120)
		throw new Error('Match minutes must be greater than zero and at most 120.');
	const random = seededRandom(seed);
	const durations = Array.from({ length: cap }, () =>
		Math.round(minutes * 60_000 * (0.5 + random()))
	);
	const boundaries = [0];
	for (const duration of durations) boundaries.push(boundaries.at(-1)! + duration);
	const at = (rotation: number) => boundaries[Math.min(rotation, cap)];
	const roster = Array.from({ length: players }, (_, i) => ({
		id: `sim-${String(i + 1).padStart(2, '0')}`,
		name: `[SIM] Player ${String(i + 1).padStart(2, '0')}`,
		arrivesAtMs: i < 4 ? 0 : at(Math.floor(random() * 4))
	}));
	const events: SimulationEvent[] = [];
	if (players >= 6 && cap > 7) {
		const rest = roster[4 + Math.floor(random() * (players - 4))].id;
		const away = roster.find((player) => player.id !== rest && player.id !== roster[0].id)!.id;
		events.push(
			{ atMs: at(4), type: 'STATUS', playerId: rest, status: 'RESTING' },
			{ atMs: at(6), type: 'STATUS', playerId: rest, status: 'READY' },
			{ atMs: at(5), type: 'STATUS', playerId: away, status: 'AWAY' },
			{ atMs: at(7), type: 'STATUS', playerId: away, status: 'READY' }
		);
	}
	const scores = durations.map(() =>
		Array.from({ length: 2 }, () =>
			random() < 0.5 ? [21, Math.floor(random() * 20)] : [Math.floor(random() * 20), 21]
		)
	);
	const options: SimulationOptions = {
		players: roster,
		events: [...events],
		matchDurationsMs: durations,
		starvationPolicy: STARVATION_POLICIES.DEBT_4_OR_WAIT_45
	};
	// Include one actual Set 2 fill-in after every scheduled arrival/rest has returned.
	if (players > 4 && cap > 8) {
		const preview = simulateSession({ ...options, rotations: 9 });
		const selected = preview.selections[8]?.actual;
		const incoming = roster.find((player) => !selected?.includes(player.id));
		if (selected && incoming) {
			options.fillIns = { 8: [{ outgoingPlayerId: selected[0], incomingPlayerId: incoming.id }] };
			options.events!.push({ atMs: at(9), type: 'STATUS', playerId: selected[0], status: 'READY' });
		}
	}
	return {
		settings: { ...settings, maxRotations: cap, matchMinutes: minutes },
		options,
		events,
		boundaries,
		scores
	};
}
export type Scenario = ReturnType<typeof buildScenario>;

/** Independent action/selection audit, rather than inferring fairness from the stop target. */
export function auditSelections(scenario: Scenario, result: SimulationResult) {
	const violations: string[] = [];
	const fallbackRotations: number[] = [];
	const state = new Map(
		scenario.options.players.map((player) => [
			player.id,
			{
				status: (player.arrivesAtMs ?? 0) <= 0 ? 'READY' : 'OUT',
				consecutive: 0,
				starts: 0,
				opportunities: 0,
				debt: 0
			}
		])
	);
	const events: SimulationEvent[] = [
		...(scenario.options.events ?? []),
		...scenario.options.players
			.filter((p) => (p.arrivesAtMs ?? 0) > 0)
			.map((p) => ({ atMs: p.arrivesAtMs!, type: 'ARRIVE' as const, playerId: p.id }))
	].sort((a, b) => a.atMs - b.atMs || a.playerId.localeCompare(b.playerId));
	let eventIndex = 0;
	for (const turn of result.selections) {
		const now = scenario.boundaries[turn.rotation];
		while (eventIndex < events.length && events[eventIndex].atMs <= now) {
			const event = events[eventIndex++];
			state.get(event.playerId)!.status = event.type === 'ARRIVE' ? 'READY' : event.status;
		}
		const ready = [...state.entries()].filter(([, p]) => p.status === 'READY');
		const selected = new Set(turn.actual);
		if (turn.actual.length !== 4 || selected.size !== 4)
			violations.push(`Rotation ${turn.rotation + 1}: not four distinct players.`);
		for (const id of selected) {
			const player = state.get(id);
			if (!player || player.status !== 'READY') {
				violations.push(`Rotation ${turn.rotation + 1}: ${id} is not READY.`);
				continue;
			}
			if (player.consecutive >= 2) {
				if (ready.filter(([other, p]) => other !== id && p.consecutive < 2).length >= 4)
					violations.push(
						`Rotation ${turn.rotation + 1}: avoidable third consecutive start for ${id}.`
					);
				else fallbackRotations.push(turn.rotation + 1);
			}
		}
		for (const [id, p] of state) {
			if (p.status === 'READY') {
				p.opportunities++;
				p.debt = selected.has(id) ? 0 : p.debt + 1;
			}
			p.consecutive = selected.has(id) ? p.consecutive + 1 : 0;
			if (selected.has(id)) p.starts++;
		}
		for (const fill of scenario.options.fillIns?.[turn.rotation] ?? [])
			state.get(fill.outgoingPlayerId)!.status = 'RESTING';
	}
	for (const player of result.players) {
		const expected = state.get(player.playerId)!;
		if (
			player.rotationsPlayed !== expected.starts ||
			player.eligibleOpportunities !== expected.opportunities ||
			player.currentOpportunityDebt !== expected.debt
		)
			violations.push(`Incorrect persisted-style counters for ${player.playerId}.`);
	}
	return { violations, fallbackRotations: [...new Set(fallbackRotations)] };
}
export function simulateRandomSession(settings: SimulationSettings) {
	const scenario = buildScenario(settings);
	let result = simulateSession({ ...scenario.options, rotations: 1 });
	for (
		let rotations = 2;
		rotations <= scenario.settings.maxRotations &&
		result.players.some((p) => p.rotationsPlayed < settings.minimum);
		rotations++
	)
		result = simulateSession({ ...scenario.options, rotations });
	const audit = auditSelections(scenario, result);
	const unmetPlayerIds = result.players
		.filter((p) => p.rotationsPlayed < settings.minimum)
		.map((p) => p.playerId);
	return {
		mode: 'offline' as const,
		seed: settings.seed,
		scenario,
		result,
		...audit,
		unmetPlayerIds,
		passed: unmetPlayerIds.length === 0 && audit.violations.length === 0,
		virtualMinutes: scenario.boundaries[result.rotationsCompleted] / 60_000
	};
}
