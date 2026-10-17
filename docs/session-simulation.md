# Random session simulation

Requires Node 24 and the normal `npm ci` dependencies. No extra package or migration is needed for this script.

## Offline: fast, seeded rotation checks

```sh
npm run simulate:session -- --players 12 --min-rotations 3 --seed 42
npm run simulate:session -- --players 14 --seed 2026 --out simulation-results/seed2026.json
```

Omit `--seed` to choose a random seed; the console prints it for replay. The exact same options and seed reproduce the offline action schedule and selections. JSON reports are ignored by git. `--out` refuses to overwrite an existing file.

The preset varies arrivals, short match durations and scores, includes temporary RESTING/AWAY periods, and schedules one Set 2 fill-in when the run is long enough. Everyone eventually returns: it deliberately does not send players home before their three-start target. Four players are available at the start, so play can begin normally.

It uses the existing production Smart Rotation function and debt-4/READY-45 policy without tuning either algorithm. The existing deterministic session simulator handles virtual time and opportunity history. An independent audit checks distinct selections, READY eligibility, avoidable third consecutive starts, rotation counts, opportunity counts and debt. Legal consecutive fallbacks caused by too few READY alternatives are reported separately.

The session stops as soon as every player has at least three rotation **starts**, rather than forcing selections to manufacture that result. Some players may reach four or more. A fill-in is an additional set, not a rotation start; a player replaced after Set 1 can therefore have fewer than six sets despite three starts. The report shows both counts.

`--max-rotations` imposes a hard cap (default players × minimum × 4). Unmet targets or audit violations exit nonzero and list affected players. Example failure:

```sh
npm run simulate:session -- --players 12 --seed 42 --max-rotations 2
```

Default virtual matches average two minutes. Increase `--match-minutes 12` to exercise waiting-time weighting and thresholds. These short synthetic sessions test mechanics, not whether real people perceive rotation and pairing as fair.

## Connected: run normal app commands later on your device

Use a local Supabase database or a dedicated staging project, plus a running instance of this repository configured for that same database. Apply its migrations first and configure the app's server-only service-role key in the app's ordinary `.env`. The simulation runner itself only uses the public key and a dedicated test admin's email/password.

1. Sign up/sign in with a dedicated test admin and create a club named `[SIM] Rotation Test`. Do not rename PB NEWBIE for this. An account with an existing club needs a separate test account.
2. Copy the club UUID from `/clubs/<uuid>/live`. The test club must have no live session; its active roster must be empty or contain only `[SIM] `-prefixed synthetic players.
3. Prepare a git-ignored simulation environment file:

   ```sh
   cp scripts/simulation.env.example .env.simulation
   ```

4. Fill in the local/staging URL, public key, app origin, club UUID and dedicated test admin credentials. Change `SIM_ALLOW_DATABASE_WRITES` to `true`. Start the app separately with `npm run dev`.
5. Run:

   ```sh
   npm run simulate:session -- --database --players 12 --seed 42 --pace-ms 1000 --out simulation-results/database-seed42.json
   ```

Connected mode creates/reuses synthetic roster players, starts one session, checks in arrivals, changes READY/RESTING/AWAY statuses, saves actual recommendations, balances teams, records both sets through `/api/live/complete-set`, performs a Set 2 substitution, and verifies persisted rotation counters. No direct table inserts, rating writes, manual clock changes, fees or payment records are used. Normal Club Admin authorization and trusted rating endpoints remain in force.

All target checks run before database writes. This mode refuses an unmarked club, an active roster containing real-player names or an existing live session. It never deletes records. The app must point to the same Supabase project as `.env.simulation`; a mismatched server configuration will fail set completion.

A successful run closes the session for History inspection. Add `--leave-open` to keep it live. On failure or interruption, use the printed session ID to inspect and finish the synthetic session in the app; partial records remain, and the runner refuses to start another session on top of it. Writes are not automatically retried because a timeout can have an uncertain outcome.

The seed fixes scheduled actions and scores, but database UUID tie-breakers, existing synthetic ratings, actual timestamps and server latency can change connected selections. It always recomputes each recommendation from the database's current READY/fairness state; it does not blindly replay offline player choices.

Connected mode uses real READY timestamps. Compressing the run does not test a real 45-minute wait. `--match-minutes` affects virtual action scheduling only in this mode; `--pace-ms` adds real pauses and broadcasts/polling let an open Live view observe changes. Choose a longer pace if you want to watch every rotation. A connected run has not been performed in ChatGPT; you supply its environment later.

## Useful checks after a connected run

- Every synthetic player has at least three rotation starts in the report and session evaluation.
- RESTING/AWAY players are not chosen; late arrivals eventually receive turns.
- A third consecutive start occurs only when fewer than four rested READY alternatives exist.
- The substituted player's actual Set 2 lineup, set totals and ratings match the completed set.
- Session history/evaluation matches the recorded action log. No fees/payments were generated.

Simulation results supplement the 3–5 real-session validation phase in `real-session-validation.md`; they do not replace it or authorize algorithm tuning.
