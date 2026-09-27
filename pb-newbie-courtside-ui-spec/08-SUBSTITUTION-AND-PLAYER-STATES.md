# Substitution & Player States

## Supported case

Substitution occurs between Set 1 and Set 2 because of tiredness/injury.

## Flow

1. `[ Substitute player ]`
2. choose outgoing player from current four,
3. choose replacement from READY players,
4. choose outgoing state:

```text
● Resting
○ Out for tonight
○ Left
```

Default RESTING. 5. confirm.

## Result

- Set 1 keeps original lineup.
- Set 2 uses replacement.
- replacement READY -> PLAYING.
- outgoing PLAYING -> selected state.
- event recorded.
- per-set stats/rating can distinguish participation.

## Status transitions outside match

Allow:

- READY -> RESTING/AWAY/OUT/LEFT
- RESTING/AWAY -> READY
- OUT/LEFT -> READY only as explicit correction/rejoin

Never allow manual assignment to PLAYING.

## Leave after next match

A READY participant can toggle `Leave after next match`. After their next completed match, transition automatically to LEFT.
