import { parseArgs } from 'node:util';
import { randomInt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
	options: {
		players: { type: 'string', default: '12' },
		'min-rotations': { type: 'string', default: '3' },
		seed: { type: 'string' },
		'max-rotations': { type: 'string' },
		'match-minutes': { type: 'string', default: '2' },
		database: { type: 'boolean', default: false },
		'pace-ms': { type: 'string', default: '0' },
		'leave-open': { type: 'boolean', default: false },
		out: { type: 'string' },
		help: { type: 'boolean', default: false }
	}
});
if (values.help) {
	console.log(`npm run simulate:session -- [options]
 --players 12           Synthetic players (4–40)
 --min-rotations 3      Full rotation starts required per player (3–30)
 --seed 42              Replay a seed; omitted = random seed printed in report
 --max-rotations 144    Hard cap; unmet target exits nonzero
 --match-minutes 2      Offline virtual match duration, randomized ±50%
 --out path.json       Save a secret-free action/metrics report (new file)
 --database            Execute normal commands in a dedicated [SIM] club
 --pace-ms 1000        Optional real pause between database matches
 --leave-open          Leave the completed database simulation session live

Database mode loads .env.simulation. See docs/session-simulation.md.`);
} else {
	const server = await createServer({
		root,
		configFile: false,
		appType: 'custom',
		logLevel: 'error',
		server: { middlewareMode: true }
	});
	try {
		const { simulateRandomSession } = await server.ssrLoadModule('/scripts/session-simulation.ts');
		const seed = values.seed === undefined ? randomInt(0, 0x100000000) : Number(values.seed);
		const settings = {
			seed,
			players: Number(values.players),
			minimum: Number(values['min-rotations']),
			maxRotations:
				values['max-rotations'] === undefined ? undefined : Number(values['max-rotations']),
			matchMinutes: Number(values['match-minutes'])
		};
		const pace = Number(values['pace-ms']);
		if (!Number.isInteger(pace) || pace < 0 || pace > 60000)
			throw new Error('Pace must be 0–60000 milliseconds.');
		const offline = simulateRandomSession(settings);
		const report = values.database
			? await (
					await server.ssrLoadModule('/scripts/session-database.ts')
				).runDatabaseSession(offline.scenario, process.env, pace, values['leave-open'])
			: offline;
		console.log(
			`\n${report.passed ? 'PASS' : 'FAIL'} | ${report.mode} | seed ${seed} | minimum ${settings.minimum} full rotations/player`
		);
		if (report.mode === 'offline') {
			for (const turn of report.result.selections)
				console.log(
					`R${turn.rotation + 1}: ${turn.actual.join(', ')}${turn.fillIns.length ? ` | Set 2 fill-in: ${turn.fillIns.join(', ')}` : ''}`
				);
			console.table(
				report.result.players.map((p) => ({
					player: p.playerId,
					rotations: p.rotationsPlayed,
					sets: p.setsPlayed,
					fillIns: p.fillInSets,
					opportunities: p.eligibleOpportunities,
					debt: p.currentOpportunityDebt,
					maxReadyWaitMinutes: +(p.maximumContinuousReadyWaitMs / 60000).toFixed(2)
				}))
			);
			console.log(
				`Virtual duration: ${report.virtualMinutes.toFixed(2)} minutes. Rotation spread: ${report.result.metrics.selectionSpread}.`
			);
			if (report.fallbackRotations.length)
				console.log(
					`Limited-READY consecutive fallback at rotations: ${report.fallbackRotations.join(', ')}.`
				);
		} else
			console.table(
				report.players.map((p) => ({
					player: p.label,
					rotations: p.rotations_played ?? 0,
					sets: p.sets_played ?? 0,
					debt: p.current_opportunity_debt ?? 0
				}))
			);
		if (!report.passed)
			console.error(
				`Unmet: ${report.unmetPlayerIds.join(', ')}. Violations: ${report.violations.join('; ') || 'none'}`
			);
		if (values.out) {
			const destination = resolve(values.out);
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
			console.log(`Report: ${destination}`);
		}
		process.exitCode = report.passed ? 0 : 1;
	} catch (error) {
		console.error(
			`Simulation stopped: ${error instanceof Error ? error.message : 'unknown error'}`
		);
		process.exitCode = 1;
	} finally {
		await server.close();
	}
}
