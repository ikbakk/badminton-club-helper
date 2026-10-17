# Architecture

## Current authority model

- Public visitors can read public-safe club, roster, live-session, and history views; they cannot write.
- Authenticated `CLUB_ADMIN` users are the only application write authority. There is no active Session Operator, PIN, device lease, takeover, or separate Finance Admin authority.
- Some legacy lease/audit schema may remain for historical referential integrity. It does not grant authority.

## Public entry and club context

The product landing page is independent of club data. Organizers create or open their own club at `/start`; public viewers use explicit `/clubs/[clubId]/...` links. Club identities scope navigation, query snapshots, history, and fund reads. See [Public product entry](public-product-entry.md) for release prerequisites and verification.

## Stack and boundaries

- SvelteKit, Svelte 5, TypeScript, Supabase/Postgres, TanStack Query, and Supabase Realtime invalidation.
- Pure deterministic domain logic lives under `src/lib/domain/`; authenticated server routes validate identity/role and coordinate trusted database operations.
- Critical state changes run through transactional Postgres functions or trusted server-side commit/replay operations. Browser code does not directly mutate database tables.
- Public-safe read models are separate from private admin diagnostics and finance records. Evaluation endpoints are Club Admin-only and `private, no-store`.

## Persistence

Postgres stores current materialized session state alongside append-only session events and participant status periods. This is not full event sourcing: current rows serve normal queries while events and periods provide audit/reconstruction evidence. Supabase migrations are in `supabase/migrations/`; apply linked migrations with `npx supabase db push`.

## Failure and concurrency

Commands must validate current state and caller authority server-side. Transactional mutations either commit all related lifecycle/event/lineup changes or none. Rating completion additionally locks and validates authoritative actual lineup and rating revisions; stale input must fail for reload/recompute rather than partially commit. Realtime is an invalidation signal, not authority.

## Verification

Run `npm run verify` for formatting/lint, Svelte checks, unit and Playwright tests, and production build. Remote Supabase checks require a linked project and credentials; do not assume local Supabase is configured.
