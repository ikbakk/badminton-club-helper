# Real-session validation

The evaluation is post-session reporting, not live recommendation input or automatic tuning. Admin-only evaluation uses persisted recommendations, events, actual lineups, corrected scores, status periods, and rating history. The endpoint requires Club Admin authority and returns private, no-store JSON; the admin can export its JSON response. Public history remains a separate public-safe surface. Evaluation/export excludes payment data, auth metadata, and raw rating uncertainty.

## Metrics and interpretation

- Rotation override: recommended and actual four differ (order ignored). Actual selection at match start is ground truth.
- Pairing override: recommended and actual Set 1 team partitions differ; swapping team A/B labels is not an override.
- Actual pairing gap: calculated from the persisted pairing diagnostics option matching the actual Set 1 team partition. If that option/diagnostic is unavailable, the actual gap is JSON `null`; do not interpret missing data as a zero gap. Mean actual gap is based only on available values.
- Starvation: a player had at least one recorded READY opportunity and zero full rotation starts before the review boundary. A Set 2 fill-in is not a full rotation.
- READY wait: only READY periods count. Coverage must span check-in through session close without material gaps and include a final end; otherwise status is `INCOMPLETE`, wait values are JSON `null`, and `READY_WAIT_INCOMPLETE` is raised. Missing periods are never inferred. Maximum wait is the longest continuous READY period.
- Score margin uses the current corrected completed-set score. Close set means margin ≤3; blowout means margin ≥10. These are observations, not quality labels.
- Review flags include `READY_WAIT_INCOMPLETE`, starvation, maximum wait ≥45 minutes, rotation-count spread >2, pairing override rate >40%, blowout share >35%, and current debt ≥4. Close sets use margin ≤3; blowouts use margin ≥10. Flags are descriptive review prompts and do not alter production behavior.

## Sample and debrief

Review **3–5 actual sessions** before proposing any change to thresholds, weights, or model constants. The current phase is validation, not algorithm tuning. For each session capture externally:

1. Did rotation feel fair?
2. Did pairing feel balanced?
3. What part of the courtside flow caused friction?

Compare those observations with starvation, wait, rotation spread, overrides, score outcomes, and newcomer rating movement. An override does not prove an algorithm is wrong; a close set does not prove ratings are accurate; one session is insufficient to retune. The evaluator does not automatically update either algorithm.
