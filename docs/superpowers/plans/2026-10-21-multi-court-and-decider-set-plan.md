# Multi-court sessions and optional decider set — implementation plan

> **For implementation:** execute tasks in order, use the `superpowers:test-driven-development` workflow, keep migrations append-only, and verify each slice before moving on.

**Goal:** Add per-session court count with a shared READY pool and let admins choose a third set or end a 1–1 match.

**Architecture:** Preserve the existing SvelteKit → trusted server/data → domain logic → Postgres authority. Postgres commands remain the atomicity boundary for match starts, player status, set decisions, events and ratings. Add only append-only schema/functions and keep existing algorithm policy unchanged.

**Verification:** Focused unit and database/read-model tests first; then `npm run check`, `npm run test:unit -- --run`, `npm run test:e2e`, `npm run build`, and `npm run verify`. Use local fixtures/disposable database tests only. Do not create or alter deployed rows, apply a deployed migration, or perform financial operations.

## Task 1 — Add failing tests for court and set lifecycle invariants

**Files:** existing live controller/domain/UI specs and `src/lib/server/*.remote.spec.ts` or the repo's disposable database test fixtures.

- Add regression tests for one-court default, shared READY selection, different courts progressing independently, and stale concurrent starts never assigning the same player twice.
- Add lifecycle tests for Set 2 ending 1–1, Set 3 choice pending, starting Set 3 once, ending 1–1 once, and safe retry/error states.
- Add Set 3 assertions for substitutions, `leave_after_match`, ratings, corrections/replay, history projection and authorization.
- Keep tests behavior-oriented; do not assert implementation details like a specific helper's call sequence unless required for concurrency.
- Run the focused tests and confirm the new cases fail against current behavior.

## Task 2 — Add append-only schema and atomic multi-court commands

**Files:** new `supabase/migrations/<timestamp>_multi_court_and_decider_sets.sql`; disposable DB test setup.

- Add `sessions.court_count` (existing rows receive one) and a positive-court check.
- Add `matches.court_number`, backfill existing matches to court one, enforce the session court range, and replace the global active-match index with active uniqueness per session/court.
- Extend the set-number constraint to allow Set 3.
- Update session start command to accept/validate court count while retaining authorization and one-LIVE-session rules.
- Update `start_match` to take a court number, lock the session/eligibility snapshot, validate the court is free and the selected four remain READY, and atomically record the opportunity and mark participants PLAYING. Concurrent starts must serialize so their READY snapshots are consistent.
- Update complete-set lifecycle so Set 1 creates Set 2; decisive Set 2 closes the match as today; tied Set 2 leaves the match open with a pending decision; authorized idempotent commands either create Set 3 or close the tie/release its players.
- Permit existing substitution behavior between Set 2 and Set 3. Preserve event, status-period, `leave_after_match`, and rating transaction boundaries.
- Apply only to local/disposable PostgreSQL fixtures for verification. Do not apply the migration remotely in this task.

## Task 3 — Extend trusted score and rating operations through Set 3

**Files:** `src/lib/server/algorithm2-rating.ts`, relevant route handlers, new migration functions, related specs.

- Make score completion, correction, and deterministic forward replay support set number 3.
- Keep the same validation, authorization, idempotency, revision checks and rating algorithm. A completed decisive Set 3 records the same rating transitions as any other decisive set.
- Ensure a 1–1 match ended without Set 3 does not create an extra rating event or fake score.
- Test the whole trusted boundary with fixtures: accepted Set 3, correction/replay, duplicate requests, stale revisions, unauthorized requests and rollback.

## Task 4 — Expand server data and read models

**Files:** `src/lib/data/live.ts`, `src/lib/server/*`, `src/routes/api/*`, SQL views/read models and their tests.

- Replace the single `activeMatch` snapshot with an ordered list of active matches including their court numbers; include session court count.
- Load all live matches and all sets without `.limit(1)` assumptions.
- Update start/complete/skip/substitute/correction data operations to target a specific match/set/court while retaining authoritative server confirmation before showing success.
- Update history, public session reports, recaps, evaluation and summaries to render the actual set count and court number where relevant.
- Add read-model assertions for old one-court/two-set sessions and new multi-court/three-set sessions.

## Task 5 — Implement session start and multi-court live UX

**Files:** `src/routes/clubs/[clubId]/live/+page.svelte`, `src/lib/features/live/live-controller.svelte.ts`, `src/lib/components/live/LiveSessionPanel.svelte`, `src/lib/components/live/MatchCourt.svelte`, other affected components/specs.

- Add a session-start court-count control defaulting to one; validate a positive whole number and show the resulting court count before starting.
- Render independent court cards. A free court can use any four from the shared READY pool. On successful server start, refresh and remove selected players from the pool; on stale selection, show a clear retry path.
- Scope pending score and command states by match so activity on one court does not block unrelated courts.
- After Set 2 produces 1–1, show clear admin options to start Set 3 or end at 1–1 and make the court available for the next pairing. Keep players on court until that decision succeeds.
- Allow the existing between-set substitutions before Set 3 and show the actual lineup for every set.
- Preserve mobile layout, existing public read-only behavior, auth and algorithms. Add accessible labels/status announcements for save/decision feedback.
- Add UI/controller tests for independent court states, shared player pool and choice/retry behavior.

## Task 6 — Update documentation and run the complete local gate

**Files:** `AGENTS.md`, `docs/session-domain.md`, `docs/roadmap.md`, relevant algorithm/API docs and test records.

- Update the product invariant from one court to a session-configured count; document shared READY pool, court allocation, 1–1 decision and optional Set 3.
- Document that algorithm weights and policies did not change.
- Run focused tests after each task, then full repository checks: `npm run check`, `npm run test:unit -- --run`, `npm run test:e2e`, `npm run build`, and `npm run verify`.
- Run disposable database/read-model tests. Record blockers accurately; no credentials in output and no deployed DB operations.
- Review `git diff` for unintended changes and report any unresolved maximum-court product rule. Do not deploy or merge without a separate reviewed PR/authorization flow.

## Review checkpoints

- Before implementation: user approves this plan.
- Before any staging schema write: inspect exact staging target and migration history, then request the required explicit opt-in.
- Before merge or production release: prepare concrete PR/change summary and verification evidence for review.
