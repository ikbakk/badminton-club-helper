# Badminton Club Web App — Coding Agent Pack

## Purpose

Build a mobile-first web app that helps a small casual badminton club run a single-court session fairly and with minimal friction.

This is a **helper tool**, not a monetized SaaS product. Optimize for:

- fast courtside operation,
- fairness of rotations,
- balanced doubles,
- simple financial transparency,
- low-friction read-only access,
- recoverability when the operator changes phones.

Do not expand scope without an explicit product decision.

## Product context

Typical session:

- 1 court.
- Roughly 9–14 players.
- Around 3 hours, but duration is **not configured**. It is derived from session start/close timestamps.
- Beginner / low-intermediate level.
- Doubles only.
- Usually 2 sets per match/rotation.
- A player can sometimes play twice consecutively.
- Normally avoid a third consecutive match unless other eligible players are unavailable/resting.
- Players may arrive late, rest, go away temporarily, leave early, or substitute after Set 1.
- There is no RSVP workflow.
- There is no rally-by-rally scoreboard.
- There is no tournament, coaching, or court-reservation feature.

## Technical direction

Current preferred stack:

- SvelteKit + TypeScript
- Supabase / PostgreSQL
- Supabase Auth for permanent authenticated authorities
- TanStack Query for server-state fetching/cache
- Supabase Realtime only as a thin invalidation/synchronization signal for Live Session
- Server-authoritative commands and PostgreSQL transactions
- Mobile-first web UI
- External scheduled maintenance/availability check roughly every 2 days to detect backend failure and reduce free-tier inactivity risk
- No fake sessions or fake weekly activity records as keep-alives

## Read order for coding agents

1. `01-PRODUCT-SPEC.md`
2. `02-LIVE-SESSION-STATE-MODEL.md`
3. `03-AUTH-AND-PERMISSIONS.md`
4. `04-DATA-MODEL.md`
5. `05-ALGORITHM-1-SMART-ROTATION.md`
6. `06-ALGORITHM-2-RATING-PAIRING.md`
7. `07-FINANCE.md`
8. `08-FRONTEND-DATA-AND-REALTIME.md`
9. `09-FAILURE-RECOVERY.md`
10. `10-IMPLEMENTATION-MILESTONES.md`
11. `11-AGENT-GUARDRAILS.md`

## Critical separation of responsibilities

- **Algorithm 1 — Smart Rotation:** decides _which four eligible players should play next_.
- **Algorithm 2 — Rating & Pairing:** given exactly those four players, estimates skill and recommends balanced teams.
- Algorithm 2 must **never replace a player selected by Algorithm 1**.
- Finance authority is separate from session-operation authority.
- Player identity is separate from authenticated user identity.

## V1 scope boundary

Explicitly out of scope:

- multiple courts,
- RSVP,
- self check-in,
- native Android/iOS app,
- ML,
- playstyle inference,
- rally-by-rally scoring,
- tournament management,
- coaching,
- court booking,
- chat/social feed,
- payment gateway/bank verification,
- sophisticated leaderboards,
- charts/dashboard-heavy analytics.

**MULTIPLE COURTS IS OUT OF SCOPE FOR V1.**
