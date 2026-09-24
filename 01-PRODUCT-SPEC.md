# V1 Product Specification

## Product goal

Make a casual one-court badminton night easier to operate, fairer, more transparent, and more fun.

The app is primarily a **session orchestration tool**, not a ranking app.

## Core navigation

Recommended mobile navigation:

- Live
- Players
- History
- Fund

Club/settings can live behind a menu/profile/settings entry.

Do not create separate admin URLs. The same pages render additional controls based on capabilities.

## Live Session

The Live page is the primary surface during play.

Viewer sees:

- active match,
- teams,
- current set,
- waiting/ready/resting/away players,
- next recommendation when available.

Session Operator additionally sees:

- check-in controls,
- status controls,
- prepare/start match,
- rotation override,
- pairing swap,
- score entry,
- substitution,
- close/reopen session.

## Player states

Current participant status:

- `READY`
- `PLAYING`
- `RESTING`
- `AWAY`
- `OUT`
- `LEFT`

`leave_after_match` is a flag, not a separate status.

## Session lifecycle

1. A trusted person starts a session.
2. Session start timestamp is recorded immediately.
3. Operator checks players in as they arrive.
4. Before 4 players are ready, warm-up is informal and not recorded as a rated match.
5. At 4+ eligible players, Smart Rotation recommends four.
6. Rating/Pairing recommends teams for those four.
7. Operator may override selected players and/or swap teams.
8. Start match.
9. Record final Set 1 score only.
10. Continue immediately to Set 2.
11. A player may be substituted between sets because of tiredness/injury.
12. Record Set 2.
13. Finish match.
14. Players return to `READY` unless explicitly resting/out/left or `leave_after_match`.
15. Repeat.
16. Close session.
17. **Only after session ends**, set today's per-person fee. Suggest the most recent previous session fee; first session requires manual entry.
18. Generate attendance-based fee obligations.
19. Finance Admin handles actual payments/expenses separately.

## Session duration

Do not configure a default duration.

Derive:
`session duration = closed_at - started_at`

If reopening is supported, preserve close/reopen events so active-duration reporting can be refined later if needed.

## Warm-up

Warm-up before four players are ready:

- not a match,
- no rating update,
- no rotation opportunity,
- no payment distinction.

## Sets and substitutions

Normal match = 2 sets.

Players remain `PLAYING` for the entire match, including the transition between Set 1 and Set 2.

Substitution may occur between sets:

- outgoing player becomes `RESTING`, `OUT`, or `LEFT` as selected,
- incoming `READY` player becomes `PLAYING`,
- Set 2 lineup reflects the actual four players,
- ratings/statistics update per completed set, so the substitute only receives Set 2 participation.

## Guests

Guest player can be added for the current session:

- name,
- approximate initial skill level,
- high rating uncertainty.

Use the same `players` entity with a membership marker rather than a separate guest identity model.

Suggested:

- `MEMBER`
- `GUEST`

Guests:

- participate normally,
- can have rating/history,
- can owe the session fee,
- remain in historical records,
- do not appear in the normal active member roster by default.

If a guest becomes regular, promote `GUEST -> MEMBER`; preserve all history and rating.

## Reports and fun layer

V1 eventually includes:

- attendance/session recap,
- set W/L,
- player details,
- rating and today's rating movement,
- session history,
- finance summary,
- WhatsApp-shareable summary,
- shareable image/card inspired by game character/build summary cards.

Fairness diagnostics are primarily for the algorithm/developer and do not need to be publicly shown.

## Finance timing

Fee is **not** requested at session start.

At session close:

- suggest last session's fee,
- operator confirms/changes today's fee,
- create obligations for attendees.

Payment processing is Finance Admin territory.

## Product principle

Store facts; derive statistics.

Examples of stored facts:

- timestamps,
- participant status periods,
- completed sets and scores,
- lineups,
- payments,
- allocations,
- expenses,
- rating history.

Examples of derived values:

- session duration,
- sets played,
- W/L,
- win rate,
- eligible waiting,
- current waiting,
- club balance,
- frequent partners/opponents.
