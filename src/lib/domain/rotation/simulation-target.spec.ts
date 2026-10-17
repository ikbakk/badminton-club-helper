import { expect, it } from 'vitest';
import { validateSimulationTarget } from '../../../../scripts/session-database';
it('permits an explicitly marked admin test club containing only synthetic players', () => {
	expect(
		validateSimulationTarget(
			{ name: '[SIM] Rotation Test', is_club_admin: true },
			[{ display_name: '[SIM] Player 01' }],
			false
		)
	).toBeUndefined();
});
it('refuses a real club, foreign roster, missing authority and a pre-existing live session', () => {
	expect(() =>
		validateSimulationTarget({ name: 'PB NEWBIE', is_club_admin: true }, [], false)
	).toThrow(/\[SIM\]/);
	expect(() =>
		validateSimulationTarget(
			{ name: '[SIM] Test', is_club_admin: true },
			[{ display_name: 'Ayu' }],
			false
		)
	).toThrow(/synthetic/);
	expect(() =>
		validateSimulationTarget({ name: '[SIM] Test', is_club_admin: false }, [], false)
	).toThrow(/admin/i);
	expect(() =>
		validateSimulationTarget({ name: '[SIM] Test', is_club_admin: true }, [], true)
	).toThrow(/live session/i);
});

import { readDatabaseConfig } from '../../../../scripts/session-database';
it('database execution is opt-in and refuses insecure remote app origins', () => {
	expect(() => readDatabaseConfig({})).toThrow(/SIM_ALLOW_DATABASE_WRITES/);
	const env = {
		SIM_ALLOW_DATABASE_WRITES: 'true',
		PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
		PUBLIC_SUPABASE_ANON_KEY: 'test-key',
		SIM_APP_URL: 'http://remote.example',
		SIM_CLUB_ID: 'test-club',
		SIM_ADMIN_EMAIL: 'test@example.com',
		SIM_ADMIN_PASSWORD: 'test-password'
	};
	expect(() => readDatabaseConfig(env)).toThrow(/HTTPS/);
	expect(readDatabaseConfig({ ...env, SIM_APP_URL: 'http://localhost:5173' }).clubId).toBe(
		'test-club'
	);
});
