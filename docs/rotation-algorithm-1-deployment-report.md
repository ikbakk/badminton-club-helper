# Algorithm 1 Smart Rotation — Deployment Verification

## Environment

- Supabase CLI 2.119.0; linked remote project: `badminton-club` (Postgres 17.6, healthy).
- The root app `.env` URL matches this linked project. No secrets are included here.
- This was a real remote database, not local Supabase. Docker/Podman and `psql` are unavailable, and the repository has no `supabase/config.toml`; therefore a local clean reset could not be run.
- Pre-migration baseline: 17 sessions, 118 session participants, 0 LIVE sessions, 0 completed tied/missing-score sets, and 1 legacy `FINANCE_ADMIN` role row. The role row was removed by the already-pending finance-authority migration, consistent with the requested Club-Admin-only authority model.

## Migration Result

`npx supabase db push --linked` applied successfully, in order:

1. `20261004152042_deduplicate_public_session_matches.sql`
2. `20261004163710_club_admin_finance_access.sql`
3. `20261005120000_authorization_integrity_hardening.sql`
4. `20261005130000_smart_rotation_fairness.sql`
5. `20261005140000_drop_revoked_operator_lease_rpcs.sql` (follow-up cleanup after remote lint found a revoked PIN RPC still referencing the dropped credential table)

The first four were all pending on the linked database, so the CLI applied the complete pending chain rather than only the Smart Rotation file. The follow-up migration removed the two already-revoked lease-claim RPCs; it did not remove historical lease rows/columns used by existing event audit foreign keys. No lease/PIN is used as authority.

After application, `npx supabase migration list --linked` showed every local migration present remotely. `npx supabase db push --linked --dry-run` reported `upToDate: true`. The linked DB lint initially found the stale `claim_operator_lease` reference; after the cleanup migration, lint reported no errors (only legacy unused `p_lease_id` parameter warnings on compatibility-shaped RPCs).

The hardening migration's completed-set decisive-score constraint was compatible with existing data: the preflight found zero completed tied/missing-score sets. RLS remained enabled on `matches`, `session_participants`, `session_events`, `rotation_recommendations`, and `rotation_candidate_scores`; direct INSERT privileges for both `anon` and `authenticated` were false after migration.

## Database Smoke Test Results

Repeatable script: `supabase/tests/smart_rotation_deployment_smoke.sql`.

It creates a six-player test session inside one explicit transaction, uses the existing Club Admin identity in request claims for guarded RPC checks, asserts persisted rows/state after each transition, then rolls back every fixture row. The script refuses to overlap a LIVE session. The remote had no LIVE session at test time. Its SQL ranking/diagnostic values are deterministic fixture payloads; the actual recommendation scoring remains in the already-tested TypeScript Algorithm 1 domain. An intentionally fake diagnostic debt of 999 was included to prove diagnostics do not drive server fairness state.

| Test                              | Setup and observed database result                                                                                                                                                                                                                                                                                                                                                                                                             | Result |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **A — first rotation**            | Six READY participants; saved a four-player recommendation with candidate scores/reasons; started the recommended four. One `ROTATION_STARTED` event recorded all six READY IDs and the actual four selected IDs. Four participants became PLAYING; two remained READY and each had current debt 1.                                                                                                                                            | PASS   |
| **B — next recommendation**       | Completed both sets using the normal `complete_set` RPC, requested fairness state again, and saved a second recommendation. The skipped player’s debt remained 1 after reconstruction; eligible/missed/played values came from event history.                                                                                                                                                                                                  | PASS   |
| **C — admin override**            | Recommendation marked A/B/C/D, then actual start selected A/B/C/E. The second event records E selected and D absent; D stayed READY and accrued a missed opportunity. Fairness state follows the event’s actual four, not the stored recommendation.                                                                                                                                                                                           | PASS   |
| **D — repeated skip/starvation**  | Player F remained READY and was skipped across four rotations. Reconstructed current debt advanced 1 → 2 → 3 → 4. The test then selected F: current debt became 0 while historical missed opportunities remained 4. The configured `debt >= 4` SHOULD_PLAY qualification is separately covered by the domain regression suite; the database RPC stores candidate diagnostics but does not treat client-supplied tier/metrics as authoritative. | PASS   |
| **E — status exclusion**          | E transitioned READY → RESTING before rotations 3–4. Eligible-opportunity count stayed at 2 while resting. RESTING → READY restarted `ready_since`; the next rotation counted E as a new eligible opportunity.                                                                                                                                                                                                                                 | PASS   |
| **F — refresh/reconstruction**    | Repeated calls to the stateless fairness RPC after each completed match reconstructed state solely from persisted `ROTATION_STARTED` snapshots and match/set records. Five recommendation snapshots were linked to five matches. No fairness counter was held only in the SQL test client.                                                                                                                                                     | PASS   |
| **G — invalid mutation/security** | Random non-admin JWT subject received `[]` for fairness state and was rejected by recommendation save. Catalog checks confirmed anon cannot execute either rotation write RPC; anon/authenticated have no direct INSERT on fairness/event tables. Fake client metrics did not change reconstructed debt. Valid admin RPC calls succeeded.                                                                                                      | PASS   |

During the smoke transaction, the emitted final database result showed 5 matches, 5 recommendation rows, and 5 rotation snapshots. F had 5 eligible opportunities, 4 historical misses, 1 actual rotation, and debt 0 after selection. E had 3 eligible opportunities (none during RESTING), 2 misses, 1 actual rotation, and debt 1 after re-entry and a later skip. A/B/C/D/E/F remained reconstructible by participant UUID and event history. The transaction rolled back after emitting this evidence.

Post-rollback inspection confirmed the real database remained at 17 sessions, had zero `ROTATION-SMOKE-*` players, zero LIVE sessions, and zero legacy finance-role rows. No test session or event was left behind.

## Transaction Integrity

`start_match` inserts the match, Set 1, actual Set 1 players, `ROTATION_STARTED` snapshot, `MATCH_STARTED` event, and selected-player status/period transitions within one PostgreSQL function call. A function call runs as one transaction. `complete_set` likewise updates the set/match lifecycle, participant states, and events transactionally.

The smoke test installed a temporary trigger that deliberately raised an error during the selected-player status transition—after the RPC had inserted match/set rows and appended the rotation event. The error was caught by the test; subsequent assertions found no match, set, event, or changed participant status from the failed call. The valid start immediately afterward succeeded. This directly tested rollback of late failure, not just static SQL structure.

Saving a recommendation is a separate preceding RPC, so a failed match start may leave an unused recommendation snapshot. It cannot leave a false rotation event, change fairness history, or partially start a match. Actual fairness history is written only by the successful start command.

## Security Verification

- The hardening migration revoked direct browser DML on public tables from `anon` and `authenticated`; catalog inspection confirmed INSERT is false on all five relevant tables and RLS remains enabled.
- New fairness functions use `SECURITY DEFINER`, empty `search_path`, and explicit execute grants to `authenticated` only. They check `auth.uid()` and Club Admin membership; `start_match` delegates to the current Club-Admin authorization check. Anonymous execute privileges are false.
- A non-admin subject was rejected by function-body checks in the smoke script. The actual CLI query connection runs as database `postgres`, so the test verifies authenticated-role ACLs from the catalog and exercises the RPC authorization checks with JWT claims; it is not a browser session using a separate non-admin Auth account.
- Candidate ranking diagnostics can be client supplied, but they are audit/display data only. Debt/opportunities are recalculated from trusted `ROTATION_STARTED` events and never accepted as RPC inputs to fairness state.
- The two revoked lease-claim RPCs were dropped after lint exposed a stale reference. Historical `session_operator_leases` structures are retained only where existing audit foreign keys require them; no PIN/operator lease is required to authorize mutations.

`npx supabase db advisors --linked --type security` also reported pre-existing project-wide findings: SECURITY DEFINER public-safe views/read RPCs and many authenticated SECURITY DEFINER command RPCs, plus leaked-password protection disabled. These were not introduced by the Smart Rotation migration. The rotation writes themselves are Admin-guarded, and no direct public table write was found. The broader advisor findings should be handled in a separate security review rather than widening this task into unrelated view/auth changes.

## Fixes Made

- Added `supabase/tests/smart_rotation_deployment_smoke.sql`, a repeatable transaction-scoped database regression covering events, overrides, debt progression/reset, RESTING exclusion, reconstruction, invalid callers, and rollback integrity.
- Added `20261005140000_drop_revoked_operator_lease_rpcs.sql` after linked DB lint discovered a revoked legacy function referencing the already-dropped PIN credential table.
- No Algorithm 2, scoring redesign, finance feature, or UI feature was added.

## Automated Verification

- `npx supabase db push --linked` — passed; all five pending migrations applied.
- `npx supabase db query --linked --file supabase/tests/smart_rotation_deployment_smoke.sql` — passed against remote Postgres; assertions and rollback completed.
- `npx supabase migration list --linked` — passed; local/remote histories matched.
- `npx supabase db push --linked --dry-run` — passed; database up to date.
- `npx supabase db lint --linked` — passed with zero errors; unused legacy lease-parameter warnings remain.
- `npx supabase db advisors --linked --type security --level warn` — completed; reported existing project-wide findings documented above.
- `npm run verify` — passed: lint, Svelte check (0 diagnostics), 51 unit tests, 12 E2E tests, and production build.
- Playwright emitted optional host-library warnings; all E2E tests passed.
- Local `supabase status` / clean reset — unavailable because Docker/Podman is not installed and no local Supabase config exists.

## Remaining Risks

- A clean local rebuild/reset was not exercised. The actual linked database migration chain did apply, and all applied migrations are in remote history.
- The smoke used authenticated database JWT claims rather than browser sign-in/sign-out because no separate test Auth identity/credentials were available. Stateless database reconstruction and RPC guards were exercised directly.
- The SQL smoke verifies persistence/authority around the recommendation snapshot; Algorithm 1 scoring and SHOULD_PLAY ranking are client-domain logic and remain covered by the existing domain tests, not reimplemented in SQL.
- Existing security-advisor findings and legacy unused `p_lease_id` parameters remain outside this Smart Rotation deployment scope.

## Final Verdict

DEPLOYMENT GATE: PASS
