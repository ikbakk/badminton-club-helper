# Implementation Milestones

Build vertical slices. Every milestone should leave the application usable.

## M0 — Playable Core

Goal: take the app to badminton and operate a session manually.

Build:

- SvelteKit project,
- Supabase project/database,
- basic schema/migrations,
- club record,
- player roster,
- member/guest identity basics,
- start session,
- session PIN/basic operator mechanism sufficient for development,
- check-in,
- statuses,
- manually choose four,
- manually assign teams,
- start match,
- 2 sets,
- final score entry only,
- between-set substitution,
- finish/abandon match,
- close/reopen session,
- session history,
- event/status-period collection from day one.

No Smart Rotation.
No production rating algorithm.
No finance ledger beyond what is necessary for schema progression.

Acceptance: a real club night can be recorded end-to-end.

## M1 — Courtside Reliability

Build:

- final Session Operator PIN semantics,
- exactly one active device lease,
- takeover flow,
- lease invalidation,
- TanStack Query,
- Live Realtime invalidation,
- reconnect/refetch,
- read-only offline behavior,
- targeted corrections,
- stronger event logging,
- transactional commands and invariants.

Acceptance: phone death/refresh/operator handoff does not lose the session.

## M2 — Smart Rotation

Build:

- opportunity tracking,
- missed-opportunity/rotation-debt inputs,
- current READY wait,
- consecutive-match handling,
- fill-in context,
- pure Algorithm 1 module,
- recommendation UI,
- replace-player override UI,
- diagnostics/versioning,
- simulation harness/tests,
- preserve recommendations and overrides.

Do not freeze arbitrary weights before simulation.

Acceptance: recommendations can be compared against manual operator choices.

## M3 — Rating & Pairing

Build:

- rating + uncertainty model,
- human-friendly initial level,
- rating history,
- pure pairing evaluator for three 2v2 partitions,
- Algorithm 2 simulator,
- compare Team Elo vs TrueSkill-style vs bounded-margin variant,
- select/version production model,
- pairing recommendation,
- swap override,
- manual admin rating correction.

Acceptance: established players remain stable, newcomers calibrate, selected-four pairing feels balanced.

## M4 — Finance

Build:

- post-session fee selection,
- previous-session fee suggestion,
- obligations,
- Finance Admin auth/capability,
- payments,
- allocations,
- debt,
- prepayment/credit,
- court/shuttlecock/other expenses,
- finance submissions,
- accumulated club fund,
- private vs public finance views.

Acceptance: weekly money can be reconciled without manual PDF bookkeeping.

## M5 — Reports & Fun

Build:

- player details,
- set W/L,
- today's rating movement,
- attendance/session report,
- session history details,
- finance recap,
- WhatsApp share,
- shareable recap image/card.

Do not make leaderboard/ranking the central product.

## M6 — Polish & Operations

Build:

- guest -> member promotion,
- mobile UX polish,
- accessibility,
- loading/error/empty states,
- maintenance/availability check roughly every 2 days,
- failure visibility,
- backup/export plan,
- deployment hardening,
- security/RLS review,
- performance sanity checks.

## Development principle

Collect real event data starting in M0.

Do not wait for M2/M3 to begin recording the information needed to evaluate the algorithms.
