# Algorithm 1 — Smart Rotation

## Responsibility

Select **which four players should play next**.

It does not create teams. Algorithm 2 handles pairing after the four are selected.

## Eligibility

Primary eligible state:
`status = READY`

Exclude:

- PLAYING
- RESTING
- AWAY
- OUT
- LEFT

## Why raw waiting minutes are insufficient

Match duration varies significantly.

Waiting through one 12-minute match and one 31-minute match are both structurally one missed court opportunity, even though wall-clock waiting differs.

Therefore:

- **rotation opportunities measure fairness**
- **real waiting time measures urgency**

## Opportunity unit

A rotation opportunity occurs once per **match start**, not per set.

For each player who is READY when a new match starts:

- selected for the match -> received opportunity,
- not selected -> missed opportunity.

Do not create opportunities for informal warm-up.

## Signals to retain

For each player, Algorithm 1 may consume:

- eligible rotation opportunities,
- missed opportunities / rotation debt,
- full rotations played,
- current READY waiting time,
- consecutive matches/rotations,
- sets played,
- fill-in participation,
- late-arrival context derived from opportunity eligibility.

## Late arrivals

Do not prioritize a new arrival merely because they have 0 sets.

A player who just became READY has had few/no eligible opportunities.

Fairness must be based on opportunities available while eligible, not raw session-wide set count.

## Consecutive play guardrail

Normal rule:

- maximum 2 consecutive matches.

Implementation behavior:

1. normal candidate pass excludes/deprioritizes players with `consecutive_matches >= 2` if at least four other READY candidates exist,
2. fallback pass allows them if needed to fill four slots.

This supports rare cases where others are RESTING/AWAY and someone must play a third time.

## Waiting-time urgency

Current READY waiting time is a secondary/urgency signal.

Do not blindly use strict lexicographic debt ordering if it can cause unreasonable human waiting.

Potential future guardrail:

- if current wait exceeds a data-informed threshold, elevate priority.

Do not freeze the threshold before observing real sessions.

## Fill-ins

A player substituted into only Set 2 did not receive a normal full two-set rotation.

Record actual set participation and a fill-in marker/context.

Exact debt repayment effect is intentionally **unfrozen** and should be determined by simulation and real-session behavior.

## Explainability

User-facing recommendation explanation should remain simple:

- participation fairness,
- waiting priority,
- consecutive-play protection.

Do not show raw internal priority decimals to normal users.

## Override logging

If operator replaces one of the recommended four:

- record `ROTATION_OVERRIDDEN`,
- preserve original recommendation and candidate diagnostics,
- preserve actual selected four.

This data is for offline/developer analysis, not in-app AI/ML.

## Formula status

**Do not freeze an arbitrary weighted formula yet.**

Build Algorithm 1 as a pure TypeScript module with versioned diagnostics and simulation tests.

Suggested API:

```ts
recommendRotation({
  participants,
  currentTime,
  opportunityHistory,
  recentMatches
}) => {
  selectedPlayerIds,
  ranking,
  diagnostics,
  algorithmVersion
}
```

Use simulations and real override history to choose debt repayment/scoring behavior.
