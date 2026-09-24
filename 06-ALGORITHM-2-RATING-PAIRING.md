# Algorithm 2 — Rating & Balanced Pairing

## Responsibility

Given exactly four players selected by Algorithm 1:

1. maintain individual skill estimates,
2. recommend the most balanced 2v2 team split.

Algorithm 2 must never substitute a different player into the selected four.

## Available evidence

Per completed set:

- four actual players,
- two teams,
- final score,
- win/loss,
- player rating estimate,
- player uncertainty.

Not available:

- rally sequence,
- individual point contribution,
- smash/defense/playstyle stats,
- unforced errors,
- serve stats.

Do not infer unavailable playstyle information.

## Rating semantics

Each player has:

- skill estimate,
- uncertainty/confidence.

Established players should be relatively stable.
New/high-uncertainty players should move faster.

This directly addresses bad-day behavior: one poor set/night should not collapse an established player's long-term estimate.

## Initialization

Admin chooses an approximate human-friendly level, e.g.:

- Beginner
- Low Intermediate
- Intermediate

Map to numerical starting estimate + **high uncertainty**.

Exact scale values are not frozen.

## Manual correction

Club Admin may correct a rating estimate.

Requirements:

- record as `MANUAL_RATING_ADJUSTMENT`,
- preserve before/after,
- do not rewrite history silently,
- consider increasing uncertainty because the previous estimate was judged unreliable.

## Update unit

Update ratings **per completed set**, not per match.

Substitution example:

- Player B plays Set 1 only -> receives Set 1 update only.
- Player E substitutes for Set 2 -> receives Set 2 update only.

`IN_PROGRESS` and `ABANDONED` sets do not affect rating.

## Score margin

Win/loss is primary evidence.

Final score margin may be bounded secondary evidence:

- 21–19 should communicate less mismatch evidence than 21–10,
- 21–5 must not create absurdly large rating movement.

Classic TrueSkill does not directly use score margin, so margin-aware behavior is experimental.

## Pairing four selected players

There are only three unique doubles partitions:

```text
A+B vs C+D
A+C vs B+D
A+D vs B+C
```

Evaluate all three.

Primary objective:

- expected match balance.

Secondary/soft objectives:

- partner variety,
- opponent variety.

Do not sacrifice a materially better-balanced match just for variety.

## Candidate rating systems to simulate

1. Team Elo baseline.
2. Classic TrueSkill-style team rating.
3. TrueSkill-style rating with bounded score-margin modification.

Do not choose by prestige; choose by observed behavior.

## Simulation scenarios

At minimum:

- established player has one terrible night,
- newcomer starts too high,
- newcomer starts too low,
- stronger expected team loses unexpectedly,
- repeated close sets,
- repeated blowouts,
- partners mix frequently,
- two players partner together repeatedly,
- substitution between sets,
- manual rating adjustment.

Evaluate:

- convergence speed,
- stability of established players,
- newcomer calibration,
- sensible doubles inference,
- predicted match balance.

## Information limitation

Doubles results identify team performance, not precise individual contribution.

If two players always partner together, individual skill separation is weak.

Frequent partner mixing improves inference. The club's natural mixed-pair behavior is beneficial.

## Implementation direction

Keep pure/testable modules:

```text
src/lib/domain/rating/
src/lib/domain/pairing/
```

Version every production algorithm so rating history and recommendation diagnostics remain interpretable.
