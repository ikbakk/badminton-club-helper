import type { ActiveMatch, LiveSession, MatchSet } from '$lib/data/live';
import type { Participant, ParticipantStatus } from '$lib/domain/types';
import { recommendNextPlayers } from '$lib/domain/rotation';

export const DEMO_STORAGE_KEY = 'courtside:demo-session:v3';

export type DemoState = {
	session: LiveSession | null;
	participants: Participant[];
	activeMatches: ActiveMatch[];
	completedMatches: number;
	nextSequence: number;
	completed: ActiveMatch[];
	kokByMatch: Record<string, number>;
	pricing: { base: number; kokPrice: number; courtRent: number } | null;
	adjustments: Record<string, { amount: number; reason: string }>;
	paidIds: string[];
	kasExpenses: { amount: number; label: string }[];
	openingKas: number;
	countKok: boolean;
	hasEndedSession: boolean;
	attendeeIds: string[];
};

const names = Array.from({ length: 20 }, (_, i) => `DEMO P${i + 1}`);
const lineup = names.slice(0, 4).map((name, i) => ({
	id: `demo-${i}`,
	name,
	team: i < 2 ? ('A' as const) : ('B' as const)
}));

export function sampleMatchDemoState(): DemoState {
	const participants: Participant[] = names.map((name, i) => ({
		id: `demo-${i}`,
		name,
		membership: 'MEMBER',
		rating: 1200,
		uncertainty: 280,
		status: i < 4 ? 'PLAYING' : i < 8 ? 'READY' : 'RESTING',
		readySince: i >= 4 && i < 8 ? new Date(Date.now() - (i - 3) * 8 * 60_000) : undefined,
		consecutiveMatches: i < 4 ? 1 : 0,
		opportunities: 1,
		missedOpportunities: 0,
		currentOpportunityDebt: 0,
		rotationsPlayed: i < 4 ? 1 : 0,
		setsPlayed: i < 4 ? 1 : 0
	}));
	return {
		session: {
			id: 'demo-session',
			club_id: 'demo-club',
			started_at: new Date().toISOString(),
			court_count: 1,
			match_mode: 'ASSISTED',
			count_kok: true
		},
		participants,
		activeMatches: [
			{
				id: 'demo-match-1',
				session_id: 'demo-session',
				sequence_number: 1,
				court_number: 1,
				sets: [
					{
						id: 'demo-match-1-set-1',
						setNumber: 1,
						status: 'COMPLETED',
						teamAScore: 21,
						teamBScore: 18,
						players: lineup
					},
					{
						id: 'demo-match-1-set-2',
						setNumber: 2,
						status: 'IN_PROGRESS',
						teamAScore: null,
						teamBScore: null,
						players: lineup
					}
				]
			}
		],
		completedMatches: 0,
		nextSequence: 2,
		completed: [],
		kokByMatch: {},
		pricing: null,
		adjustments: {},
		paidIds: [],
		kasExpenses: [],
		openingKas: 0,
		countKok: true,
		hasEndedSession: false,
		attendeeIds: participants.filter((player) => player.status !== 'OUT').map((player) => player.id)
	};
}

export function freshDemoState(): DemoState {
	const sample = sampleMatchDemoState();
	return {
		...sample,
		session: null,
		activeMatches: [],
		participants: sample.participants.map((player) => ({
			...player,
			status: 'OUT' as const,
			readySince: undefined,
			consecutiveMatches: 0,
			rotationsPlayed: 0,
			setsPlayed: 0
		})),
		nextSequence: 1,
		attendeeIds: []
	};
}

export function readDemoState(storage: Pick<Storage, 'getItem'>): DemoState {
	try {
		const raw = storage.getItem(DEMO_STORAGE_KEY);
		if (!raw) return freshDemoState();
		const parsed = JSON.parse(raw) as DemoState;
		if (
			!Array.isArray(parsed.participants) ||
			!Array.isArray(parsed.activeMatches) ||
			!Number.isInteger(parsed.nextSequence)
		)
			return freshDemoState();
		return {
			...parsed,
			completed: parsed.completed ?? [],
			kokByMatch: parsed.kokByMatch ?? {},
			pricing: parsed.pricing ?? null,
			adjustments: parsed.adjustments ?? {},
			paidIds: parsed.paidIds ?? [],
			kasExpenses: parsed.kasExpenses ?? [],
			openingKas: parsed.openingKas ?? 0,
			countKok: parsed.countKok ?? true,
			hasEndedSession: parsed.hasEndedSession ?? false,
			attendeeIds: parsed.attendeeIds ?? [],
			participants: parsed.participants.map((player) => ({
				...player,
				readySince: player.readySince ? new Date(player.readySince) : undefined
			}))
		};
	} catch {
		return freshDemoState();
	}
}

export function demoRecommendation(state: DemoState) {
	return recommendNextPlayers(
		state.participants.map((player) => ({
			id: player.id,
			name: player.name,
			status: player.status,
			readySinceMs: player.readySince?.getTime() ?? null,
			eligibleOpportunities: player.opportunities,
			missedOpportunities: player.missedOpportunities,
			currentOpportunityDebt: player.currentOpportunityDebt,
			setsPlayed: player.setsPlayed,
			consecutiveRotations: player.consecutiveMatches,
			rotationsPlayed: player.rotationsPlayed
		})),
		Date.now()
	);
}

export function setDemoStatus(state: DemoState, id: string, status: ParticipantStatus): boolean {
	const player = state.participants.find((item) => item.id === id);
	if (!player || player.status === 'PLAYING') return false;
	player.status = status;
	player.readySince = status === 'READY' ? new Date() : undefined;
	if (status !== 'READY') player.consecutiveMatches = 0;
	return true;
}

export function checkInDemoPlayers(state: DemoState, playerIds: string[]): boolean {
	if (!state.session || !playerIds.length || new Set(playerIds).size !== playerIds.length)
		return false;
	if (
		playerIds.some(
			(id) =>
				state.attendeeIds.includes(id) ||
				!state.participants.some((player) => player.id === id && player.status !== 'PLAYING')
		)
	)
		return false;
	for (const id of playerIds) {
		setDemoStatus(state, id, 'READY');
		state.attendeeIds.push(id);
	}
	return true;
}

function activeSet(match: ActiveMatch) {
	return match.sets.find((set) => set.status === 'IN_PROGRESS');
}

function releaseMatch(state: DemoState, match: ActiveMatch) {
	const played = new Set(match.sets.flatMap((set) => set.players.map((player) => player.id)));
	for (const player of state.participants) {
		if (played.has(player.id) && player.status === 'PLAYING') {
			player.status = player.leaveAfterMatch ? 'LEFT' : 'READY';
			player.readySince = player.status === 'READY' ? new Date() : undefined;
		}
		if (played.has(player.id)) player.consecutiveMatches += 1;
		else if (player.status === 'READY') player.consecutiveMatches = 0;
	}
	state.activeMatches = state.activeMatches.filter((item) => item.id !== match.id);
	// Svelte passes a reactive proxy here; JSON serialization produces a plain
	// snapshot of the match before it is kept in the demo recap.
	state.completed.push(JSON.parse(JSON.stringify(match)) as ActiveMatch);
	state.completedMatches += 1;
}

export function startDemoMatch(
	state: DemoState,
	teamA: string[],
	teamB: string[],
	courtNumber = 1
) {
	if (
		!state.session ||
		!Number.isInteger(courtNumber) ||
		courtNumber < 1 ||
		courtNumber > (state.session.court_count ?? 1) ||
		state.activeMatches.some((match) => match.court_number === courtNumber)
	)
		return false;
	const ids = [...teamA, ...teamB];
	if (
		teamA.length !== 2 ||
		teamB.length !== 2 ||
		new Set(ids).size !== 4 ||
		ids.some((id) => state.participants.find((player) => player.id === id)?.status !== 'READY')
	)
		return false;
	const ready = state.participants.filter((player) => player.status === 'READY');
	const chosen = new Set(ids);
	for (const player of ready) {
		player.opportunities += 1;
		if (chosen.has(player.id)) {
			player.status = 'PLAYING';
			player.readySince = undefined;
			player.currentOpportunityDebt = 0;
			player.rotationsPlayed += 1;
		} else {
			player.missedOpportunities += 1;
			player.currentOpportunityDebt += 1;
		}
	}
	const sequence = state.nextSequence++;
	const players = ids.map((id, index) => ({
		id,
		name: state.participants.find((player) => player.id === id)!.name,
		team: index < 2 ? ('A' as const) : ('B' as const)
	}));
	state.activeMatches.push({
		id: `demo-match-${sequence}`,
		session_id: state.session.id,
		sequence_number: sequence,
		court_number: courtNumber,
		sets: [
			{
				id: `demo-match-${sequence}-set-1`,
				setNumber: 1,
				status: 'IN_PROGRESS',
				teamAScore: null,
				teamBScore: null,
				players
			}
		]
	});
	return true;
}

export function correctDemoSet(
	state: DemoState,
	matchId: string,
	setNumber: number,
	a: number,
	b: number
) {
	const match = state.activeMatches.find((item) => item.id === matchId);
	const set = match?.sets.find(
		(item) => item.setNumber === setNumber && item.status === 'COMPLETED'
	);
	if (!match || !set || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b)
		return false;
	set.teamAScore = a;
	set.teamBScore = b;
	if (match.sets.length === 2 && !activeSet(match)) {
		const winsA = match.sets.filter((item) => item.teamAScore! > item.teamBScore!).length;
		if (winsA === 0 || winsA === 2) releaseMatch(state, match);
	}
	return true;
}

export function completeDemoSet(state: DemoState, matchId: string, a: number, b: number) {
	const match = state.activeMatches.find((item) => item.id === matchId);
	const set = match && activeSet(match);
	if (!match || !set || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b)
		return false;
	set.status = 'COMPLETED';
	set.teamAScore = a;
	set.teamBScore = b;
	for (const player of set.players)
		state.participants.find((item) => item.id === player.id)!.setsPlayed += 1;
	if (set.setNumber === 1) {
		match.sets.push(nextSet(match, 2, set.players));
	} else if (
		set.setNumber === 3 ||
		match.sets.filter((item) => item.status === 'COMPLETED' && item.teamAScore! > item.teamBScore!)
			.length === 2 ||
		match.sets.filter((item) => item.status === 'COMPLETED' && item.teamBScore! > item.teamAScore!)
			.length === 2
	) {
		releaseMatch(state, match);
	}
	return true;
}

function nextSet(match: ActiveMatch, number: number, players: MatchSet['players']): MatchSet {
	return {
		id: `${match.id}-set-${number}`,
		setNumber: number,
		status: 'IN_PROGRESS',
		teamAScore: null,
		teamBScore: null,
		players: players.map((player) => ({ ...player }))
	};
}

export function startDemoDecider(state: DemoState, matchId: string) {
	const match = state.activeMatches.find((item) => item.id === matchId);
	if (
		!match ||
		match.sets.length !== 2 ||
		activeSet(match) ||
		match.sets.some((set) => set.status !== 'COMPLETED')
	)
		return false;
	match.sets.push(nextSet(match, 3, match.sets[1].players));
	return true;
}

export function finishDemoTie(state: DemoState, matchId: string) {
	const match = state.activeMatches.find((item) => item.id === matchId);
	if (
		!match ||
		match.sets.length !== 2 ||
		activeSet(match) ||
		match.sets.some((set) => set.status !== 'COMPLETED')
	)
		return false;
	releaseMatch(state, match);
	return true;
}

export function substituteDemoPlayer(
	state: DemoState,
	matchId: string,
	outgoingId: string,
	replacementId: string,
	outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
) {
	const match = state.activeMatches.find((item) => item.id === matchId);
	const set = match && activeSet(match);
	const replacement = state.participants.find((player) => player.id === replacementId);
	if (!set || set.setNumber < 2 || !replacement || replacement.status !== 'READY') return false;
	const old = set.players.find((player) => player.id === outgoingId);
	if (!old) return false;
	const outgoing = state.participants.find((player) => player.id === outgoingId)!;
	outgoing.status = outgoingStatus;
	outgoing.readySince = undefined;
	replacement.status = 'PLAYING';
	replacement.readySince = undefined;
	old.id = replacement.id;
	old.name = replacement.name;
	return true;
}
