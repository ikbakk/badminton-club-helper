# Real-session validation reporting

The post-session evaluator in `src/lib/domain/session-evaluation.ts` is a pure function over persisted session facts. `src/lib/server/session-evaluation.ts` fetches and normalizes production rows; it produces concise Algorithm 1 fairness metrics, Algorithm 2 recommendation/outcome metrics, rating observations, and named review flags. It has no write path and must not be invoked during the courtside match workflow.

## Persisted sources and metric definitions

The evaluator reads `sessions`, `session_participants`, `players`, `participant_status_periods`, `rotation_recommendations`, `rotation_candidate_scores`, `session_events`, `matches`, `sets`, `set_players`, `pairing_recommendations`, `pairing_recommendation_players`, and `player_rating_history`. It reports pairing actual-gap only where the actual partition matches one of the persisted candidate options; otherwise it is unavailable. Score margin uses the currently stored completed-set scores, so corrected scores replace earlier scores. The adapter does not write data.

- Rotation override: the recommended and actual four distinct player IDs differ; order is ignored. Starts without a saved four-player recommendation are excluded from override rate.
- Pairing override: recommended Set 1 teams differ from actual Set 1 `set_players`; team A/B labels are normalized, so swapping sides is not an override.
- Starvation: at least one recorded READY opportunity and zero full rotation starts before session end. Set 2 substitution participation is not a full rotation.
- READY-wait completeness: every checked-in participant must have status periods that cover check-in through session close without material gaps and with a recorded final end. If this check fails, all READY-wait values are JSON `null`, the status is `INCOMPLETE`, and `READY_WAIT_INCOMPLETE` is raised. No missing periods are inferred.
- Maximum READY wait: when history is complete, the longest continuous recorded `READY` status period; RESTING/AWAY/etc. are excluded. Otherwise unavailable, not zero.
- Close set: completed score margin <=3. Blowout: completed score margin >=10. Observational only.

Thresholds and named flags are centralized in `SESSION_EVALUATION_THRESHOLDS`. They do not change production selection/rating behavior.

## Data and interpretation

Use rotation snapshots and recommendation snapshots already persisted by trusted commands. Use actual match starts and Set 1/Set 2 `set_players` as ground truth, including substitutions. Use the current corrected scores and rating-history replay; never treat an obsolete pre-correction result as current. READY wait includes only READY status periods; where periods are absent, the duration is incomplete and should be treated as a data-quality limitation, not zero wait.

Close (margin <=3) and blowout (margin >=10) are observational labels. **Close set != proof of perfect rating; blowout != proof of bad matchmaking; override != proof algorithm is wrong; one session is not enough to retune.** No metric feeds Algorithm 1/2 and no automatic tuning is performed.

## Visibility and export

Public-safe history remains separate. Evaluation details, per-player rows, rating observations, internal flags, and recommendation/actual comparison are admin-only. The trusted `GET /api/history/[id]/evaluation` requires a Club Admin Bearer token and sends `Cache-Control: private, no-store`. The history-detail admin action downloads the structured evaluator JSON; it is not produced by scraping the UI. Payment information, raw rating uncertainty, access tokens, and auth metadata are not in the evaluator/export. No suitable existing session-note field exists; no new note was added.

## Privacy and real-world sample

Operational evaluation, per-player fairness rows, and override audit details are admin-only. Raw rating uncertainty is not exported. Public history remains separate and public-safe. Do not publish player fairness or payment data. Collect optional qualitative debrief outside live play; no note is required during matches.

For each of **3–5 actual PB NEWBIE sessions**, record these debrief answers outside the app: (1) did rotation feel fair? (2) did pairing feel balanced? (3) what part of the courtside flow caused friction? Compare those notes to the quantitative export before changing thresholds, weights, or model constants. Review questions:

- Algorithm 1: any starvation? Maximum READY wait? Override rate? Rotation spread? Common override reason inferred from session context?
- Algorithm 2: pairing override rate? Close/blowout distribution? Newcomer calibration? Obvious mismatches despite low predicted gap?

The evaluator returns structured JSON suitable for an admin/developer report; it does not create a public analytics dashboard or export private fields to public history.
