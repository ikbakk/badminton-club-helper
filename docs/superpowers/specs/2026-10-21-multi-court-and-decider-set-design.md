# Multi-court sessions and optional decider set

## Status

Design draft for review. No product code or database schema has changed.

## Goal

Let a club choose how many courts a session uses, allow any eligible READY players to be assigned to any free court, and let an admin decide whether a 1–1 match continues to a third set or ends so the session can move to the next pairing.

## Current behavior and constraints

- Sessions are modeled as one-court; `LiveSessionSnapshot` and the live page expose a single `activeMatch`.
- `start_match` rejects any other in-progress match in the session, selects four READY players, records one rotation opportunity, and changes those players to PLAYING atomically.
- A match has two set rows at most. Completing set 2 closes the match and releases its players.
- Algorithm 1 recommendations are advisory. Actual selected players, rotation events, and per-set lineups are authoritative.
- Algorithm 2 records rating changes for each decisive completed set. Do not alter ranking weights, selection rules, or pairing semantics.

## Proposed user experience

1. At session start, the admin selects a court count. Default to one for existing use. The count belongs to that session.
2. The live view displays that many court cards. A free court is available to any next four READY players; no court owns a fixed group. Selecting players for one court immediately removes them from the shared READY pool when the server accepts the match.
3. Each court displays its own current match, set and score state. Multiple courts may be active at once. Pairings still come from Algorithm 2 for four players selected by the existing Algorithm 1 process.
4. Once Set 2 is confirmed, if its score makes the match 1–1, keep the court and four players occupied and ask the admin to choose **Lanjut Set 3** or **Akhiri 1–1 dan lanjut ke pairing berikutnya**. The set of players may be changed using the existing between-set substitution rules before Set 3 starts. If the admin ends 1–1, close that match, release its players according to `leave_after_match`, and make the court available for any READY players.
5. Set 3 uses ordinary set-score entry and rating persistence. History, public read models, recaps and evaluation data render the actual number of sets rather than assuming exactly two.

## Domain and persistence design

- Add a positive `court_count` to sessions, captured when the session starts and immutable while the session is live. Existing rows default to one.
- Add `court_number` to matches, scoped to its session. It identifies the court occupied by that match; it does not identify a player group.
- Replace the global one-active-match-per-session constraint with one-active-match-per-court. Enforce valid court numbers against the session count.
- Allow set numbers 1–3. Preserve uniqueness of `(match_id, set_number)` and actual `set_players` lineups per set.
- Keep a match open after a completed Set 2 tied 1–1, with no in-progress set, so the authoritative database state represents the admin decision pending. Add an authorized atomic command to create Set 3, and another to end the tied match and release its players. Retrying either command must not create duplicate sets or close a match twice.
- Extend between-set substitution, score correction, and deterministic rating replay paths to support Set 3 without changing their existing semantics for Sets 1 and 2.
- Preserve current status/event rules, authorization, rating replay, session-close, and `leave_after_match` behavior. Only a decisive completed set updates ratings, using the existing algorithm.
- Update all session and match read models, history, public reports, recaps, and session evaluation to include `court_count`, `court_number`, all active matches and all sets. Do not rely on realtime notifications as proof of a successful write.

## Fairness and concurrency

- Every actual match start remains one rotation opportunity for all players READY at that point; the four server-accepted selected players receive it.
- Match starts from separate courts must serialize their authoritative READY snapshot and participant status updates. Two concurrent starts must not select a shared player or record inconsistent opportunities. The UI may recommend from a snapshot, but the start command validates against current database state and fails safely when stale.
- The READY pool is session-wide and shared across all courts. A player can play on any court after becoming READY; there are no court-specific queues or reserved groups.
- Preserve all existing rotation and pairing weights, tie-breakers, and semantics.

## Failure and recovery behavior

- If another court start wins a race, refresh authoritative session state and let the admin choose again; do not infer that the attempted match started.
- While the Set 3 decision or command is pending, disable duplicate submissions. On failure, keep the 1–1 decision prompt visible and allow a safe retry after refresh.
- If a command response times out, reload the authoritative match before retrying.

## Scope

Included: session start court selection, session-wide player pool, multiple concurrent active court cards, 1–1 Set 3 decision, existing set substitutions, persistence/read models/history/evaluation updates and focused tests.

Not included: automatic scheduling or assigning player groups to courts, algorithm tuning, changing public payment configuration, deployed data edits, or production migration application.

## Verification plan

- Domain/controller/UI tests: default one court; any READY player can be selected on any free court; concurrent/stale selection cannot put one player on two courts; independent court state; 1–1 decision options; skip releases eligible players; Set 3 retains/substitutes actual lineup; error/retry states.
- Database/read-model tests: session court count, per-court active uniqueness and bounds, serialized starts, idempotent Set 3/skip commands, status/event consistency, authorized access, dynamic set projection, and rating persistence/correction for a decisive third set.
- Existing unit, check, build, verify and disposable database tests. Use local fixtures or isolated test infrastructure only. No deployed database changes or financial operations.

## Open product detail

The initial experience will default to one court. No club-level maximum court preference exists in the inspected schema. The UI should validate a positive whole number; choose a sensible upper bound only if product has a known operational limit, otherwise avoid inventing a club capacity in this change.
