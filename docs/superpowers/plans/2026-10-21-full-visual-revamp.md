# Courtside Full Visual Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Apply the approved three-screen visual system to every existing Courtside surface.

**Architecture:** Keep existing Svelte component APIs, routes, query behavior and domain logic. Establish shared visual tokens and small presentational primitives first; update existing pages using these contracts. Read the newest main before implementation and preserve the recent auth fixes.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Tailwind 4, Lucide, existing sve-ui and TanStack Query.

**Spec:** docs/superpowers/specs/2026-10-21-full-visual-revamp.md

## Global constraints

- Forest ink #163630, chalk #fffaf0, ground #f4f1e8, muted green #38675b, clay #e2653e; #0c241f text on clay.
- Controls have 6px corners; panels and sheets have 10px corners.
- Touch targets at least 44px; normal text contrast at least 4.5:1, large text at least 3:1.
- Existing domain logic, server/data interfaces, authorization and auth fixes remain intact.
- No database migrations, fake statistics, new integrations or per-point score persistence.
- User reviews the implemented visual result before a separately authorized merge.

## Review focus

- Long player and club names must not hide navigation, scores or actions at 360px.
- Public viewers must never gain admin controls through a shared component.
- Pending/auth/error states must preserve user input and truthful existing data.
- Between-set substitutions and manual rotation/pairing overrides must remain operable.
- Landing previews must be clearly illustrative, read-only and make no backend requests.

## Task 1: Shared visual system and shell

**Files:** src/routes/layout.css; src/lib/components/ui/AppButton.svelte; AppShell.svelte; CourtDialog.svelte; CourtSheet.svelte; LoadingSkeleton.svelte; QueryNotice.svelte; MultiSelect.svelte; static/fonts/; DESIGN.md; scoped design sidecar.

**Interfaces:** Preserve every existing prop and callback. New presentational primitives may accept Svelte Snippet children, class and named visual variants; they must not fetch data or decide permissions.

- [x] Read the spec, current PRODUCT.md/DESIGN.md and shared components; capture incumbent states using existing fixtures.
- [x] Add self-hosted licensed Manrope fonts and semantic tokens; preserve existing Barlow Condensed for landing headings.
- [x] Restyle shared controls, fields, sheets, notices and skeletons. Use safe-area-aware bottom mobile navigation and keep admin settings/account/share accessible.
- [x] Extend public-entry/supporting-page E2E with 360px long-name navigation and keyboard-focus assertions, and assert viewer pages have no admin write controls.
- [x] Run npm run check and the affected E2E files. Inspect shell states and commit the coherent shared-system change.

## Task 2: Live match and participants

**Files:** src/lib/components/live/MatchCourt.svelte; ParticipantGroup.svelte; LiveSessionPanel.svelte; CheckInSheet.svelte; src/routes/clubs/[clubId]/live/+page.svelte; tests/live.e2e.ts.

**Interfaces:** Preserve MatchCourt callbacks, canManage/online/pending semantics, participant records and live-controller interfaces. Visual state derives from the existing data.

- [x] Use current E2E fixtures for idle, active set, between sets, recommendation selection, manual pairing, substitution, pending failure and read-only viewing.
- [x] Recompose the match as the approved dark panel with two equally weighted teams and readable score controls. Keep final-score entry semantics and one clear primary action.
- [x] Present compact next-match preparation, initials, participant groups and textual statuses. Do not invoke a trusted recommendation write for decorative previews.
- [x] Verify compact score/substitution layouts in 360px renders; add the viewer between-set regression and retain existing authorization and override assertions. Long-name navigation is covered by the shared-shell browser regression.
- [x] Run npm run check and tests/live.e2e.ts; capture active/idle/between-set mobile states and commit.

## Task 3: Player surfaces and remaining club pages

**Files:** src/routes/clubs/[clubId]/players/+page.svelte; players/[id]/+page.svelte; history/+page.svelte; history/[id]/+page.svelte; fund/+page.svelte; session-close/[id]/+page.svelte; session-close/[id]/confirm/+page.svelte; settings/+page.svelte; tests/supporting-pages.e2e.ts; tests/history-evaluation.e2e.ts; tests/settings.e2e.ts.

**Interfaces:** Existing queries, mutations and data fields remain authoritative. Reuse shared visual primitives and preserve all retry callbacks and pending safeguards.

- [x] Restyle roster/profile with initials and compact data-led sections; move persisted rating near identity and show real per-session summaries.
- [x] Apply the shared hierarchy to history/results, fund/payment details, settings and both session-close stages. Preserve evaluation visibility and payment authority.
- [x] Retain and run existing error-state assertions for no fabricated empty/zero result and accessible retry; inspect preserved stale-data notices.
- [x] Run affected E2E files and npm run check; inspect representative populated, empty and error states; commit.

## Task 4: Landing, auth, onboarding and demos

**Files:** src/routes/+page.svelte; src/lib/components/landing/SessionPreview.svelte; src/routes/start/+page.svelte; reset-password/+page.svelte; demo/+page.svelte; demo/playwright/+page.svelte; static/images/; tests/public-entry.e2e.ts.

**Interfaces:** Retain existing signup, demo, account and explicit-club routes. Keep recent login transition/input-retention changes. Landing preview takes local fictional data only, no backend reads or writes.

- [x] Produce an original badminton activity asset using the approved board as reference; save exact prompt/provenance and optimized assets in the repo.
- [x] Rebuild the landing composition against the board with the approved headline, compact app preview, overlapping next-player panel and distinct lower section.
- [x] Apply the new system to login/signup, recovery, account loading/error, club selection/creation and demo screens.
- [x] Update the existing landing heading/link assertions to approved copy. Assert no backend calls, correct demo/signup destinations and no deceptive interactive preview controls. Keep auth transition and input-retention regressions.
- [x] Run public-entry E2E and npm run check; capture desktop/mobile landing and auth states; commit.

## Task 5: Fidelity, complete verification and handoff

**Files:** DESIGN.md; docs/full-visual-revamp-report.md; approved scoped design documentation; affected source only for material review fixes.

- [x] Run npm run verify. Use existing synthetic E2E fixtures; do not write to a remote database. Record skipped credential-dependent tests.
- [x] Batch screenshots of landing, Live, profile and secondary pages at 1440px and 390px, plus 360px layout checks. Wait for fonts/assets and settle motion.
- [x] Compare actual renders against the approved board. Request a fresh visual review with the board, screenshots, spec and changed files; batch material corrections and verify them.
- [x] Update DESIGN.md and scoped tokens/docs to reflect the approved implemented system. Record visual evidence, tests and limitations without republishing infrastructure inventories.
- [x] Publish the implementation PR and show actual rendered screenshots to the user. Do not merge until explicitly authorized.
