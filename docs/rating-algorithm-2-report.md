# Algorithm 2 Balanced Pairing — Model Selection

## 1. Models Implemented

All models are pure TypeScript in `src/lib/domain/rating/`, deterministic, and update only a completed set's actual four-player lineup.

| Model                          | Version                             | Update                                                                                                                                         |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Team Elo baseline              | `team-elo-baseline-v1`              | Team mean rating feeds Elo probability; every player receives fixed `K=24` team-result delta. No uncertainty or margin.                        |
| TrueSkill-style                | `trueskill-style-v1`                | Same explainable team outcome update, but `K=18 × sigma / 280`; sigma shrinks by `0.94` per completed set and is clamped to 45–350. No margin. |
| TrueSkill-style bounded margin | `trueskill-style-bounded-margin-v1` | TrueSkill-style update multiplied by the bounded set-margin evidence below.                                                                    |

This is deliberately called _TrueSkill-style_, not Classic TrueSkill: it is an uncertainty-weighted individual doubles approximation, not the full Gaussian factor-graph implementation. Constants are centralized in `RATING_CONSTANTS`.

## 2. Scenario Results

Deterministic unit/fixture coverage covers actual-four-only updates and completed-set validation, plus the following behavioral findings.

| Scenario                                   | Team Elo                                              | TrueSkill-style                                                           | Bounded-margin TrueSkill-style                                                    |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A / M established bad or alternating night | Fixed, moderate movement; no confidence state         | Low sigma reduces one-set movement                                        | Same stability; blowouts provide bounded extra evidence                           |
| B/C newcomer initially too high/low        | Same K as veteran                                     | High sigma produces a larger correction                                   | Selected: same newcomer response plus bounded margin evidence                     |
| D/E one/repeated upset                     | Surprise delta grows through expectation; no collapse | Same, sigma contracts over evidence                                       | Same, stronger evidence for a decisive repeated upset                             |
| F/H close vs blowout                       | Identical result movement                             | Identical result movement                                                 | 21–10 moves more than 21–19; cap prevents absurd change                           |
| G repeated close wins                      | Gradual accumulation                                  | Gradual accumulation with declining uncertainty                           | Gradual, slightly stronger for wider close scores                                 |
| I/J mixed partners/opponents               | Individual rating, not pair identity                  | Individual rating plus confidence convergence                             | Same; selected model retains individual inference                                 |
| K carried partner                          | Cannot perfectly separate correlated teammates        | Better caution for uncertain carried player, but still a known limitation | Same limitation; do not interpret wins as causal individual proof                 |
| L substitution                             | Actual set lineup only                                | Actual set lineup only                                                    | Actual set lineup only; regression proves B receives no Set 2 update while E does |
| N hidden-strength convergence              | Useful simple benchmark                               | Faster correction of wrong newcomer priors                                | Selected for same convergence behavior plus bounded score evidence                |

## 3. Model Comparison

| Metric                   | Team Elo           | TrueSkill-style        | Bounded-margin TrueSkill-style |
| ------------------------ | ------------------ | ---------------------- | ------------------------------ |
| Newcomer correction      | Fixed              | Strong                 | Strong                         |
| Established stability    | Fixed              | Strong                 | Strong                         |
| Margin sensitivity       | No                 | No                     | Yes, capped                    |
| Maximum one-set movement | 24 points at 50/50 | <= 18 at initial sigma | <= 24.3 at initial sigma/cap   |
| Explainability           | Highest            | High                   | High                           |
| V1 selection             | Benchmark only     | Viable                 | **Selected**                   |

## 4. Margin Behavior

`multiplier = 1 + 0.35 × margin / (margin + 10)`.

| Score | Margin | Multiplier |
| ----- | -----: | ---------: |
| 21–20 |      1 |      1.032 |
| 21–19 |      2 |      1.058 |
| 21–15 |      6 |      1.131 |
| 21–10 |     11 |      1.183 |
| 21–5  |     16 |      1.215 |

The asymptote is 1.35, so 21–1 cannot produce unbounded movement.

## 5. Uncertainty Behavior

Newcomer sigma begins at 280; established sigma at 65. For equal surprise, the uncertainty-aware models weight movement by `sigma / 280`, so a newcomer moves about 4.3× more initially. Sigma decays gradually per completed set and cannot fall below 45 or exceed 350.

## 6. Pairing Evaluation

`evaluatePairings` enumerates exactly AB/CD, AC/BD, and AD/BC. Team strength is each pair's mean rating; the result includes both strengths, absolute gap, Elo-style win probability, and mean uncertainty. Sort order is raw predicted gap then canonical input-order pairing string, giving deterministic ties. For 1600/1500/1400/1300, strongest+weakest is selected with gap 0.

## 7. Pairing Uncertainty Experiment

The three legal pairings contain the same four players, so their aggregate mean sigma is identical. An uncertainty penalty therefore cannot meaningfully distinguish them without inventing team-correlation assumptions. V1 retains the simpler raw expected-gap rule.

## 8. Failure Findings

No individual-only model can perfectly identify a weak player consistently carried by the strongest player from correlated wins alone. The selected model reduces early overconfidence through sigma but does not claim causal attribution. Rating estimates should remain advisory, with admin team override.

## 9. Selected V1 Model

**`trueskill-style-bounded-margin-v1`**. It is the smallest model that meets newcomer responsiveness, established stability, individual mixed-doubles ratings, upset response, and bounded score-margin requirements. Full Classic TrueSkill was not selected because the added mathematical/runtime complexity was not supported by evidence available in these deterministic fixtures.

## 10. Self-Check

- Completed actual set participants only: PASS.
- Incomplete/abandoned set no-op: PASS.
- Deterministic / finite updates and bounded sigma: PASS.
- Newcomer moves faster than established player: PASS.
- Margin monotonic and saturated: PASS.
- Three legal pairing enumeration / deterministic selection: PASS.
- Algorithm 1 selection untouched: PASS.

## 11. Courtside Pairing Integration

Algorithm 1 still selects the four-player roster. Algorithm 2 receives only the final four IDs after any admin changes, evaluates exactly `AB vs CD`, `AC vs BD`, and `AD vs BC`, and recommends the smallest raw team-mean rating gap. Existing deterministic tie-breaking is preserved; no sigma, gender, or playstyle penalty is added.

The courtside sheet shows the recommended teams and three legal choices. The recommended choice is preselected; either alternative can be selected. Match start submits the chosen teams to the existing trusted `start_match` command. Those teams become `set_players`; the recommendation remains advisory and never overrides the actual lineup.

## 12. Recommendation Audit and Fallback

The existing `pairing_recommendations` and `pairing_recommendation_players` tables are reused. After `start_match` creates its match ID, the authenticated Club Admin RPC `save_pairing_recommendation` writes the recommended teams, `trueskill-style-bounded-margin-v1`, three-option diagnostics/gaps/strengths, and four authoritative rating/uncertainty snapshots read by the database. It validates that the recommendation is a partition of the actual four match players. Browser table inserts are not granted.

Because the existing audit schema is keyed to `match_id`, persistence follows match creation. If audit saving fails, the match is already started using the selected actual teams; the UI reports briefly that the recommendation was not saved and does not block play. Rating calculations continue to use actual `set_players`, never the audit recommendation.

## 13. Player Rating and Correction Refresh

Player detail reads `public_player_rating`, a narrow public-safe RPC over authoritative `player_ratings`; it shows rounded rating and a confidence label, not sigma. The single presentation threshold is centralized as sigma `<= 100` → “Stabil”; otherwise “Masih dikalibrasi”. The detail refetches authoritative state when the page is focused or becomes visible, so returning after set completion/correction refreshes the displayed value. The next Live recommendation reads current rating state, not pairing-history snapshots.

## 14. Verification Evidence

- `npm run verify` — PASS: lint, Svelte check, 64 unit tests passed (3 remote tests skipped unless explicitly enabled), 17 Playwright tests passed, production build passed.
- Svelte autofixer on `MatchCourt.svelte` and player detail — no issues or suggestions.
- Focused Live E2E — 16 passed, including exactly three choices, deterministic recommendation, both alternatives, final-four override, recommendation-save fallback, rating display, and focus refresh.
- `RUN_REMOTE_RATING_TESTS=true REMOTE_RATING_TEST_BASE_URL=http://127.0.0.1:5199 npx vitest run src/lib/server/algorithm2-rating.remote.spec.ts` — PASS, all 3 real-remote tests.
- Remote `ALGO2-LIVE-*` full scenario — PASS: created five fixtures, chose a legal alternative to the persisted recommendation, verified `set_players`, completed Set 1, substituted a player for Set 2, completed Set 2, corrected Set 1, asserted replay rebuilt exactly 8 transitions on the actual per-set lineups, read corrected public rating, and created the next match from the three pairings calculated on post-replay ratings. The next recommendation audit snapshots matched those current DB ratings.
- Cleanup query — PASS: zero matching `ALGO2-LIVE-*` / `ALGO2-PERSISTENCE-*` players, sessions, matches, sets, pairing audits, or rating history. Disposable Auth user and fixture club removed.
- `npx supabase migration list --linked` — PASS; all local migrations through `20261006103627` match remote history.
- `npx supabase db lint --linked` — attempted, but could not authenticate as `cli_login_postgres`: `FATAL: password authentication failed` (requires `SUPABASE_DB_PASSWORD`). SQL-backed remote proofs and migration application succeeded through the linked Management API.

The persistence oracle, retry, and rollback evidence remains in `docs/rating-algorithm-2-persistence-report.md`.

## FINAL VERDICT

ALGORITHM 2 DEPLOYMENT GATE: PASS
READY FOR REAL SESSION TESTING
