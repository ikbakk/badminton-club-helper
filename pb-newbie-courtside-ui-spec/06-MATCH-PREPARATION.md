# Match Preparation

## Trigger

No active match + at least 4 READY:
`[ Prepare next match ]`

M0 must work manually before Smart Rotation.

## Select four

```text
Prepare next match

Choose 4 players

☐ Sarah      READY • 18m
☐ Budi       READY • 14m
☐ Nisa       READY • 9m
☐ Iqbal      READY • 4m
☐ Fajar      READY • 2m

3 / 4 selected

[ Continue ]
```

Continue enabled only at exactly four.

When Algorithm 1 arrives, preselect recommended four but preserve manual replacement.

## Teams

```text
TEAM A
Sarah
Iqbal

    VS

TEAM B
Budi
Nisa

[ Swap players ]
[ Start match ]
```

For M0 manual/simple assignment is acceptable. Later Algorithm 2 recommends the split.

Avoid drag-and-drop as the only control. Tap-to-swap is safer on phones.

## Cancel/back

Before start, operator can change selection/teams or cancel. No player becomes PLAYING merely because a match is PREPARED.

## Start transaction

Server revalidates session LIVE, valid lease, exactly four eligible players, no active match. Atomically start match, move selected READY -> PLAYING, close/open status periods, create Set 1, preserve opportunity inputs/events.
