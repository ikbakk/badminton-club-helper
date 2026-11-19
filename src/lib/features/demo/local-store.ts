import type { LiveSessionSnapshot } from '$lib/data/live';
import {
	DEMO_CLUB_ID,
	DEMO_CLUB_NAME,
	DEMO_STORAGE_KEY,
	freshDemoState,
	readDemoState,
	checkInDemoPlayers,
	setDemoStatus,
	startDemoMatch,
	completeDemoSet,
	startDemoDecider,
	finishDemoTie,
	substituteDemoPlayer,
	type DemoState
} from './local-session';

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);
export const isDemoClub = (clubId: string | null | undefined) => clubId === DEMO_CLUB_ID;

export function readLocalDemo(): DemoState {
	const target = storage();
	return target ? readDemoState(target) : freshDemoState();
}

export function writeLocalDemo(state: DemoState) {
	storage()?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

export function updateLocalDemo<T>(update: (state: DemoState) => T): T {
	const state = readLocalDemo();
	const result = update(state);
	writeLocalDemo(state);
	return result;
}

export function localDemoSnapshot(): LiveSessionSnapshot {
	const state = readLocalDemo();
	return {
		session: state.hasEndedSession ? null : state.session,
		participants: state.hasEndedSession
			? []
			: state.participants
					.filter((participant) => state.attendeeIds.includes(participant.id))
					.map((participant) => ({ ...participant, sessionParticipantId: participant.id })),
		activeMatches: state.activeMatches,
		activeMatch: state.activeMatches[0] ?? null
	};
}

export function localDemoClub() {
	return { id: DEMO_CLUB_ID, name: DEMO_CLUB_NAME, is_club_admin: true };
}

export function localDemoRoster() {
	return readLocalDemo().participants.map((player) => ({
		id: player.id,
		display_name: player.name,
		membership_type: player.membership,
		rating: player.rating,
		uncertainty: player.uncertainty
	}));
}

export function localDemoKokShares(price: number) {
	const state = readLocalDemo();
	const amounts = new Map<string, number>();
	for (const match of [...state.completed, ...state.activeMatches]) {
		const cost = (state.kokByMatch[match.id] ?? 0) * price;
		const players = [
			...new Set(match.sets.flatMap((set) => set.players.map((player) => player.id)))
		];
		if (!players.length) continue;
		for (const playerId of players)
			amounts.set(playerId, (amounts.get(playerId) ?? 0) + cost / players.length);
	}
	return [...amounts].map(([player_id, amount]) => ({ player_id, kok_amount: Math.round(amount) }));
}

export function localDemoCommand(name: string, args: Record<string, unknown>) {
	return updateLocalDemo((state) => {
		const sessionId = String(args.p_session_id ?? '');
		if (state.session && sessionId && state.session.id !== sessionId)
			throw new Error('Sesi demo tidak ditemukan.');
		switch (name) {
			case 'check_in_player':
			case 'check_in_players': {
				const ids = (args.p_player_ids as string[] | undefined) ?? [String(args.p_player_id)];
				if (!checkInDemoPlayers(state, ids)) throw new Error('Pemain tidak dapat check-in.');
				return true;
			}
			case 'change_participant_status':
				if (!setDemoStatus(state, String(args.p_participant_id), args.p_status as never))
					throw new Error('Status pemain tidak dapat diubah.');
				return true;
			case 'start_match': {
				if (
					!startDemoMatch(
						state,
						args.p_team_a as string[],
						args.p_team_b as string[],
						Number(args.p_court_number ?? 1)
					)
				)
					throw new Error('Match tidak dapat dimulai.');
				return state.activeMatches.at(-1)?.id;
			}
			case 'start_decider_set':
				if (!startDemoDecider(state, String(args.p_match_id)))
					throw new Error('Set 3 tidak dapat dimulai.');
				return true;
			case 'finish_tied_match':
				if (!finishDemoTie(state, String(args.p_match_id)))
					throw new Error('Match tidak dapat diakhiri.');
				return true;
			case 'add_guest_and_check_in': {
				const id = `demo-guest-${Date.now()}`;
				state.participants.push({
					id,
					name: String(args.p_name),
					membership: 'GUEST',
					rating: 1200,
					uncertainty: 350,
					status: 'READY',
					readySince: new Date(),
					consecutiveMatches: 0,
					opportunities: 0,
					missedOpportunities: 0,
					currentOpportunityDebt: 0,
					rotationsPlayed: 0,
					setsPlayed: 0
				});
				state.attendeeIds.push(id);
				return id;
			}
			case 'set_leave_after_match': {
				const player = state.participants.find(
					(item) =>
						item.sessionParticipantId === args.p_participant_id || item.id === args.p_participant_id
				);
				if (!player) throw new Error('Pemain tidak ditemukan.');
				player.leaveAfterMatch = Boolean(args.p_leave_after_match);
				return true;
			}
			case 'substitute_player':
				if (
					!substituteDemoPlayer(
						state,
						String(args.p_match_id),
						String(args.p_outgoing_player_id),
						String(args.p_replacement_player_id),
						args.p_outgoing_status as 'RESTING' | 'OUT' | 'LEFT'
					)
				)
					throw new Error('Pergantian pemain tidak dapat dilakukan.');
				return true;
			case 'abandon_match': {
				const match = state.activeMatches.find((item) => item.id === args.p_match_id);
				if (!match) throw new Error('Match tidak ditemukan.');
				state.activeMatches = state.activeMatches.filter((item) => item.id !== match.id);
				for (const player of state.participants)
					if (match.sets.some((set) => set.players.some((entry) => entry.id === player.id)))
						player.status = 'READY';
				return true;
			}
			case 'record_match_kok':
				state.kokByMatch[String(args.p_match_id)] = Number(args.p_count);
				return true;
			default:
				return null;
		}
	});
}

export function localDemoCompleteSet(setId: string, a: number, b: number) {
	return updateLocalDemo((state) => {
		const match = state.activeMatches.find((item) => item.sets.some((set) => set.id === setId));
		if (!match || !completeDemoSet(state, match.id, a, b)) throw new Error('Skor set tidak valid.');
		return true;
	});
}

export function localDemoStartSession(
	clubId: string,
	courtCount: number,
	matchMode: 'ASSISTED' | 'MANUAL',
	countKok: boolean
) {
	if (!isDemoClub(clubId)) return null;
	return updateLocalDemo((state) => {
		if (state.session && !state.hasEndedSession) throw new Error('Sesi demo sedang berjalan.');
		state.session = {
			id: `demo-session-${Date.now()}`,
			club_id: DEMO_CLUB_ID,
			started_at: new Date().toISOString(),
			court_count: courtCount,
			match_mode: matchMode,
			count_kok: countKok
		};
		state.countKok = countKok;
		state.attendeeIds = [];
		state.completed = [];
		state.kokByMatch = {};
		state.pricing = null;
		state.paidIds = [];
		state.closedAt = undefined;
		state.hasEndedSession = false;
		state.participants = state.participants.map((player) => ({
			...player,
			status: 'OUT',
			readySince: undefined,
			leaveAfterMatch: false,
			consecutiveMatches: 0,
			opportunities: 0,
			missedOpportunities: 0,
			currentOpportunityDebt: 0,
			rotationsPlayed: 0,
			setsPlayed: 0
		}));
		return state.session.id;
	});
}

export function localDemoCloseSession(sessionId: string) {
	return updateLocalDemo((state) => {
		if (state.session?.id !== sessionId || state.activeMatches.length)
			throw new Error('Akhiri match aktif sebelum menutup sesi.');
		state.hasEndedSession = true;
		state.closedAt = new Date().toISOString();
		return {
			attendance: state.attendeeIds.length,
			sets: state.completed.reduce(
				(sum, match) => sum + match.sets.filter((set) => set.status === 'COMPLETED').length,
				0
			),
			startedAt: state.session.started_at
		};
	});
}
