# Session domain

## Lifecycle

- A club has at most one `LIVE` session. Session states are `LIVE`, `CLOSED`, and `CANCELLED`.
- Matches move through `PREPARED`, `IN_PROGRESS`, `COMPLETED`, or `ABANDONED`; sets are `IN_PROGRESS`, `COMPLETED`, or `ABANDONED`.
- A normal match has two sets. Only completed sets with a decisive valid score update ratings. Substitution is between sets; actual `set_players` per set are authoritative.

## Participants

Statuses: `READY`, `PLAYING`, `RESTING`, `AWAY`, `OUT`, `LEFT`. Match commands control `PLAYING`; eligible rotation candidates are READY only. RESTING/AWAY time does not accrue READY waiting or rotation opportunities. Returning to READY starts a fresh wait period. `OUT` means present but unavailable; `LEFT` means departed. `leave_after_match` is a READY participant instruction, not a separate status.

## Fairness and history

A rotation opportunity is recorded at each actual match start for every participant READY at that point. The four actually selected players—not the recommendation—receive the opportunity; skipped READY participants accrue missed opportunity/current debt. Set 2 fill-ins count as actual set participation, not a full rotation. `ROTATION_STARTED` snapshots and status periods support reconstruction and admin evaluation.

## Commands and authority

Public is read-only; only Club Admins can mutate session state. Starting a match, completing a set, substitution, status changes, and session close must preserve atomic lifecycle/event consistency. Recommendations are advisory and may be overridden; persisted actual match/set lineups are the source of truth.

## Recovery

On stale state or command failure, reload authoritative state and retry only when the command remains valid. Never infer successful mutation from a client response timeout or Realtime event alone. Rating corrections use deterministic forward replay; see [Algorithm 2](algorithm-2-rating-pairing.md).
