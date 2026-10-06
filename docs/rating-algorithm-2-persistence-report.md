# Algorithm 2 Rating Persistence Report

## Connection and Compatibility

The linked remote `badminton-club` project is reachable. Phase 0 completed with nine legacy rating rows (1120–1280), legacy uncertainty values of 0.35–0.7, no rating history, 26 completed pre-era sets, and no malformed four-player completed lineups.

The frozen compatibility policy is implemented in the pending migration:

- preserve every existing numeric rating;
- convert every legacy uncertainty value to sigma 280;
- write one versioned `INITIALIZATION` anchor per current player;
- initialize later roster players and guests at 1200 / 280 with an anchor; and
- never retroactively rate the pre-era completed sets.

## Pending Migration

`supabase/migrations/20261006051207_algorithm_2_rating_persistence.sql` was applied to the linked remote project. It adds `algorithm_version` and `revision` to `player_ratings`, an explicit `sets.rating_algorithm_version` era marker, V1 initialization anchors, a partial unique `SET_RESULT` index, and trusted commit/replay RPCs.

The migration was first executed inside `BEGIN … ROLLBACK` against the linked remote database successfully, then applied with `npx supabase db push --linked`. Post-apply inspection found all nine legacy numeric values retained (1120–1280), all nine sigma values at 280, nine V1 current-state rows, nine V1 `INITIALIZATION` anchors, zero V1 `SET_RESULT` rows, and zero pre-era marked sets. Local `db diff` is unavailable because Docker/Podman is not installed.

## Authoritative Transaction Design

The browser sends score intent only to:

```text
POST /api/live/complete-set
```

The endpoint verifies the caller JWT and Club Admin role, reads authoritative active-set, actual `set_players`, rating state, and revisions using a server-only Supabase service client, and runs the canonical `applyRatingSet` TypeScript domain function.

It sends the proposed transition plus its exact locked-state snapshot to `commit_algorithm_2_completed_set`. That `service_role`-only PostgreSQL RPC locks the match, set, and four rating rows, verifies the actual lineup and revisions/rating values, completes the set, writes four `SET_RESULT` history records, advances current ratings/revisions, and performs the existing Set 2/match lifecycle in one transaction. A mismatch aborts all writes for server reload/recompute.

The browser has no execute grant for either this RPC or the legacy direct `complete_set` command after migration.

## Idempotency and Lineup Authority

The state transition requires an `IN_PROGRESS` set, and the unique partial index prevents more than one `SET_RESULT` per player/set/V1 version. Retrying after a successful request therefore cannot produce a second effect.

The server derives teams solely from the target set's four `set_players`; this preserves Set 2 substitutions and excludes the outgoing player. Recommendations are not consulted.

## Correction Replay

`POST /api/live/correct-set` runs a complete club-level V1 replay in trusted TypeScript. Its canonical order is:

1. `sessions.started_at`
2. `matches.sequence_number`
3. `sets.set_number`
4. `sets.id`

Only `sets.rating_algorithm_version = 'trueskill-style-bounded-margin-v1'` participate. This is the explicit era boundary: the 26 earlier completed sets remain null and cannot enter replay.

The server starts from `INITIALIZATION` anchors, replays all explicit V1 completed sets with the corrected score, and submits the replacement history projection to the guarded replay RPC. The RPC takes a club advisory transaction lock, locks all club rating rows, verifies revisions, updates the corrected score, replaces V1 `SET_RESULT` history, and updates final current states atomically. Manual adjustment is intentionally unsupported in V1; no manual adjustment UI or command exists.

## Security Boundary

`SUPABASE_SERVICE_ROLE_KEY` is read only through `$env/dynamic/private` in server code. It is never sent to the browser. The trusted RPCs are granted only to `service_role`; all browser table DML remains revoked. The server endpoint verifies the caller's JWT and Club Admin membership before using its privileged database client.

## Verification Performed

| Check                                                        | Result                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 linked remote data inspection                        | PASS                                                                                                                                                                                                                                                            |
| `supabase migration list --linked`                           | PASS; all local migrations through `20261006103627` match remote history                                                                                                                                                                                        |
| Migration transactional parse (`BEGIN`/`ROLLBACK`) on remote | PASS                                                                                                                                                                                                                                                            |
| `supabase db push --linked --dry-run`                        | PASS                                                                                                                                                                                                                                                            |
| `supabase db lint --linked` before pending migration         | PASS with only pre-existing unused legacy parameter warnings                                                                                                                                                                                                    |
| `npm run check`                                              | PASS                                                                                                                                                                                                                                                            |
| `npm run lint`                                               | PASS                                                                                                                                                                                                                                                            |
| Unit tests                                                   | PASS: 64 tests, including rating domain, replay oracle, and transition manifest coverage                                                                                                                                                                        |
| Remote migration application                                 | PASS                                                                                                                                                                                                                                                            |
| Remote DB rollback smoke                                     | PASS: first set, actual Set 2 substitution, retry protection, replay replacement, service-only execute grant                                                                                                                                                    |
| Local authenticated endpoint smoke                           | PASS: real Club Admin completed Set 1 (21–17), substituted a Set 2 player, and completed Set 2 (21–14) against linked remote DB                                                                                                                                 |
| Endpoint substitution verification                           | PASS: original player had 1 rated set; replacement had 1; the other actual players had 2                                                                                                                                                                        |
| Endpoint fixture cleanup                                     | PASS: all `RATING-ENDPOINT-*` players/history/session fixtures removed                                                                                                                                                                                          |
| Database ↔ TypeScript four-set correction oracle             | PASS: four endpoint-completed sets, Set 2 corrected 18–21 → 21–18; all 4 current ratings/sigmas and all 16 `SET_RESULT` transitions matched canonical `applyRatingSet` at `< 1e-12`                                                                             |
| Real endpoint retry                                          | PASS: retry of the same set ID returned no second effect; score/status, 4 ratings, 4 sigmas, 4 revisions, and 4 `SET_RESULT` rows were byte-for-byte unchanged                                                                                                  |
| Fixture cleanup                                              | PASS: `ALGO2-PERSISTENCE-*` players, sessions, matches, sets, set players, rating history, and temporary Auth admin removed                                                                                                                                     |
| `ALGO2-LIVE-*` remote integration                            | PASS: alternative pairing persisted as audit vs actual lineup, Set 1 completion, Set 2 substitution/completion, older-score correction, exactly 8 rebuilt actual-lineup transitions, public rating read, and next match started from post-replay rating pairing |
| `ALGO2-LIVE-*` cleanup                                       | PASS: zero fixture players, sessions, matches, sets, pairing audit rows, or rating history; temporary Auth admin removed                                                                                                                                        |
| Latest complete `npm run verify`                             | PASS: 64 unit tests, 17 Playwright E2E tests, lint, Svelte check, and production build                                                                                                                                                                          |
| Latest `supabase db lint --linked`                           | BLOCKED: linked CLI SQL login rejected credentials (`FATAL: password authentication failed for user cli_login_postgres`); requires `SUPABASE_DB_PASSWORD`                                                                                                       |

## Operational Note

The endpoint requires the client-observed `setId`, and rejects a retry once that set is no longer active. This prevents an identical delayed request from being applied to the newly-created Set 2. `supabase db lint --linked` is the only attempted verification unavailable due to missing/invalid direct database-password credentials; it does not affect the passing migration-history check or the executed remote database tests.

RATING PERSISTENCE GATE: PASS
