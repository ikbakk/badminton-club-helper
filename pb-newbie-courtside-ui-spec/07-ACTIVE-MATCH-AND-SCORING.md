# Active Match & Scoring

## No rally counter

Record final set scores only.

## Active screen

```text
MATCH 4                           LIVE ●

TEAM A
Sarah + Iqbal

      VS

TEAM B
Budi + Nisa

SET 1

Team A score
[ 21 ]

Team B score
[ 17 ]

[ Complete Set 1 ]

[ Abandon match ]
```

Use large numeric fields.

## Validation

At minimum:

- non-negative integers,
- completed set cannot tie,
- reasonable accidental-input upper bound without overfitting official rules.

## After Set 1

```text
SET 1 COMPLETE
21–17

[ Start Set 2 ]
[ Substitute player ]
```

There is no formal rest between sets; players remain PLAYING.

## Set 2

Same final-score entry.

After valid Set 2, complete the match with minimal extra tapping. Completed match returns eligible active players to READY and opens new READY periods.

## Abandon

Require confirmation:

```text
Abandon this match?

Completed sets remain in history.
The incomplete set won't affect ratings.

[ Keep playing ] [ Abandon match ]
```

## Correction

Recently completed set:
`[ Correct score ]`

Corrections must be auditable. Once ratings exist, score correction must reconcile/recompute rating history rather than silently changing a result.
