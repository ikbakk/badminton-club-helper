# Algorithm 1 — Smart Rotation

## Responsibility and eligibility

Recommend which four players play next; it does not form teams. Only READY participants are candidates. The algorithm is deterministic domain logic in `src/lib/domain/rotation/`; persisted fairness state is reconstructed from trusted match-start history.

## Production policy

Priority combines current consecutive opportunity debt, current READY wait, participation deficit, and consecutive-play protection:

```text
100 × current opportunity debt
+ 1 × READY wait minutes
+ 8 × max(0, lowest READY set count + 2 − candidate set count)
− consecutive-play penalty
```

An explicit `SHOULD_PLAY` tier applies at current debt **≥ 4** or continuous READY wait **≥ 45 minutes**. Tier ordering precedes score ordering. Within tiers, candidates sort by priority and stable player ID. A third consecutive rotation is excluded/deprioritized when at least four alternatives exist; if fewer than four rested READY candidates exist, the pool falls back to include them.

Selected candidates' debt resets at the actual start; unselected READY candidates accrue a missed opportunity. Overrides change actual selection and therefore fairness state. RESTING/AWAY/OUT/LEFT/PLAYING do not accrue opportunities. Set 2 substitutions are not full rotations.

## Authority and explainability

The recommendation is advisory. The authorized `start_match` transaction writes `ROTATION_STARTED` using READY IDs and actual selected IDs; client-supplied diagnostics do not determine server fairness state. Explanations emphasize fairness debt, waiting urgency, and consecutive-play protection; raw scores are internal diagnostics.

## Verification and operational review

Pure TypeScript unit/property/simulation coverage and database smoke coverage verify deterministic selection, fairness reconstruction, overrides, status exclusion, and transactional rollback. The production policy has passed deployed database smoke and application verification (documented in repository history; no separate report is maintained here).

Track starvation, current debt, maximum continuous READY wait, rotation spread, and override rate in [real-session validation](real-session-validation.md). Review 3–5 actual sessions before changing constants; override or close-score observations alone do not prove the algorithm is wrong.
