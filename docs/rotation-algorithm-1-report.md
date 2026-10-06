# Algorithm 1: Smart Rotation — design and evaluation

## 1. Algorithm summary

`recommendNextPlayers(input, nowMs)` is a deterministic, pure TypeScript domain function. It recommends four READY player IDs only; it does not form teams, access persistence, or make a selection authoritative. Candidates sort by a named priority score, with stable player-ID tie-breaking.

Baseline priority (higher is earlier):

```text
100 × current consecutive opportunity debt
+ 1 × current READY wait minutes
+ 8 × max(0, (lowest READY set count + 2) − candidate set count)
− consecutive-play penalty
```

Named values live in `ROTATION_WEIGHTS`:

| Constant                           |     Value | Rationale                                                                                                                                        |
| ---------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `opportunityDebt`                  |       100 | Primary fairness signal; consecutive eligible misses since the player's last actual selection matter substantially more than one waiting minute. |
| `readyWaitPerMinute`               |         1 | Secondary urgency signal for unequal match durations.                                                                                            |
| `setDeficitPerSet`                 |         8 | Small participation-deficit tiebreaker; does not turn Algorithm 1 into skill matching.                                                           |
| `consecutiveSecondRotationPenalty` |        75 | Mildly discourages a second consecutive rotation.                                                                                                |
| `thirdConsecutivePenalty`          | 1,000,000 | Excludes a third consecutive turn while at least four READY alternatives exist; dropped as a hard exclusion when that pool is too small.         |

## 2. Domain assumptions

- **Opportunity:** immediately before a rotation selection, each READY player gets one opportunity. The four players actually selected reset current opportunity debt; other READY players increment both cumulative missed opportunities (for analysis) and current debt. An override, not the original recommendation, determines actual history.
- **Waiting:** current READY time is `nowMs - readySinceMs`, clamped at zero. Leaving READY ends that interval; returning to READY restarts it. The simulator retains cumulative and maximum continuous READY waiting history. RESTING/AWAY time is not added to READY wait or opportunities.
- **Late arrival:** starts accumulating opportunities only from the first selection after arrival; low game count alone does not outweigh missed rotations.
- **Consecutive rule:** two consecutive match rotations are permitted; a third is soft-excluded if four other READY players are available. With fewer alternatives the recommender returns four and gives fallback context in the explanation.
- **Sets and fill-ins:** normal selected participants receive two sets per match rotation. A Set 2 fill-in adds one set and a separate `fillInSets` count, but not a second rotation/opportunity or a full rotation-play count. The simulator does not infer teams.
- **Scenario model:** events use elapsed milliseconds. All event ordering and ties are deterministic. Duration sequences repeat when more rotations are requested than durations supplied.

## 3. Test coverage

`src/lib/domain/rotation/rotation.spec.ts` covers named scoring, wait urgency, state eligibility, determinism, and scenarios A–K. A fixed-seed (`0x5eed1234`) generated test runs 250 sessions with 4–16 players, arrivals, status changes, and variable 12–52-minute durations. It checks unique four-player selections, non-negative/history invariants, and compares three missed-opportunity weights on identical generated inputs. Another stable-population test checks 4–16 players for 60 rotations each.

## 4. Simulation results

| Scenario                                                | Observed result                                                                                                                                                                                                                                                                                                                 | Assessment                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — 10 stable players, 30 rotations                     | 120 slots divide evenly (12 rotations / 24 sets each; spread 0); no consecutive-match rotation selections; every player plays.                                                                                                                                                                                                  | Matched expectations.                                                                                                                                                       |
| B — 14 players, 35 rotations, 12/35/19-minute durations | Each strategy completes 35 rotations. Combined and least-games both have rotation spread 0 and missed-opportunity distribution exactly 25 each; FIFO spread 4 and missed opportunities 23–27. Maximum continuous READY wait recorded: 66 minutes.                                                                               | Combined meets fairness expectations but does not beat least-games in this stable/equal-start scenario; FIFO is less even.                                                  |
| C — 8 start, newcomer arrives after 4 rotations         | Newcomer has 8 eligible opportunities (not the whole 12), is not selected at their first available selection, then plays once (2 sets), missing 7 of 8 opportunities. Least-games selects them immediately and they play 7 of those 8 rotations.                                                                                | Smart Rotation respects prior opportunity debt, but is notably stricter than least-games for a late arrival. This is a tuning/product-policy question, not hidden as a win. |
| D/E — RESTING/AWAY and return                           | No opportunity is credited while away from READY; returner receives only opportunities after return, and READY wait restarts on return.                                                                                                                                                                                         | Matched expectations.                                                                                                                                                       |
| F — two consecutive                                     | In 8-player stable session, no forced third selections.                                                                                                                                                                                                                                                                         | Matched expectations.                                                                                                                                                       |
| G — only four READY, all at two consecutive             | Four are still returned; fallback is reported and candidate reason names limited alternatives.                                                                                                                                                                                                                                  | Matched expectations.                                                                                                                                                       |
| H — equal missed opportunities, unequal READY wait      | Longer READY wait ranks first.                                                                                                                                                                                                                                                                                                  | Matched expectations.                                                                                                                                                       |
| I — override A/B/C/D → A/B/C/E                          | E receives actual rotation participation; D remains READY and records a missed opportunity.                                                                                                                                                                                                                                     | Matched expectations.                                                                                                                                                       |
| J — OUT/LEFT                                            | Neither state is recommended; pre-existing history is retained.                                                                                                                                                                                                                                                                 | Matched expectations.                                                                                                                                                       |
| K — Set 2 replacement                                   | Outgoing and incoming each receive one set; incoming receives one fill-in set and zero whole rotations.                                                                                                                                                                                                                         | Matched expectations.                                                                                                                                                       |
| Fixed-seed property runs                                | 250 sessions complete without duplicate/fewer-than-four selections when four were available, negative counters, or missed > eligible. Stable population sweep 4–16 has no starved player, rotation spread ≤1, and no forced third turn. The generated dynamic corpus records 3 no-turn incidents (eligible >0, zero rotations). | Stable rule passes; transient availability can produce no-play sessions and warrants real-history review.                                                                   |

For the 14-player baseline comparison over 40 rotations with the same 12/35/19-minute sequence:

| Strategy                | Rotations/player (min–max; SD) | Sets/player (min–max; SD) | Missed opportunities (min–max; SD) | Selection spread | Consecutive selections / forced thirds |
| ----------------------- | ------------------------------ | ------------------------- | ---------------------------------- | ---------------: | -------------------------------------: |
| Least-games             | 11–12; 0.49                    | 22–24; 0.99               | 28–29; 0.49                        |                1 |                                  0 / 0 |
| FIFO                    | 10–14; 1.68                    | 20–28; 3.36               | 26–30; 1.68                        |                4 |                                  0 / 0 |
| Combined Smart Rotation | 11–12; 0.49                    | 22–24; 0.99               | 28–29; 0.49                        |                1 |                                  0 / 0 |

## 5. Baseline comparison

The combined algorithm matches least-games on aggregate spread in the fixed crowded scenarios; the evidence does **not** show it is superior there. It beats FIFO on distribution in those scenarios. Opportunity and wait signals chiefly matter when attendance, READY eligibility, history, or match durations differ. No optimization was performed to force a win over the baselines.

## 6. Failure findings

- The selected weights are an explainable starting point, not empirically calibrated. The stable 14-player comparison ties least-games; added complexity should not be presented as a demonstrated gain in that case.
- A high missed-opportunity advantage can still outweigh current wait by design. Different attendance and duration distributions need longer evaluation before product claims about fairness.
- In the crowded baseline, combined and least-games tie in both tested duration patterns; the current wait term does not improve aggregate rotation spread in that equal-arrival scenario. Its value is specifically dynamic-arrival/unequal-wait fairness and needs history-based validation.
- Scenario and seeded tests prove these modeled cases only. The simulator is not a substitute for checking real event/history inputs, persistence semantics, and admin overrides during later integration.

## Adversarial Scenarios

All comparisons use fixed inputs and deterministic tie-breaking. Times below are READY time, not total elapsed session time.

| Case                                   | Setup and observed outcome                                                                                                                                                                                                                                                                                                                                                                                                 | Assessment / surprise                                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — missed opportunity vs extreme wait | A: 3 misses, 5 READY minutes → 305 points. B: 2 misses, W READY minutes → `200 + W`. At W=20/40/60, A wins (B=220/240/260). At W=105, tie (A wins ID tie-break); B wins at 106. Thus B needs **over 100 extra wait minutes** versus A, and over 105 absolute minutes in this setup.                                                                                                                                        | Exactly reflects 100 points/missed opportunity; waiting is genuinely secondary, but a single opportunity can outweigh a long wait. Review with product owners before UI integration. |
| B — late arrival / least-games         | Eight players begin; newcomer arrives after six 20-minute rotations. On first eligible opportunity Smart selects four incumbents; least-games selects newcomer immediately. By the end of 8 eligible opportunities, Smart gave newcomer 1 rotation/2 sets and they missed 7; least-games gave 7 rotations/14 sets and they missed 1. Smart newcomer maximum continuous READY wait was 120 minutes; least-games 20 minutes. | Smart avoids “zero games means jump the queue” but may be too conservative: this is an intentionally adversarial late-arrival differential and needs product-policy review.          |
| C — repeated RESTING/READY             | Toggle READY→RESTING at 1m→READY at 5m→RESTING at 6m→READY at 10m, in a 1-minute match sequence. Measured READY wait is only accumulated in READY intervals; opportunity count is exactly 4 (one initial exposure, one before first rest, two after return), not during RESTING.                                                                                                                                           | Matched semantics; count includes the initial READY opportunity. READY timer restarts each return.                                                                                   |
| D — repeated override skips D          | In a five-player, four-rotation fixture, actual selections repeatedly omit `p3` and select `p4`. `p3` records 4 eligible / 4 missed opportunities and 0 rotations; next recommendation includes `p3`. Repeated checks across weight variants recover the skipped player.                                                                                                                                                   | Matched expected actual-state behavior; recommendation is based on actual selection, not the suggested lineup.                                                                       |
| E/I — unequal real wait                | Equal 2 misses; one candidate READY 15m and one 50m. The 50-minute candidate ranks first by 35 points when other metrics tie.                                                                                                                                                                                                                                                                                              | Matched urgency semantics. The 35-minute difference does not outweigh one missed opportunity at current weights.                                                                     |
| F — mixed 12-player session            | Staggered arrivals, variable 12/35/19m matches, repeated RESTING, AWAY/return, one LEFT, two overrides, and Set 2 fill-in over 24 rotations. Comparison table below. Smart has the lowest missed spread and no forced thirds, but one late player (`m11`) had 4 eligible opportunities and LEFT before receiving a rotation.                                                                                               | Mixed result: fairness distribution/fatigue improved versus FIFO and least-games on some metrics; no-play before early departure remains a concern.                                  |
| G — equal opportunities, unequal sets  | Equal inputs except one player has 8 sets fewer and one additional miss for the other player. At current weights, the missed-opportunity advantage is 100 points; set correction is at most 16 points in this pair. The opportunity-debt candidate stays ahead.                                                                                                                                                            | Set correction remains secondary; it cannot override one full missed rotation in this setup.                                                                                         |
| H — tight pool                         | With 5 or 6 READY players where fewer than four are below two consecutive rotations, recommender returns four and marks fallback. With one hot player plus four reasonable alternatives, the hot player is excluded even with 50 misses.                                                                                                                                                                                   | Matched soft-limit semantics; fallback is necessary at 5–6 players.                                                                                                                  |
| J — consecutive-heavy                  | Three candidates at two consecutive rotations and two alternatives with fairness debt trigger fallback; all four are still returned and debt candidates rank ahead of penalized hot players.                                                                                                                                                                                                                               | No pathological failure to fill the court; a third rotation can still happen when fewer than four alternatives are reasonable.                                                       |

Mixed-session baseline results (same events, overrides, and fill-in):

| Strategy       | Rotations/player (min–max; spread) | Sets/player (min–max; spread) | Missed-opportunity spread | Max continuous READY wait | Forced third turns | No-turn despite opportunity        |
| -------------- | ---------------------------------: | ----------------------------: | ------------------------: | ------------------------: | -----------------: | ---------------------------------- |
| Least-games    |                           1–10 (9) |                     1–20 (19) |                        15 |                      113m |                  1 | none                               |
| FIFO           |                          1–13 (12) |                     1–26 (25) |                        16 |                       66m |                  1 | none                               |
| Smart Rotation |                          0–11 (11) |                     0–23 (23) |                        14 |                      101m |                  0 | `m11` (4 opportunities, then LEFT) |

## Weight Sensitivity

The 48-case fixed grid used missed-opportunity weights 60/80/100/120, wait weights 0.5/1/1.5/2, and set weights 4/8/12. In the isolated one-miss crossover fixture (55 minutes more wait for the lower-opportunity candidate), waiting wins in 12/48 combinations; changing set weight has no effect when set metrics are equal. At current 100/1/8, the exact threshold is the 100-point opportunity difference.

Selected dynamic-session variants (same fixed 12-player event/override fixture):

| Missed / wait / set weights | Rotation spread | Set spread | Max READY wait | Missed spread | Forced thirds | Starved (eligible, no turn) | Late player turns |
| --------------------------- | --------------: | ---------: | -------------: | ------------: | ------------: | --------------------------: | ----------------: |
| 60 / 1 / 8                  |              11 |         23 |            66m |            14 |             0 |                           1 |                 0 |
| **100 / 1 / 8 current**     |              11 |         23 |           101m |            14 |             0 |                           1 |                 0 |
| 100 / 2 / 8                 |              11 |         23 |           101m |            14 |             0 |                           1 |                 0 |
| 100 / 1 / 12                |              11 |         23 |           101m |            14 |             0 |                           1 |                 0 |

The same fixed-seed 250-session corpus comparing missed-opportunity weights 60/100/120 reported:

| Missed weight | Mean rotation spread | Mean max continuous READY wait | Mean missed spread | No-turn incidents | Forced thirds |
| ------------: | -------------------: | -----------------------------: | -----------------: | ----------------: | ------------: |
|            60 |                0.600 |                         6.984m |              0.844 |                 3 |             0 |
|           100 |                0.600 |                         7.116m |              0.844 |                 3 |             0 |
|           120 |                0.600 |                         7.200m |              0.844 |                 3 |             0 |

No weight variant improves the distribution or resolves the late player who leaves before getting a turn. Weight 60 improves maximum wait materially in one hand-crafted dynamic fixture, but only marginally in the 250-session corpus and does not solve its no-turn case. Raising wait weight or set weight showed no improvement on that fixture. **No alternative is recommended from this evidence.**

## Why We Kept the Formula

We retained **100 / 1 / 8**. The 100-point opportunity value intentionally requires over 100 additional READY minutes to erase a one-opportunity lead; that is consistent with opportunity fairness as the primary signal, real time as secondary urgency, and sets as a small participation correction. The 60-point candidate lowered wait in one fixture but did not improve missed/rotation/set spread, resolve the late no-turn case, or materially improve the seeded corpus. The evidence is insufficient to justify weakening the primary fairness signal. Fatigue exclusion remains unchanged.

## Baseline Comparison

Stable all-READY sessions still show Smart Rotation approximately equal to least-games, which is acceptable. In the mixed fixture, Smart reduces missed-opportunity spread (14 vs 15/16), set spread (23 vs 19/25), and forced third turns (0 vs 1/1), but has worse rotation spread than least-games (11 vs 9) and leaves one late, early-departing player without a turn. FIFO has the shortest max wait (66m), but the largest missed/set spread. There is no one-dimensional winner; the mixed result supports the additional opportunity/fatigue signals but also supports keeping readiness at **NEEDS TUNING** until club history is evaluated.

## Regression Test Coverage

- New deterministic adversarial tests A–J, including the exact wait crossover, late-arrival/least-games comparison, repeated status transitions, repeated overrides, long-vs-short wait, mixed dynamic session, set correction, tight pools, and consecutive-heavy edge cases.
- Repeated override recovery is checked across all four selected weight configurations; the ignored player accumulates four legitimate misses and returns to the next recommendation.
- 250 generated, seeded sessions check selection cardinality/uniqueness, non-negative counters, and missed ≤ eligible; each session also runs with missed weights 60/100/120 for sensitivity metrics.
- Stable population sweep (4–16 players × 60 rotations), existing basic tests, and fill-in accounting remain in place.

## E2E Fixes

The previous three E2E failures were stale selectors/assertions, not product bugs:

1. **Public nav:** the public cash navigation label is `Kas`, not the old `Dana`; updated the expected link while retaining its visibility assertion.
2. **Check-in sheet overflow:** the test measured the fixed sheet shell for overflowing content. The implementation intentionally puts scrolling on its inner `.overflow-y-auto` pane; the test now measures that pane and still checks sheet sizing, placement, and page-scroll stability.
3. **Close recap flow:** current heading is `Rekap sesi selesai`; the confirmation CTA is `Konfirmasi rekap`, followed by `Selesai & lihat riwayat`. The test now follows that flow instead of clicking the global `Riwayat` navigation and obsolete `Confirm` link. History rows now expose explicit `LUNAS` / `BELUM BAYAR` text rather than the old colored-row classes; assertions check those user-visible states.

All three targeted E2E tests passed after updates; the complete E2E suite is included in final repository verification.

## 7. Tuning recommendations

Do not change weights based on these runs. Gather override and real session history after a separately reviewed integration, then evaluate missed-opportunity spread, total/current READY wait, set spread, and consecutive selections together. Keep least-games and FIFO comparisons in future evaluations; the current result gives no evidence to increase algorithm complexity further.

## 8. Production readiness

**NEEDS TUNING.** The pure domain API and adversarial suite pass, but the mixed session shows a late attendee can reach four opportunities and leave without playing; another late-arrival test gives them only 1 of 8 rotations where least-games gives 7. This is a deliberate consequence of opportunity fairness, but it needs club-owner review and real-session replay before UI integration. No weight change was supported robustly by sensitivity results. This task does not connect recommendations to `/live`.

## Repository Verification

- `npx vitest run src/lib/domain/rotation/rotation.spec.ts` — passed, 30 tests.
- `npm run check` — passed, zero diagnostics.
- `npm run test:unit -- --run` — passed, 45 tests across 5 files.
- `npm run test` — passed, 45 unit tests and all 7 E2E tests.
- `npm run test:e2e` — passed, all 7 tests. Playwright printed missing-host-dependency warnings, but browser execution completed successfully.
- `npm run lint` — passed; Prettier and ESLint are clean.
- `npm run build` — passed.
- `npm run verify` — passed end-to-end (lint, check, unit + E2E, build).
- `npx playwright test tests/live.e2e.ts --grep 'public visitor|admin checks in|admin can end'` — passed, 3 targeted stale-expectation cases.

## Starvation Guard Decision

**Selected policy: SHOULD_PLAY if current opportunity debt >= 4 OR continuous READY wait >= 45 minutes.** Current debt counts eligible rotations skipped since the player's last actual full-rotation selection; actual play resets it. Cumulative misses remain an analysis metric and no longer drive priority. The score is now `100 × current opportunity debt + 1 × current READY wait minutes + 8 × set deficit − consecutive-match penalty`.

In the late-arrival fixture (8 incumbents; newcomer arrives after six 20-minute rotations; 14 rotations total), the previous cumulative-missed algorithm gave the newcomer 1 turn from 8 opportunities, 7 misses, and 120 minutes maximum READY wait. Current-debt scoring gives them 4 turns, first selected on the 8th session rotation / 2nd eligible opportunity, with 4 misses and 40 minutes maximum READY wait. Rotation spread is 3, set spread 6, missed spread 5, starvation incidents 0, and forced third turns 0. This produces a reasonable turn without immediately jumping a newcomer ahead of players who already have current debt.

The threshold tier is explicit and READY-only. Within SHOULD_PLAY, the existing score and stable ID tie-break apply. A player with two consecutive rotations is DEPRIORITIZED while four alternatives exist; the guard cannot bypass this constraint. Smaller pools retain the four-player consecutive fallback.

## Candidate Comparison

Six nearby current-debt/wait policies were compared. Outcomes were identical on the primary and mixed dynamic fixtures, so the initial product threshold is selected for its simple, explainable values rather than a one-metric optimization.

| Policy                              | Newcomer turns / eligible opportunities | Missed | First selection (session / eligible turn) | Max READY wait | Rotation / set / missed spread | Starvation / forced thirds |
| ----------------------------------- | --------------------------------------: | -----: | ----------------------------------------: | -------------: | -----------------------------: | -------------------------: |
| Previous cumulative-missed baseline |                                   1 / 8 |      7 |                      first available turn |           120m |          6 / 12 / not captured |                      1 / 0 |
| Current debt; no guard tier         |                                   4 / 8 |      4 |                                 8th / 2nd |            40m |                      3 / 6 / 5 |                      0 / 0 |
| debt >= 3 OR wait >= 45m            |                                   4 / 8 |      4 |                                 8th / 2nd |            40m |                      3 / 6 / 5 |                      0 / 0 |
| **debt >= 4 OR wait >= 45m**        |                               **4 / 8** |  **4** |                             **8th / 2nd** |        **40m** |                  **3 / 6 / 5** |                  **0 / 0** |
| debt >= 4 OR wait >= 60m            |                                   4 / 8 |      4 |                                 8th / 2nd |            40m |                      3 / 6 / 5 |                      0 / 0 |
| debt >= 5 OR wait >= 45m            |                                   4 / 8 |      4 |                                 8th / 2nd |            40m |                      3 / 6 / 5 |                      0 / 0 |
| debt >= 3 OR wait >= 40m            |                                   4 / 8 |      4 |                                 8th / 2nd |            40m |                      3 / 6 / 5 |                      0 / 0 |
| debt >= 5 OR wait >= 60m            |                                   4 / 8 |      4 |                                 8th / 2nd |            40m |                      3 / 6 / 5 |                      0 / 0 |

Stable 10- and 14-player variable-duration fixtures remained balanced under current-debt scoring and all guard policies: rotation spread <= 1 and zero forced third selections. In the mixed 12-player fixture (staggered arrival, variable match duration, RESTING/AWAY/LEFT, overrides, and Set-2 fill-in), all candidates produced rotation spread 10, set spread 21, missed spread 15, max READY wait 66m, zero starvation incidents, 1 turn for the late/early-leaving player, and zero forced thirds.

The policy tests confirm long continuous READY wait protects a modest-debt player; RESTING/AWAY time does not accrue debt or wait; actual overrides drive debt; and debt resets when the ignored player is selected. Multiple SHOULD_PLAY candidates sort deterministically, consecutive fatigue remains protected where possible, and tight pools still return four.

## Self-Check

| GO criterion                                         | Result              | Evidence                                                                                                     |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| All Algorithm 1 tests pass                           | PASS                | Dedicated rotation suite: 33 tests passed.                                                                   |
| All repository verification passes                   | PASS                | `npm run verify` completed. Playwright emitted host dependency warnings but all 7 E2E tests passed.          |
| No high-severity fairness pathology remains          | PASS                | Late arrival gets 4/8 turns; mixed session has zero players with eligible opportunities and no turn.         |
| Guard improves late-arrival/forgotten-player problem | PASS                | Current debt gets newcomer from prior 1/8 to 4/8, with maximum READY wait reduced 120m to 40m.               |
| Stable 10/14 behavior does not materially regress    | PASS                | Both stay at rotation spread <= 1 with zero forced thirds in the fixed tests.                                |
| Consecutive fallback remains correct                 | PASS                | Tight-pool and fallback tests return exactly four; tier does not bypass the normal alternative exclusion.    |
| Chosen policy is deterministic and explainable       | PASS for experiment | Fixed thresholds, same-tier score order, stable ID tie-break; no randomness. No production policy is chosen. |
| Report contains evidence supporting the decision     | PASS                | Candidate table and the failing recovery fixture are documented here.                                        |

### Domain correctness review

- Exactly four distinct READY players are selected whenever at least four are READY: PASS (domain suite).
- Non-READY states are never selected: PASS (domain suite; RESTING/AWAY/OUT/LEFT/PLAYING excluded).
- RESTING/AWAY time does not accrue READY wait or eligible opportunities; re-entry resets the continuous wait: PASS (simulator adversarial tests).
- Actual manual override controls participation and missed-opportunity debt: PASS (simulator override test).
- Set-2 fill-in is one set, not a whole match rotation: PASS (fill-in test).
- Consecutive fallback preserves four-player output in tight pools: PASS.
- Multiple SHOULD_PLAY candidates are deterministic: PASS (threshold tier test).

Overall Phase 1 gate: **PASS**. No fairness, deterministic ordering, stable-session, consecutive fallback, or verification gate remains failed.

## Revisions Performed

- Replaced cumulative missed-opportunity priority with current debt, cleared by actual selection; cumulative misses remain only for retrospective metrics.
- Compared six nearby debt/wait thresholds and selected the initial debt >=4 OR wait >=45m candidate as the simplest policy with comparable results.
- Added deterministic domain/simulation coverage for debt reset, override recovery, late arrival, status transitions, stable 10/14 sessions, dynamic 12-player conditions, and consecutive fallback.
- Kept scoring in the pure TypeScript domain module; no random behavior, ML, teams, or UI-specific logic was added.

## UI Integration

**Integrated, with the database migration required before deployment.** The Live admin sees the recommended four plus short priority reasons and a SHOULD PLAY badge where applicable. Recommendations prefill the selection but do not auto-start a match: the admin can replace one or more players, choose all four manually, and still assigns teams manually. Fewer than four READY players have no actionable recommendation. If recommendation persistence fails, the manual flow remains available without an attached recommendation ID.

Current debt and fairness metrics are fetched from a Club-Admin-guarded RPC and derived from trusted `ROTATION_STARTED` event snapshots (READY pool and actual selected four); browser-supplied metrics are never accepted as fairness authority. Saving a recommendation checks that its candidates still match the current READY roster. Starting a match passes the recommendation ID alongside the actual two teams, and the existing guarded command records the actual four atomically. Thus admin overrides, not suggested selections, drive subsequent missed/debt accounting. Existing manual team assignment and explicit admin authority remain intact.

The migration adds the guarded fairness/recommendation RPCs and replaces the old four-argument `start_match` RPC with its five-argument form. **It has not been applied to a database in this environment:** Docker and a local Postgres/Supabase instance are unavailable. Apply the migration before deploying/testing against a real Supabase session; the existing page flow remains usable manually if RPC support is absent, but the new command signature is required to start matches after deployment.

## Automated Test Coverage

- Domain: current-debt score/reset, deterministic tier qualification, multiple SHOULD_PLAY tie-breaking, wait guard, RESTING/AWAY exclusion, and consecutive fallback.
- Simulation: previous cumulative-debt baseline versus six policies; dynamic 12-player comparison; stable 10/14-player sessions; overrides, status changes, fill-in, and seeded sessions.
- Live UI/controller/E2E: recommended preselection, admin acceptance, one- and multi-player overrides, manual fallback on recommendation-save failure, fewer-than-four READY handling, and recommendation-ID/actual-four command payloads.

## Full Verification

- `npx vitest run src/lib/domain/rotation/rotation.spec.ts` — passed, 33 tests.
- `npm run verify` — passed: lint, check (0 errors/warnings), unit (51 tests), E2E (12 tests), and production build.
- Targeted Live E2E checks passed for recommendation acceptance, one-/multi-player override, manual fallback after persistence error, and fewer-than-four handling.
- Playwright reported missing optional host libraries during install; browser tests still ran and all passed.
- Supabase SQL migration was reviewed but not executed against Postgres here; deployment gate remains: apply migration and smoke-test guarded RPCs against the target database.

## Final Verdict

READY FOR REAL SESSION TESTING AFTER APPLYING AND SMOKE-TESTING THE SUPABASE MIGRATION
