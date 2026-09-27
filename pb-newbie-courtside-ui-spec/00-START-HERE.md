# PB NEWBIE — Courtside UI / UX Implementation Pack

## Purpose

This pack is the next implementation handoff. The database/auth/bootstrap already works. Do not rebuild it.

## Preserve current state

- Supabase connected and club `PB NEWBIE` exists.
- One `CLUB_ADMIN` exists.
- A `LIVE` session currently exists.
- Public-safe views, core tables, events, participant status periods, ratings, finance, leases, constraints, and hashed session PIN support exist.
- Public viewing requires no account.
- Admin auth is email + password only.
- Public nav: Live / Players / History / Fund.
- Permanent roster creation and session creation already work.

## Immediate objective

Make an existing LIVE session playable:

1. claim/resume operator control,
2. check players in,
3. manage availability,
4. prepare four players,
5. assign teams,
6. play two sets,
7. substitute between sets,
8. complete/abandon match,
9. repeat,
10. close session,
11. confirm post-session fee.

## UX contexts

- **Viewer:** public/read-only.
- **Session Operator:** temporary courtside authority via session PIN; exactly one active operator device.
- **Permanent Admin:** authenticated club/finance authority. Admin login does not automatically grant the operator lease.

## Mobile-first rule

On a phone, the operator should answer within seconds: Who is playing? Who is waiting? Who is unavailable? What happens next? What score must I enter?

## Read order

Read files `01` through `14` in numeric order.

## Scope warning

Do not block courtside operation on Smart Rotation or production rating algorithms. Until those exist, manual four-player selection and manual team assignment must work cleanly.
