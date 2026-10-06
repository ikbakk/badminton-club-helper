# Real-session validation plan

## Existing-data audit

| Metric                                        | Already derivable? | Source                                                                                                       | Extra persistence needed?                                                                                  |
| --------------------------------------------- | -----------------: | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Rotation recommendations and recommended four |                Yes | `rotation_recommendations` + `rotation_candidate_scores.recommended`                                         | No                                                                                                         |
| Rotation actual four / override               |                Yes | `matches.rotation_recommendation_id` + `ROTATION_STARTED.metadata.selected_player_ids` (authoritative start) | No                                                                                                         |
| Eligible and missed rotation opportunities    | Yes, for snapshots | `ROTATION_STARTED.metadata.ready_player_ids` and `selected_player_ids`                                       | No                                                                                                         |
| Current opportunity debt                      | Yes, for snapshots | Ordered rotation events since player's last selected rotation                                                | No                                                                                                         |
| Rotation/set counts and fill-in sets          |                Yes | rotation start events; completed `sets` + `set_players`                                                      | No                                                                                                         |
| READY wait duration                           |          Partially | `participant_status_periods`; `READY` periods only, bounded by session close/current review time             | No; legacy missing periods reduce confidence                                                               |
| Consecutive rotations                         |                Yes | ordered `ROTATION_STARTED` selections                                                                        | No                                                                                                         |
| Pairing recommendations and predicted gap     |                Yes | `pairing_recommendations.diagnostics` and `pairing_recommendation_players`                                   | No                                                                                                         |
| Pairing accept/override                       |                Yes | recommendation players vs Set 1 `set_players`; partition comparison ignores A/B swap                         | No                                                                                                         |
| Actual chosen pairing gap                     |       Not reliably | actual Set 1 teams plus rating snapshots can recreate only with exact contemporaneous model state            | Do not persist in V1; report predicted gap and actual score outcomes                                       |
| Completed-set score margin / close / blowout  |                Yes | corrected `sets.team_a_score/team_b_score`                                                                   | No                                                                                                         |
| Winner/loser                                  |                Yes | completed set scores and actual set teams                                                                    | No                                                                                                         |
| Current rating observations after correction  |                Yes | `player_rating_history` corrected replay records (`SET_RESULT`)                                              | No                                                                                                         |
| Session notes                                 |                 No | None                                                                                                         | Omitted in V1 to avoid private-note persistence/UI complexity; collect review notes outside the match flow |

## Metric definitions

- Algorithm 1 override: recommendation's four player IDs differ from the actual four at match start; order is ignored.
- Algorithm 2 override: recommended and actual Set 1 two-player team partitions differ; swapping the A/B labels is not an override.
- Starvation: at least one recorded legitimate READY opportunity and zero full rotations before the review boundary. A Set 2 fill-in does not count as a full rotation.
- READY wait excludes RESTING, AWAY, OUT, PLAYING, and LEFT periods. Completeness requires persisted status periods to cover each participant from check-in through session close without material gaps and with a recorded final end. If not, READY-wait values are `null`/unavailable, a `READY_WAIT_INCOMPLETE` flag is emitted, and the values are excluded from tuning conclusions. `maxReadyWait` means the longest individual uninterrupted READY period, not total elapsed session time. Total READY wait sums recorded READY periods only when complete.
- Score margin is the absolute point difference from the currently persisted completed-set score, so corrected results supersede earlier values. Close set is margin <= 3; blowout is margin >= 10. Both are observational only.
- Validation flags: max wait >=45m, rotation count spread >2, pairing override rate >40%, blowout share >35%, and starvation/current debt >=4. These flags do not alter recommendations.

## What is not claimed

Close set != proof of perfect rating. Override != proof algorithm is wrong. One session is not enough to retune. Scores are outcomes, not causal evidence that a pairing was good or bad.

## Sample and review

Review **3–5 actual PB NEWBIE sessions** before changing any thresholds, weights, or model constants. Afterward ask:

For each session, also manually record outside the app: did rotation feel fair? Did pairing feel balanced? What courtside-flow step caused friction?

- Algorithm 1: any starvation? Maximum READY wait? Override rate? Rotation spread? What common override reason is inferable from context?
- Algorithm 2: pairing override rate? Close/blowout distribution? Did newcomer ratings move sensibly? Any obvious mismatches despite low predicted gap?

## V1 implementation

`src/lib/server/session-evaluation.ts` uses the service-role server client only after resolving the target session and verifying the caller's Club Admin role. It reads:

- `sessions` for metadata and `session_participants` plus `players` for attendance/names.
- `participant_status_periods` plus `session_participants` for status windows.
- `rotation_recommendations` and nested `rotation_candidate_scores`, matched to actual match starts using `matches.rotation_recommendation_id` and `session_events.ROTATION_STARTED` metadata.
- `matches`, `sets`, and `set_players` for actual rotations and authoritative lineups/scores (including Set 2 substitutions).
- `pairing_recommendations` plus `pairing_recommendation_players`; diagnostic candidate options provide actual gap only when the actual partition matches a persisted option.
- `player_rating_history` scoped through sets and matches for rating observations. Corrected score is read from the current `sets` row.

The adapter only fetches and normalizes facts; `src/lib/domain/session-evaluation.ts` remains pure. `/api/history/[id]/evaluation` requires a Bearer token, verifies Club Admin authority, and returns `private, no-store` JSON. The history route renders the compact evaluation only for cached Club Admin UI state; all diagnostics still come only from the trusted endpoint. Export downloads that same structured JSON. There is no session-note field in the existing schema, so optional notes are omitted rather than adding schema for them.

Public-safe history continues to use existing public read models. Per-player fairness, internal validation flags, score-linked pairing audit and rating observations are admin-only; raw rating uncertainty, private auth metadata, and payment data are excluded from the evaluation/export.

The deterministic twelve-player fixture is in `src/lib/domain/session-evaluation.fixture.ts`; it models staggered arrivals, RESTING/AWAY, early leave, recommendation overrides, Set 2 substitution, completed scores and the corrected persisted result. The current V1 adds no schema or recommendation-time writes.
