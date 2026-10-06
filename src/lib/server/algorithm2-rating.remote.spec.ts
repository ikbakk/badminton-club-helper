import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import {
	applyRatingSet,
	evaluatePairings,
	RATING_VERSION,
	type CompletedSet,
	type RatingState
} from '$lib/domain/rating';

const epsilon = 1e-12;
const environment = loadEnv('test', process.cwd(), '');
const runRemote = process.env.RUN_REMOTE_RATING_TESTS === 'true';
const url = environment.PUBLIC_SUPABASE_URL;
const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY;
const service = createClient(url, serviceKey, {
	auth: { persistSession: false, autoRefreshToken: false }
});
const prefix = 'ALGO2-PERSISTENCE-';
const baseUrl = process.env.REMOTE_RATING_TEST_BASE_URL ?? 'http://127.0.0.1:5199';
const password = `A2-${randomUUID()}-secure`;
const email = `algo2-persistence-${randomUUID()}@example.test`;
const clubId = randomUUID();
const playerIds = ['a', 'b', 'c', 'd'].map(() => randomUUID());
let adminId = '';
let token = '';

type History = {
	player_id: string;
	set_id: string;
	rating_before: number | string;
	rating_after: number | string;
	uncertainty_before: number | string;
	uncertainty_after: number | string;
	algorithm_version: string;
};

const asNumber = (value: number | string) => Number(value);
const closeTo = (actual: number | string, expected: number) =>
	expect(Math.abs(asNumber(actual) - expected)).toBeLessThan(epsilon);
const endpoint = async (path: string, body: object) =>
	fetch(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

function sql(statement: string) {
	try {
		execFileSync('npx', ['supabase', 'db', 'query', '--linked', '--yes', statement], {
			cwd: process.cwd(),
			stdio: 'pipe'
		});
	} catch (error) {
		const detail =
			error && typeof error === 'object'
				? JSON.stringify(error, Object.getOwnPropertyNames(error))
				: String(error);
		throw new Error(`Linked SQL failed: ${detail}`, { cause: error });
	}
}

function query<T>(statement: string): T[] {
	const output = execFileSync(
		'npx',
		['supabase', 'db', 'query', '--linked', '--yes', '--output-format', 'json', statement],
		{
			cwd: process.cwd(),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		}
	);
	return (JSON.parse(output) as { rows: T[] }).rows;
}

async function setup() {
	const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
	if (created.error || !created.data.user)
		throw new Error(created.error?.message ?? 'Could not create fixture admin');
	adminId = created.data.user.id;
	sql(`insert into public.clubs(id,name) values ('${clubId}','${prefix}${clubId}');
insert into public.club_roles(club_id,user_id,role) values ('${clubId}','${adminId}','CLUB_ADMIN');
insert into public.players(id,club_id,display_name,membership_type) values ${playerIds.map((id, index) => `('${id}','${clubId}','${prefix}${String.fromCharCode(65 + index)}','MEMBER')`).join(',')};
insert into public.player_ratings(player_id,rating,uncertainty,algorithm_version,revision) values ${playerIds.map((id) => `('${id}',1200,280,'${RATING_VERSION}',0)`).join(',')};
insert into public.player_rating_history(player_id,source,rating_before,rating_after,uncertainty_before,uncertainty_after,algorithm_version) values ${playerIds.map((id) => `('${id}','INITIALIZATION',1200,1200,280,280,'${RATING_VERSION}')`).join(',')};`);
	const signIn = await service.auth.signInWithPassword({ email, password });
	if (signIn.error || !signIn.data.session)
		throw new Error(signIn.error?.message ?? 'Could not sign in fixture admin');
	token = signIn.data.session.access_token;
}

async function createMatch(
	startedAt: string,
	sequence: number,
	lineup: [number, number, number, number]
) {
	const sessionId = randomUUID();
	const matchId = randomUUID();
	const setId = randomUUID();
	sql(`insert into public.sessions(id,club_id,status,started_at) values ('${sessionId}','${clubId}','LIVE','${startedAt}');
insert into public.session_participants(session_id,player_id,status) values ${playerIds.map((id) => `('${sessionId}','${id}','PLAYING')`).join(',')};
insert into public.matches(id,session_id,sequence_number,status,started_at) values ('${matchId}','${sessionId}',${sequence},'IN_PROGRESS','${startedAt}');
insert into public.sets(id,match_id,set_number,status,started_at) values ('${setId}','${matchId}',1,'IN_PROGRESS','${startedAt}');
insert into public.set_players(set_id,player_id,team) values ${lineup.map((index, position) => `('${setId}','${playerIds[index]}','${position < 2 ? 'A' : 'B'}')`).join(',')};`);
	return { sessionId, matchId, setId };
}

async function activeSet(matchId: string) {
	const sets = query<{ id: string }>(
		`select id from public.sets where match_id='${matchId}' and status='IN_PROGRESS';`
	);
	if (sets.length !== 1)
		throw new Error(`Expected one generated second set: ${JSON.stringify(sets)}`);
	return sets[0];
}

async function replaceLineup(setId: string, lineup: [number, number, number, number]) {
	sql(`delete from public.set_players where set_id='${setId}';
insert into public.set_players(set_id,player_id,team) values ${lineup.map((index, position) => `('${setId}','${playerIds[index]}','${position < 2 ? 'A' : 'B'}')`).join(',')};`);
}

async function complete(
	sessionId: string,
	setId: string,
	scoreA: number,
	scoreB: number,
	result: 'SET_2' | 'MATCH_COMPLETED'
) {
	const response = await endpoint('/api/live/complete-set', {
		sessionId,
		clubId,
		setId,
		teamAScore: scoreA,
		teamBScore: scoreB
	});
	const text = await response.text();
	expect(response.ok, text).toBe(true);
	expect(text).toContain(`"result":"${result}"`);
}

async function history(): Promise<History[]> {
	return query<History>(
		`select player_id,set_id,rating_before,rating_after,uncertainty_before,uncertainty_after,algorithm_version from public.player_rating_history where source='SET_RESULT' and player_id in (${playerIds.map((id) => `'${id}'`).join(',')});`
	);
}

async function authenticatedRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
	const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
		method: 'POST',
		headers: {
			apikey: environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
	const text = await response.text();
	if (!response.ok) throw new Error(`${name} failed (${response.status}): ${text}`);
	return text ? (JSON.parse(text) as T) : (undefined as T);
}

describe.skipIf(!runRemote)('Algorithm 2 remote persistence proofs', () => {
	it('DATABASE ↔ TYPESCRIPT ORACLE: PASS', async () => {
		await setup();
		const one = await createMatch('2026-01-01T00:00:00.000Z', 1, [0, 1, 2, 3]);
		await complete(one.sessionId, one.setId, 21, 17, 'SET_2');
		const oneSet2 = await activeSet(one.matchId);
		await replaceLineup(oneSet2.id, [0, 2, 1, 3]);
		await complete(one.sessionId, oneSet2.id, 18, 21, 'MATCH_COMPLETED');
		sql(`update public.sessions set status='CLOSED' where id='${one.sessionId}';`);

		const two = await createMatch('2026-01-02T00:00:00.000Z', 1, [0, 3, 1, 2]);
		await complete(two.sessionId, two.setId, 21, 15, 'SET_2');
		const twoSet2 = await activeSet(two.matchId);
		await replaceLineup(twoSet2.id, [0, 1, 2, 3]);
		await complete(two.sessionId, twoSet2.id, 19, 21, 'MATCH_COMPLETED');
		sql(`update public.sessions set status='CLOSED' where id='${two.sessionId}';`);

		const correction = await endpoint('/api/live/correct-set', {
			clubId,
			setId: oneSet2.id,
			teamAScore: 21,
			teamBScore: 18
		});
		expect(correction.ok, await correction.text()).toBe(true);
		const timeline: Array<CompletedSet & { id: string }> = [
			{
				id: one.setId,
				teamA: [playerIds[0], playerIds[1]],
				teamB: [playerIds[2], playerIds[3]],
				scoreA: 21,
				scoreB: 17
			},
			{
				id: oneSet2.id,
				teamA: [playerIds[0], playerIds[2]],
				teamB: [playerIds[1], playerIds[3]],
				scoreA: 21,
				scoreB: 18
			},
			{
				id: two.setId,
				teamA: [playerIds[0], playerIds[3]],
				teamB: [playerIds[1], playerIds[2]],
				scoreA: 21,
				scoreB: 15
			},
			{
				id: twoSet2.id,
				teamA: [playerIds[0], playerIds[1]],
				teamB: [playerIds[2], playerIds[3]],
				scoreA: 19,
				scoreB: 21
			}
		];
		let states: RatingState[] = playerIds.map((id) => ({ id, rating: 1200, sigma: 280, games: 0 }));
		const expectedHistory: History[] = [];
		for (const set of timeline) {
			const before = new Map(states.map((state) => [state.id, state]));
			states = applyRatingSet(RATING_VERSION, states, set).ratings;
			for (const player_id of [...set.teamA, ...set.teamB]) {
				const previous = before.get(player_id)!;
				const next = states.find((state) => state.id === player_id)!;
				expectedHistory.push({
					player_id,
					set_id: set.id,
					rating_before: previous.rating,
					rating_after: next.rating,
					uncertainty_before: previous.sigma,
					uncertainty_after: next.sigma,
					algorithm_version: RATING_VERSION
				});
			}
		}
		const ratings = query<{
			player_id: string;
			rating: number | string;
			uncertainty: number | string;
			algorithm_version: string;
		}>(
			`select player_id,rating,uncertainty,algorithm_version from public.player_ratings where player_id in (${playerIds.map((id) => `'${id}'`).join(',')});`
		);
		for (const expected of states) {
			const actual = ratings.find((row) => row.player_id === expected.id)!;
			closeTo(actual.rating, expected.rating);
			closeTo(actual.uncertainty, expected.sigma);
			expect(actual.algorithm_version).toBe(RATING_VERSION);
		}
		const actualHistory = await history();
		expect(actualHistory).toHaveLength(expectedHistory.length);
		for (const expected of expectedHistory) {
			const actual = actualHistory.find(
				(row) => row.player_id === expected.player_id && row.set_id === expected.set_id
			)!;
			expect(actual).toBeTruthy();
			closeTo(actual.rating_before, asNumber(expected.rating_before));
			closeTo(actual.rating_after, asNumber(expected.rating_after));
			closeTo(actual.uncertainty_before, asNumber(expected.uncertainty_before));
			closeTo(actual.uncertainty_after, asNumber(expected.uncertainty_after));
			expect(actual.algorithm_version).toBe(RATING_VERSION);
		}
	}, 240_000);

	it('REAL ENDPOINT RETRY: PASS', async () => {
		const retry = await createMatch('2026-01-03T00:00:00.000Z', 1, [0, 1, 2, 3]);
		await complete(retry.sessionId, retry.setId, 21, 16, 'SET_2');
		const snapshot = async () => ({
			set: query(
				`select status,team_a_score,team_b_score from public.sets where id='${retry.setId}';`
			)[0],
			ratings: query(
				`select player_id,rating,uncertainty,revision from public.player_ratings where player_id in (${playerIds.map((id) => `'${id}'`).join(',')}) order by player_id;`
			),
			history: (await history())
				.filter((row) => row.set_id === retry.setId)
				.sort((a, b) => a.player_id.localeCompare(b.player_id))
		});
		const before = await snapshot();
		const response = await endpoint('/api/live/complete-set', {
			sessionId: retry.sessionId,
			clubId,
			setId: retry.setId,
			teamAScore: 21,
			teamBScore: 16
		});
		expect([200, 409]).toContain(response.status);
		expect(await snapshot()).toEqual(before);
		sql(`update public.sessions set status='CLOSED' where id='${retry.sessionId}';`);
	}, 120_000);

	it('ALGO2-LIVE pairing audit, override, correction, authoritative read, and cleanup smoke', async () => {
		if (!adminId) await setup();
		const livePrefix = 'ALGO2-LIVE-';
		const livePlayers = ['a', 'b', 'c', 'd', 'e'].map(() => randomUUID());
		const sessionId = randomUUID();
		const liveNames = livePlayers.map((_, i) => `${livePrefix}${String.fromCharCode(65 + i)}`);
		sql(
			`insert into public.players(id,club_id,display_name,membership_type) values ${livePlayers.map((id, i) => `('${id}','${clubId}','${liveNames[i]}','MEMBER')`).join(',')};`
		);
		sql(
			`insert into public.player_ratings(player_id,rating,uncertainty,algorithm_version,revision) values ('${livePlayers[0]}',1400,280,'${RATING_VERSION}',0),('${livePlayers[1]}',1200,280,'${RATING_VERSION}',0),('${livePlayers[2]}',1200,280,'${RATING_VERSION}',0),('${livePlayers[3]}',1000,280,'${RATING_VERSION}',0),('${livePlayers[4]}',1200,280,'${RATING_VERSION}',0);`
		);
		sql(
			`insert into public.player_rating_history(player_id,source,rating_before,rating_after,uncertainty_before,uncertainty_after,algorithm_version) select player_id,'INITIALIZATION',rating,rating,uncertainty,uncertainty,algorithm_version from public.player_ratings where player_id in (${livePlayers.map((id) => `'${id}'`).join(',')});`
		);
		sql(
			`insert into public.sessions(id,club_id,status) values ('${sessionId}','${clubId}','LIVE');`
		);
		sql(
			`insert into public.session_participants(session_id,player_id,status) values ${livePlayers.map((id) => `('${sessionId}','${id}','READY')`).join(',')};`
		);
		const recommendedA = [livePlayers[0], livePlayers[3]];
		const recommendedB = [livePlayers[1], livePlayers[2]];
		const actualA = [livePlayers[0], livePlayers[1]];
		const actualB = [livePlayers[2], livePlayers[3]];
		const matchId = await authenticatedRpc<string>('start_match', {
			p_session_id: sessionId,
			p_lease_id: null,
			p_team_a: actualA,
			p_team_b: actualB,
			p_rotation_recommendation_id: null
		});
		const pairingId = await authenticatedRpc<string>('save_pairing_recommendation', {
			p_match_id: matchId,
			p_recommended_team_a: recommendedA,
			p_recommended_team_b: recommendedB,
			p_diagnostics: {
				selected_algorithm: RATING_VERSION,
				recommended_gap: 0,
				recommended_strengths: [1200, 1200],
				pairings: [
					{ teams: [recommendedA, recommendedB], strengths: [1200, 1200], gap: 0 },
					{
						teams: [
							[livePlayers[0], livePlayers[1]],
							[livePlayers[2], livePlayers[3]]
						],
						strengths: [1300, 1100],
						gap: 200
					},
					{
						teams: [
							[livePlayers[0], livePlayers[2]],
							[livePlayers[1], livePlayers[3]]
						],
						strengths: [1300, 1100],
						gap: 200
					}
				]
			}
		});
		const audit = query<{ algorithm_version: string; diagnostics: { pairings: unknown[] } }>(
			`select algorithm_version,diagnostics from public.pairing_recommendations where id='${pairingId}';`
		)[0];
		expect(audit.algorithm_version).toBe(RATING_VERSION);
		expect(audit.diagnostics.pairings).toHaveLength(3);
		const snapshots = query<{
			player_id: string;
			recommended_team: string;
			rating_snapshot: number;
			uncertainty_snapshot: number;
		}>(
			`select player_id,recommended_team,rating_snapshot,uncertainty_snapshot from public.pairing_recommendation_players where recommendation_id='${pairingId}';`
		);
		expect(snapshots).toHaveLength(4);
		const firstSnapshot = snapshots.find((row) => row.player_id === livePlayers[0])!;
		expect(firstSnapshot.recommended_team).toBe('A');
		closeTo(firstSnapshot.rating_snapshot, 1400);
		closeTo(firstSnapshot.uncertainty_snapshot, 280);
		const set = query<{ id: string }>(
			`select id from public.sets where match_id='${matchId}' and set_number=1;`
		)[0];
		const actual = query<{ player_id: string; team: string }>(
			`select player_id,team from public.set_players where set_id='${set.id}' order by team,player_id;`
		);
		expect(actual.map((row) => [row.player_id, row.team])).toEqual(
			[
				[livePlayers[0], 'A'],
				[livePlayers[1], 'A'],
				[livePlayers[2], 'B'],
				[livePlayers[3], 'B']
			].sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]))
		);
		await complete(sessionId, set.id, 21, 17, 'SET_2');
		const setTwo = query<{ id: string }>(
			`select id from public.sets where match_id='${matchId}' and set_number=2 and status='IN_PROGRESS';`
		)[0];
		await authenticatedRpc('substitute_player', {
			p_session_id: sessionId,
			p_lease_id: null,
			p_outgoing_player_id: livePlayers[1],
			p_replacement_player_id: livePlayers[4],
			p_outgoing_status: 'RESTING'
		});
		const substitutedLineup = query<{ player_id: string; team: string }>(
			`select player_id,team from public.set_players where set_id='${setTwo.id}';`
		);
		expect(substitutedLineup.map((row) => row.player_id).sort()).toEqual(
			[livePlayers[0], livePlayers[2], livePlayers[3], livePlayers[4]].sort()
		);
		expect(substitutedLineup.map((row) => row.player_id)).not.toContain(livePlayers[1]);
		await complete(sessionId, setTwo.id, 18, 21, 'MATCH_COMPLETED');
		const beforeCorrection = query<{ player_id: string; rating: number }>(
			`select player_id,rating from public.player_ratings where player_id in (${livePlayers.map((id) => `'${id}'`).join(',')});`
		);
		const correction = await endpoint('/api/live/correct-set', {
			clubId,
			setId: set.id,
			teamAScore: 21,
			teamBScore: 18
		});
		expect(correction.ok, await correction.text()).toBe(true);
		const replayHistory = query<{ set_id: string; player_id: string }>(
			`select set_id,player_id from public.player_rating_history where source='SET_RESULT' and player_id in (${livePlayers.map((id) => `'${id}'`).join(',')});`
		);
		expect(replayHistory).toHaveLength(8);
		for (const id of [livePlayers[0], livePlayers[1], livePlayers[2], livePlayers[3]])
			expect(replayHistory.some((row) => row.set_id === set.id && row.player_id === id)).toBe(true);
		for (const id of [livePlayers[0], livePlayers[2], livePlayers[3], livePlayers[4]])
			expect(replayHistory.some((row) => row.set_id === setTwo.id && row.player_id === id)).toBe(
				true
			);
		const afterCorrection = query<{ player_id: string; rating: number; uncertainty: number }>(
			`select player_id,rating,uncertainty from public.player_ratings where player_id in (${livePlayers.map((id) => `'${id}'`).join(',')});`
		);
		expect(
			afterCorrection.some(
				(row) =>
					row.rating !==
					beforeCorrection.find((before) => before.player_id === row.player_id)?.rating
			)
		).toBe(true);
		const publicRating = await fetch(`${url}/rest/v1/rpc/public_player_rating`, {
			method: 'POST',
			headers: {
				apikey: environment.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ p_player_id: livePlayers[0] })
		});
		expect(publicRating.ok).toBe(true);
		const publicRows = (await publicRating.json()) as Array<{
			rating: number;
			uncertainty: number;
		}>;
		closeTo(
			publicRows[0].rating,
			Number(afterCorrection.find((row) => row.player_id === livePlayers[0])!.rating)
		);
		const nextIds: string[] = [livePlayers[0], livePlayers[2], livePlayers[3], livePlayers[4]];
		const nextStates = afterCorrection
			.filter((row) => nextIds.includes(row.player_id))
			.map((row) => ({
				id: row.player_id,
				rating: Number(row.rating),
				sigma: Number(row.uncertainty),
				games: 1
			}));
		const nextPairing = evaluatePairings(nextStates);
		expect(nextPairing).toHaveLength(3);
		expect(nextPairing[0].predictedGap).toBeLessThanOrEqual(nextPairing[1].predictedGap);
		const nextMatchId = await authenticatedRpc<string>('start_match', {
			p_session_id: sessionId,
			p_lease_id: null,
			p_team_a: nextPairing[0].teams[0],
			p_team_b: nextPairing[0].teams[1],
			p_rotation_recommendation_id: null
		});
		const nextAuditId = await authenticatedRpc<string>('save_pairing_recommendation', {
			p_match_id: nextMatchId,
			p_recommended_team_a: nextPairing[0].teams[0],
			p_recommended_team_b: nextPairing[0].teams[1],
			p_diagnostics: {
				selected_algorithm: RATING_VERSION,
				recommended_gap: nextPairing[0].predictedGap,
				recommended_strengths: nextPairing[0].teamStrengths,
				pairings: nextPairing.map((option) => ({
					teams: option.teams,
					strengths: option.teamStrengths,
					gap: option.predictedGap,
					teamAWinProbability: option.teamAWinProbability
				}))
			}
		});
		const nextSnapshots = query<{ player_id: string; rating_snapshot: number | string }>(
			`select player_id,rating_snapshot from public.pairing_recommendation_players where recommendation_id='${nextAuditId}';`
		);
		expect(nextSnapshots).toHaveLength(4);
		for (const state of nextStates)
			closeTo(
				nextSnapshots.find((snapshot) => snapshot.player_id === state.id)!.rating_snapshot,
				state.rating
			);
		const nextSet = query<{ id: string }>(
			`select id from public.sets where match_id='${nextMatchId}' and set_number=1;`
		)[0];
		const nextActualIds = query<{ player_id: string }>(
			`select player_id from public.set_players where set_id='${nextSet.id}';`
		)
			.map((row) => row.player_id)
			.sort();
		expect(nextActualIds).toEqual(nextPairing[0].teams.flat().sort());
		sql(`delete from public.player_rating_history where player_id in (${livePlayers.map((id) => `'${id}'`).join(',')});
delete from public.sessions where id='${sessionId}';
delete from public.players where id in (${livePlayers.map((id) => `'${id}'`).join(',')});
		do $$ begin
 if exists(select 1 from public.players where display_name like '${livePrefix}%')
 or exists(select 1 from public.pairing_recommendation_players rp join public.pairing_recommendations r on r.id=rp.recommendation_id join public.matches m on m.id=r.match_id join public.sessions s on s.id=m.session_id where s.club_id='${clubId}')
 or exists(select 1 from public.player_rating_history h join public.players p on p.id=h.player_id where p.display_name like '${livePrefix}%') then
   raise exception 'ALGO2-LIVE cleanup failed';
 end if;
end $$;`);
	}, 240_000);
});

afterAll(async () => {
	if (!runRemote || !adminId) return;
	sql(`delete from public.player_rating_history where player_id in (select id from public.players where club_id='${clubId}');
delete from public.sessions where club_id='${clubId}';
delete from public.clubs where id='${clubId}';`);
	await service.auth.admin.deleteUser(adminId);
	sql(`do $$ begin
 if exists(select 1 from public.players where display_name like '${prefix}%')
 or exists(select 1 from public.sessions where club_id='${clubId}')
 or exists(select 1 from public.player_rating_history where player_id in (${playerIds.map((id) => `'${id}'`).join(',')})) then
   raise exception 'Algorithm 2 fixture cleanup failed';
 end if;
end $$;`);
}, 120_000);
