# Live Session State & Event Model

## Core principle

Maintain:

1. current materialized state for fast application queries, and
2. append-only historical events/status periods for reconstruction, reporting, and algorithm analysis.

Do not implement full event sourcing.

## Participant state

Statuses:

- `READY`
- `PLAYING`
- `RESTING`
- `AWAY`
- `OUT`
- `LEFT`

Example:

```text
19:03 CHECKED_IN        -> READY
19:18 MATCH_STARTED     -> PLAYING
19:52 MATCH_COMPLETED   -> READY
20:01 STATUS_CHANGED    -> RESTING
20:17 STATUS_CHANGED    -> READY
20:42 STATUS_CHANGED    -> AWAY
20:51 STATUS_CHANGED    -> READY
```

## Waiting-time semantics

Do not increment a DB counter every second.

Store status-period timestamps.

Current READY wait:
`now - current READY period started_at`

Historical eligible waiting:
sum duration of completed `READY` periods, plus current READY duration if applicable.

Important distinction:

- **current wait** = urgency since the most recent transition into READY.
- **total eligible wait** = reporting/history.

`RESTING` and `AWAY` stop eligible waiting. Returning to READY starts current wait from zero.

## PLAYING ownership

`PLAYING` is controlled by match commands, not manually set by the operator.

Starting a match:

- selected eligible players `READY -> PLAYING`.

Completing a match:

- active players `PLAYING -> READY`, unless another terminal/rest state applies.

## leave_after_match

Use:
`status = READY`
`leave_after_match = true`

After their next completed match:
`-> LEFT`

Do not create a `LAST_GAME` status.

## OUT vs LEFT

- `OUT`: still part of today's session but unavailable to play, e.g. injury/sickness.
- `LEFT`: finished/physically left.

Both are excluded from rotation.

Allow correction/reversal if needed, with event history retained.

## Session state

Keep minimal:

- `LIVE`
- `CLOSED`
- `CANCELLED`

Reopening:
`CLOSED -> LIVE`

Record close/reopen events.

## Match state

- `PREPARED`
- `IN_PROGRESS`
- `COMPLETED`
- `ABANDONED`

A prepared recommendation does not change player status.

Only `START MATCH` transitions players to PLAYING.

## Set state

- `IN_PROGRESS`
- `COMPLETED`
- `ABANDONED`

Only completed sets with valid scores affect rating.

## Events

Examples:

- `SESSION_STARTED`
- `PLAYER_CHECKED_IN`
- `PLAYER_STATUS_CHANGED`
- `ROTATION_RECOMMENDED`
- `ROTATION_OVERRIDDEN`
- `PAIRING_RECOMMENDED`
- `PAIRING_OVERRIDDEN`
- `MATCH_PREPARED`
- `MATCH_STARTED`
- `SET_COMPLETED`
- `PLAYER_SUBSTITUTED`
- `MATCH_COMPLETED`
- `MATCH_ABANDONED`
- `SESSION_CLOSED`
- `SESSION_REOPENED`

## Command model

Commands cause validated events/state transitions.

Example `startMatch`:

1. begin transaction,
2. verify session is LIVE,
3. verify caller owns active operator lease,
4. verify no other active match,
5. verify exactly four selected players are eligible,
6. create/update match,
7. close READY status periods,
8. open PLAYING periods,
9. update current participant states,
10. append event,
11. commit.

Server/Postgres is authoritative. Never trust UI-only validation.
