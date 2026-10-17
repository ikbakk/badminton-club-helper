import { createClient } from '@supabase/supabase-js';
import { recommendNextPlayers } from '../src/lib/domain/rotation/recommend';
import { STARVATION_POLICIES } from '../src/lib/domain/rotation/score';
import { evaluatePairings, RATING_VERSION } from '../src/lib/domain/rating';
import type { RotationPlayerInput } from '../src/lib/domain/rotation/types';
import type { Scenario } from './session-simulation';

type Club = { id?: string; name: string; is_club_admin: boolean };
type Roster = { id: string; display_name: string; rating: number; uncertainty: number };
type Presence = {
	player_id: string;
	participant_id: string;
	display_name: string;
	status: string;
	ready_since: string | null;
	rating: number;
	uncertainty: number;
};
type Fairness = {
	player_id: string;
	eligible_opportunities: number;
	missed_opportunities: number;
	current_opportunity_debt: number;
	sets_played: number;
	consecutive_rotations: number;
	rotations_played: number;
};
export function validateSimulationTarget(
	club: Club | undefined,
	roster: Pick<Roster, 'display_name'>[],
	hasLiveSession: boolean
) {
	if (!club?.is_club_admin) throw new Error('Club Admin authority is required.');
	if (!club.name.startsWith('[SIM]'))
		throw new Error('Database mode requires a dedicated club whose name starts with [SIM].');
	if (roster.some((player) => !player.display_name.startsWith('[SIM] ')))
		throw new Error('Test club must contain only synthetic [SIM] players.');
	if (hasLiveSession)
		throw new Error(
			'Test club already has a live session. Finish or inspect it before another run.'
		);
}
export function readDatabaseConfig(env: NodeJS.ProcessEnv) {
	if (env.SIM_ALLOW_DATABASE_WRITES !== 'true')
		throw new Error('Set SIM_ALLOW_DATABASE_WRITES=true explicitly for database mode.');
	const required = [
		'PUBLIC_SUPABASE_URL',
		'PUBLIC_SUPABASE_ANON_KEY',
		'SIM_APP_URL',
		'SIM_CLUB_ID',
		'SIM_ADMIN_EMAIL',
		'SIM_ADMIN_PASSWORD'
	] as const;
	for (const name of required)
		if (!env[name]) throw new Error(`Missing ${name}; use scripts/simulation.env.example.`);
	const app = new URL(env.SIM_APP_URL!);
	if (app.username || app.password || !['http:', 'https:'].includes(app.protocol))
		throw new Error('Use an HTTP(S) app origin without credentials.');
	if (app.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(app.hostname))
		throw new Error('Remote app URLs must use HTTPS.');
	return {
		supabaseUrl: env.PUBLIC_SUPABASE_URL!,
		anonKey: env.PUBLIC_SUPABASE_ANON_KEY!,
		appUrl: app.origin,
		clubId: env.SIM_CLUB_ID!,
		email: env.SIM_ADMIN_EMAIL!,
		password: env.SIM_ADMIN_PASSWORD!
	};
}
export async function runDatabaseSession(
	scenario: Scenario,
	env: NodeJS.ProcessEnv,
	paceMs = 0,
	leaveOpen = false
) {
	const config = readDatabaseConfig(env);
	const client = createClient(config.supabaseUrl, config.anonKey, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
	async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}) {
		const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(30_000));
		if (error) throw new Error(`${name}: ${error.message}`);
		return data as T;
	}
	const { error: authError } = await client.auth.signInWithPassword({
		email: config.email,
		password: config.password
	});
	if (authError) throw new Error(`Admin login failed: ${authError.message}`);
	const clubs = await rpc<Club[]>('my_club');
	const club = clubs.find((item) => item.id === config.clubId);
	const roster = await rpc<Roster[]>('club_roster', { p_club_id: config.clubId });
	const live = await client.from('live_session').select('id').eq('club_id', config.clubId);
	if (live.error) throw new Error(live.error.message);
	validateSimulationTarget(club, roster, Boolean(live.data?.length));
	// Every read-only target/authority check above completes before any writes below.
	for (const player of scenario.options.players) {
		if (roster.filter((item) => item.display_name === player.name).length > 1)
			throw new Error(`Duplicate synthetic name: ${player.name}`);
	}
	const ids = new Map<string, string>();
	for (const player of scenario.options.players) {
		const existing = roster.filter((item) => item.display_name === player.name);
		if (existing.length > 1) throw new Error(`Duplicate synthetic name: ${player.name}`);
		ids.set(
			player.id,
			existing[0]?.id ??
				(await rpc<string>('add_roster_player', {
					p_club_id: config.clubId,
					p_name: player.name,
					p_membership: 'MEMBER'
				}))
		);
	}
	const sessionId = await rpc<string>('start_session', { p_club_id: config.clubId });
	console.log(`Synthetic database session: ${sessionId} (preserved if interrupted)`);
	const channel = client.channel(`live:${sessionId}`);
	const notify = async () => {
		try {
			await channel.send({ type: 'broadcast', event: 'state_changed', payload: {} });
		} catch {
			/* visible-tab polling is still available */
		}
	};
	const actionLog: Record<string, unknown>[] = [];
	const turns: { rotation: number; selected: string[]; fillIn: string | null }[] = [];
	const arrived = new Set<string>();
	let eventIndex = 0;
	const events = [...scenario.events].sort(
		(a, b) => a.atMs - b.atMs || a.playerId.localeCompare(b.playerId)
	);
	let restorePlayer: string | null = null;
	async function state() {
		const presence = await client.from('live_participants').select('*').eq('session_id', sessionId);
		if (presence.error) throw new Error(presence.error.message);
		const fairness = await rpc<Fairness[]>('get_rotation_fairness_state', {
			p_session_id: sessionId
		});
		return { presence: presence.data as Presence[], fairness };
	}
	async function status(playerId: string, status: string) {
		const snapshot = await state();
		const person = snapshot.presence.find((p) => p.player_id === playerId);
		if (!person) throw new Error('Scheduled status change refers to an absent player.');
		await rpc('change_participant_status', {
			p_session_id: sessionId,
			p_lease_id: null,
			p_participant_id: person.participant_id,
			p_status: status
		});
		actionLog.push({ action: 'STATUS', playerId, status });
	}
	async function activeSets() {
		const { data, error } = await client
			.from('live_active_match')
			.select('*')
			.eq('session_id', sessionId)
			.limit(1);
		if (error) throw new Error(error.message);
		return (data?.[0]?.sets ?? []) as { id: string; setNumber: number; status: string }[];
	}
	async function complete(setNumber: number, score: number[]) {
		const set = (await activeSets()).find(
			(s) => s.setNumber === setNumber && s.status === 'IN_PROGRESS'
		);
		if (!set)
			throw new Error(`No active Set ${setNumber}; session ${sessionId} remains for inspection.`);
		const { data } = await client.auth.getSession();
		if (!data.session) throw new Error('Admin session expired.');
		const response = await fetch(`${config.appUrl}/api/live/complete-set`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${data.session.access_token}`
			},
			body: JSON.stringify({
				sessionId,
				clubId: config.clubId,
				setId: set.id,
				teamAScore: score[0],
				teamBScore: score[1]
			}),
			signal: AbortSignal.timeout(30_000)
		});
		const payload = await response.json();
		if (!response.ok) throw new Error(payload.message ?? 'Trusted set completion failed.');
		actionLog.push({ action: 'COMPLETE_SET', setNumber, score });
	}
	try {
		for (let rotation = 0; rotation < scenario.settings.maxRotations; rotation++) {
			const virtualNow = scenario.boundaries[rotation];
			const arrivals = scenario.options.players.filter(
				(p) => !arrived.has(p.id) && (p.arrivesAtMs ?? 0) <= virtualNow
			);
			if (arrivals.length) {
				await rpc('check_in_players', {
					p_session_id: sessionId,
					p_player_ids: arrivals.map((p) => ids.get(p.id)!)
				});
				for (const p of arrivals) arrived.add(p.id);
				actionLog.push({ action: 'CHECK_IN', players: arrivals.map((p) => p.id) });
			}
			if (restorePlayer) {
				await status(restorePlayer, 'READY');
				restorePlayer = null;
			}
			while (eventIndex < events.length && events[eventIndex].atMs <= virtualNow) {
				const e = events[eventIndex++];
				if (e.type === 'STATUS') await status(ids.get(e.playerId)!, e.status);
			}
			const snapshot = await state();
			if (
				arrived.size === ids.size &&
				[...ids.values()].every(
					(id) =>
						(snapshot.fairness.find((p) => p.player_id === id)?.rotations_played ?? 0) >=
						scenario.settings.minimum
				)
			)
				break;
			const ready = snapshot.presence.filter((p) => p.status === 'READY');
			if (ready.length < 4)
				throw new Error('Fewer than four READY players; refusing to force a selection.');
			const candidates: RotationPlayerInput[] = ready.map((p) => {
				const f = snapshot.fairness.find((row) => row.player_id === p.player_id);
				return {
					id: p.player_id,
					status: 'READY',
					readySinceMs: p.ready_since ? new Date(p.ready_since).getTime() : null,
					eligibleOpportunities: f?.eligible_opportunities ?? 0,
					missedOpportunities: f?.missed_opportunities ?? 0,
					currentOpportunityDebt: f?.current_opportunity_debt ?? 0,
					setsPlayed: f?.sets_played ?? 0,
					consecutiveRotations: f?.consecutive_rotations ?? 0
				};
			});
			const recommendation = recommendNextPlayers(
				candidates,
				Date.now(),
				undefined,
				STARVATION_POLICIES.DEBT_4_OR_WAIT_45
			);
			const selected = recommendation.selectedPlayerIds;
			if (selected.length !== 4 || new Set(selected).size !== 4)
				throw new Error('Invalid production recommendation.');
			for (const id of selected) {
				const person = candidates.find((p) => p.id === id)!;
				if (
					person.consecutiveRotations >= 2 &&
					candidates.filter((p) => p.id !== id && p.consecutiveRotations < 2).length >= 4
				)
					throw new Error('Avoidable third consecutive rotation detected.');
			}
			const recommendationId = await rpc<string>('save_rotation_recommendation', {
				p_session_id: sessionId,
				p_recommended_player_ids: selected,
				p_ranked_candidates: recommendation.rankedCandidates.map((c, index) => ({
					player_id: c.playerId,
					rank: index + 1,
					priority_score: Number.isFinite(c.priority) ? c.priority : null,
					recommended: selected.includes(c.playerId),
					diagnostics: { tier: c.tier, reasons: c.reasons, metrics: c.metrics }
				}))
			});
			const options = evaluatePairings(
				selected.map((id) => {
					const p = ready.find((row) => row.player_id === id)!;
					return {
						id,
						rating: Number(p.rating),
						sigma: Number(p.uncertainty),
						games: snapshot.fairness.find((row) => row.player_id === id)?.sets_played ?? 0
					};
				})
			);
			const pairing = options[0];
			const matchId = await rpc<string>('start_match', {
				p_session_id: sessionId,
				p_lease_id: null,
				p_team_a: pairing.teams[0],
				p_team_b: pairing.teams[1],
				p_rotation_recommendation_id: recommendationId
			});
			await rpc('save_pairing_recommendation', {
				p_match_id: matchId,
				p_recommended_team_a: pairing.teams[0],
				p_recommended_team_b: pairing.teams[1],
				p_diagnostics: {
					selected_algorithm: RATING_VERSION,
					recommended_gap: pairing.predictedGap,
					recommended_strengths: pairing.teamStrengths,
					pairings: options.map((p) => ({
						teams: p.teams,
						strengths: p.teamStrengths,
						gap: p.predictedGap,
						teamA_win_probability: p.teamAWinProbability
					}))
				}
			});
			await complete(1, scenario.scores[rotation][0]);
			let fillIn: string | null = null;
			if (rotation === 8) {
				const waiting = (await state()).presence.find(
					(p) => p.status === 'READY' && !selected.includes(p.player_id)
				);
				if (waiting) {
					await rpc('substitute_player', {
						p_session_id: sessionId,
						p_lease_id: null,
						p_outgoing_player_id: selected[0],
						p_replacement_player_id: waiting.player_id,
						p_outgoing_status: 'RESTING'
					});
					restorePlayer = selected[0];
					fillIn = waiting.player_id;
					actionLog.push({ action: 'SUBSTITUTE_SET_2', outgoing: selected[0], incoming: fillIn });
				}
			}
			await complete(2, scenario.scores[rotation][1]);
			turns.push({ rotation: rotation + 1, selected, fillIn });
			console.log(
				`Rotation ${rotation + 1}: ${selected.map((id) => snapshot.presence.find((p) => p.player_id === id)?.display_name ?? id).join(', ')}`
			);
			await notify();
			if (paceMs) await new Promise((resolve) => setTimeout(resolve, paceMs));
		}
		if (restorePlayer) await status(restorePlayer, 'READY');
		const final = await state();
		const players = [...ids].map(([label, id]) => ({
			label,
			id,
			...final.fairness.find((p) => p.player_id === id)
		}));
		const unmetPlayerIds = players
			.filter((p) => (p.rotations_played ?? 0) < scenario.settings.minimum)
			.map((p) => p.label);
		const violations = players
			.filter(
				(p) => (p.rotations_played ?? 0) !== turns.filter((t) => t.selected.includes(p.id)).length
			)
			.map((p) => `Database rotation count mismatch: ${p.label}`);
		const passed = unmetPlayerIds.length === 0 && violations.length === 0;
		if (passed && !leaveOpen) {
			await rpc('close_session', { p_session_id: sessionId, p_lease_id: null });
			await notify();
		}
		return {
			mode: 'database' as const,
			seed: scenario.settings.seed,
			sessionId,
			clubId: config.clubId,
			passed,
			players,
			turns,
			actionLog,
			unmetPlayerIds,
			violations,
			closed: passed && !leaveOpen,
			waitClock: 'real wall clock; virtual event schedule does not backdate READY timestamps'
		};
	} finally {
		await client.removeAllChannels();
	}
}
