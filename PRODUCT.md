# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Club members open a public link to understand the current court state immediately.
- A Club Admin uses a phone courtside to check players in and run a one-court badminton session.
- Club and Finance Admins manage the roster, session setup, attendance payments, and finance.

## Product Purpose

PB NEWBIE is a mobile-first helper for a casual one-court badminton club. It makes a real club night runnable end-to-end: check in players, choose a doubles match, record two sets, handle between-set substitutions, repeat, then close the session and confirm its fee.

## Positioning

The product is a public, live courtside view that becomes writable after an Admin signs in with their account; session PINs and rotating operator leases are not part of the workflow.

## Operating Context

- A session is operated on a phone at the side of one badminton court, often while the operator is also playing.
- Viewer mode is public and read-only; Club Admins sign in to make session changes from any device.
- The core loop is check in, prepare four players, play Set 1, optionally substitute, play Set 2, then prepare the next match.
- Smart Rotation and team-pairing algorithms augment the existing prepare flow later; manual selection and assignment are required now.

## Capabilities and Constraints

- SvelteKit, TypeScript, Supabase/Postgres, TanStack Query, and thin Realtime invalidation are the confirmed stack.
- One court, one live session, one active operator device, two normal sets per match, and only between-set substitutions.
- Fee appears only after a session is closed; admins confirm the per-person fee and track payment against that session's attendance list.
- Public viewers may see attendance and per-attendee payment status in closed-session history as color-only indicators with a legend; balances, credentials, algorithm diagnostics, and rating uncertainty remain private.
- No RSVP, self check-in, multiple courts, tournament mechanics, payment gateway, chat, or leaderboard-centered experience in V1.

## Brand Commitments

- The club name is PB NEWBIE.
- The interface is Indonesia-first.
- The product must feel like a casual community badminton club, not an overly formal corporate tool or a gamified sports app.

## Evidence on Hand

- Product and flow specifications: `00-START-HERE.md` through `12-OPEN-DECISIONS.md`.
- Courtside UX implementation pack: `pb-newbie-courtside-ui-spec/00-START-HERE.md` through `14-ACCEPTANCE-SCENARIOS.md`.
- The repository has a working SvelteKit courtside slice with live state, check-in, manual match operation, and test coverage.
- No approved visual system, logo, photography, or other brand assets are currently supplied.

## Product Principles

- Live is the default and dominant surface; the next safe action is obvious.
- Preserve the admin's courtside context: use sheets and focused, short decision steps rather than an administration tree.
- Make current court state legible at a glance, then make frequent actions fast and low-risk.
- Viewer and operator share one source of truth and one screen; capabilities add affordances rather than separate information architecture.
- Algorithms assist manual human decisions instead of creating a parallel workflow.

## Accessibility & Inclusion

- Design for one-handed mobile use with approximately 44px or larger touch targets.
- Communicate participant status with text as well as color.
- Keep score entry, team labels, dialogs, feedback, and read-only/offline states explicit and understandable.
