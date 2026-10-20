# Work Agent Staging and Preview Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Execute inline; do not spawn agents unless the user requests delegation. Track checkboxes and evidence.

**Goal:** Allow ChatGPT Work to implement, test and deliver a functional Vercel Preview using an isolated Supabase staging backend, without requiring Docker or interactive CLI login for routine tasks.
**Architecture:** Keep the existing SvelteKit, Supabase and transactional PostgreSQL boundaries. Use connected plugins for remote operations; commit every schema change to GitHub as well as recording its database migration. Production and staging remain separate.
**Tech Stack:** SvelteKit/Svelte 5, TypeScript, Supabase PostgreSQL/Auth/Realtime, TanStack Query, Vitest, Playwright, GitHub, Vercel.
**Spec:** The agreed requirements and execution contract below are the specification for this plan.

## Agreed requirements and execution contract

- Trigger: when the user says **"kerjakan sesuai planning"**, read this file, AGENTS.md and the current tracker, then execute all unblocked tasks in order. The user intends to switch to Luna 6 high; do not change models automatically.
- Planning only is authorized in the planning turn. Execution begins on the trigger.
- Deliver code, verification evidence, focused PRs and a working preview URL. Do not merge or deploy production without explicit task-specific authorization.
- Docker is optional and is not an acceptance dependency. Do not add Dockerfiles, Compose, self-hosting, a new database provider or a replacement Auth system.
- Routine implementation decisions are delegated to the executor. Do not repeatedly ask the user to approve steps already within this scope.
- Creation of a paid resource requires quoting its actual cost and obtaining explicit agreement before creation. If blocked by billing, missing permissions or unsupported tooling, finish independent work and report the exact remaining setup.
- Plugin access belongs to the current session. Check availability at execution; do not assume shell commands or GitHub Actions inherit plugin OAuth.
- Do not use production as the test database or copy real user data to staging.

## Global constraints

- Follow AGENTS.md and existing architecture. CLUB_ADMIN is the sole write authority; public access stays read-only and club-scoped.
- Preserve Algorithm 1/2 semantics, weights, rating initialization boundaries and actual set lineups.
- Preserve applied migration history. Do not reorder, rename or edit applied files, and do not mark an unapplied migration as applied merely to hide drift.
- No secrets in commits, logs, PR descriptions, screenshots or test reports. Server credentials must never use PUBLIC_ names.
- Use synthetic fixtures, actual Supabase Auth and authorization checks; no preview-only authentication bypass.
- Prefer small scripts and existing libraries. No broad refactor or speculative infrastructure.
- Tests against remote databases require an explicit staging target allowlist and opt-in. A missing or production target must fail before any write.
- Never reset staging while a preview or another task depends on it. Run shared-staging schema changes serially and record which commit is supported.

## Current evidence and limits

Inspected main at 21dc5af3acfea5efd0d7d5c4ad782aadaeaf4955 on 2026-10-20; re-read current main before implementation.

- README and architecture show Supabase SDK/Auth, Realtime invalidation, trusted server routes and transactional database functions.
- package.json has npm run verify; .github/workflows/verify.yml runs application verification and two reduced PostgreSQL read-model fixtures.
- No supabase/config.toml, Dockerfile or Compose is tracked in that snapshot.
- Migration 20260926224903_onboarding_and_secure_commands.sql uses public.membership_type before 202609270001_initial_schema.sql creates it. This is a static finding, not a reproduced full migration failure.
- Initial migration timestamps mix 12 and 14 digits; validate actual tool ordering and history rather than assuming lexical sorting is the complete diagnosis.
- Supabase plugin list_projects succeeded. The visible badminton-club project ref is zjqqjgdrojhqiylapvqd and was reported INACTIVE. Treat it as protected production; inspect metadata only, do not restore, reset or mutate it for this plan.
- Vercel access, project linkage, environment variables, actual database state and latest CI results have NOT been verified.
- Existing docs/release-readiness.md lists outstanding remote migration, Auth redirect/email and deployment checks; documentation is not evidence they are still outstanding or already complete.

## File map

Create:

- docs/work-agent-readiness.md — compact task tracker, current staging/preview identity, compatible commit, blockers and sanitized evidence.
- docs/staging-preview.md — setup, seed/test commands, Auth redirect configuration, preview use, migration promotion and recovery.
- scripts/staging-target.mjs — shared fail-closed remote target validation.
- scripts/staging-seed.mjs — synthetic test identity/club provisioning using supported Auth APIs.
- scripts/staging-smoke.mjs — authenticated application lifecycle tests and scoped fixture cleanup.
- scripts/staging-target.test.mjs — guard tests using node:test.
- tests/staging-preview.e2e.ts — real-backend browser smoke, excluded from default mocked E2E runs.
- playwright.staging.config.ts — explicit remote test target and browser settings.
- supabase/bootstrap/README.md and supabase/bootstrap/baseline.sql — only if Task 2 proves a separate reviewed baseline is necessary.

Modify:

- AGENTS.md, README.md — default Work workflow and links.
- package.json — staging commands; package-lock.json only when dependencies actually change.
- .env.example — placeholders, no credentials.
- .github/workflows/verify.yml — guard tests and clearly separated database coverage.
- docs/release-readiness.md — reconcile verified checks and link evidence.
- Additional migration/endpoint files only when a reproduced problem requires them; use existing module boundaries.

Do not add vercel.json or change the Svelte adapter unless deployment inspection proves they are needed.

## Review focus

1. Wrong target configuration must reject writes, including lookalike hosts, missing staging identity and production ref.
2. Public or another club's admin must be denied private reads and mutations.
3. A half-finished test must not leave a live match blocking subsequent tests.
4. Preview and staging schema revisions must agree; old previews sharing newer schemas need a compatibility note.
5. An apparently successful deployment must actually reach Auth, database and server-side rating endpoints.

---

## Task 1 — Inventory and staging provisioning (PR 1)

Consumes: existing main and connected GitHub/Supabase/Vercel plugins.
Produces: verified staging project ref, Vercel project identity, tracker and isolated target configuration.

- [ ] Read current main, AGENTS.md, architecture, release-readiness, public-product-entry, session simulation, server rating implementation and existing tests.
- [ ] Check available execution tools, Node/npm and browser support. Run npm ci and baseline npm run verify when supported; record failures before attributing them to changes.
- [ ] Through Vercel plugin inspect accounts/projects and identify the badminton repository linkage. Do not modify an unrelated project.
- [ ] Through Supabase plugin inspect accessible organizations/projects. Find an explicitly dedicated staging project or provision one after checking actual cost/quota. Never repurpose an existing unrelated project.
- [ ] Read current Supabase and Vercel skills/docs before provisioning. Confirm required plugin operations exist; do not promise unsupported secret retrieval or environment updates.
- [ ] Create docs/work-agent-readiness.md with task status, environment identities and blockers. Keep credentials out.
- [ ] Implement staging-target.mjs exporting assertStagingTarget({ supabaseUrl, expectedProjectRef, productionProjectRef }): URL. Require HTTPS and exact standard Supabase staging host; reject production, mismatches, malformed URLs and userinfo. Restrict this initial workflow to standard hosted Supabase endpoints.
- [ ] Add node:test cases for matching staging PASS; production, missing ref, wrong host, suffix spoofing and URL credentials FAIL. Run node --test scripts/staging-target.test.mjs.
- [ ] Add safe env placeholders and document that plugin OAuth is not a service-role credential for scripts.
- [ ] Open/update focused draft PR 1. Gate: target guard tests pass and staging resource identity is verified, or resource blocker is explicitly recorded.

## Task 2 — Reproducible database creation and migration contract (PR 2)

Consumes: staging identity and target guard.
Produces: repeatable empty-database bootstrap, migration ledger reconciliation and upgrade procedure.

- [ ] Inventory every checked-in migration's dependencies; inspect read-only remote migration history and required extensions/version where available.
- [ ] Reproduce fresh bootstrap on a disposable staging database/branch only. If no isolated disposable target is available, record BLOCKED rather than reset shared staging.
- [ ] Capture the first real failure, including filename and missing object, without secrets.
- [ ] Select the smallest correct bootstrap path. Prefer canonical migration replay if achievable without rewriting history. If historical ordering prevents it, produce a separate schema-only baseline for NEW databases, with exact reviewed lineage and an explicit cutoff.
- [ ] A baseline must not contain production rows, users, password hashes or secrets. Review SQL grants, policies, functions, extensions and object dependency order.
- [ ] Do not run baseline and covered legacy migrations twice. Document initial ledger establishment only after verifying equivalent schema exists; distinguish this from normal upgrades and never apply a new-project baseline to existing production.
- [ ] Keep future schema changes as append-only migrations. Use CLI migration new if available, or the documented plugin migration workflow; preserve the same reviewed SQL in repo and remote history.
- [ ] Verify fresh bootstrap and an upgrade from the baseline cutoff. Check schema object signatures, grants/RLS, relevant read models and rating functions.
- [ ] Retain the current CI fixture tests but label their scope honestly. Add feasible full-schema coverage only with a reproducible target and credentials; no fake full-integration PASS.
- [ ] Document the exact supported bootstrap and promotion commands/tool operations. Gate: clean target is usable and an additional migration can be applied without duplicate objects/history drift.

## Task 3 — Synthetic fixtures and real-backend session verification (PR 3)

Consumes: guarded staging target with working schema.
Produces: repeatable seed, backend smoke and browser smoke.

- [ ] Read scripts/session-database.ts and existing remote rating tests first; reuse domain/application helpers rather than duplicate algorithms.
- [ ] Implement staging-seed.mjs using supported Auth admin APIs to create test identities; never insert ad-hoc Auth table rows. Use two synthetic clubs/admins and 12 synthetic players in the primary club.
- [ ] Support STAGING_SUPABASE_URL, STAGING_PROJECT_REF, STAGING_SUPABASE_ANON_KEY, STAGING_SUPABASE_SERVICE_ROLE_KEY, STAGING_TEST_PASSWORD and STAGING_APP_URL. Load secrets from ignored runtime configuration, never print them. Use the target guard before Auth or data writes.
- [ ] Implement staging-smoke.mjs using signed-in user tokens and actual application commands for create club/roster/check-in, READY/RESTING, rotation start, complete sets, between-set substitution, rating persistence, session close, obligations/payments and history/fund reads.
- [ ] Verify persisted four-player actual lineups, exactly-once rating results, unchanged recommendation semantics and consistent financial totals. Include duplicate/stale command attempts and cross-club denial.
- [ ] Track fixture IDs created by the run. In finally, clean only those fixture records in dependency order; never broadly delete by name or truncate tables. If cleanup fails, report IDs and leave a recovery procedure.
- [ ] Re-run smoke to prove isolation/repeatability. Add tests proving wrong-target rejection happens before network writes.
- [ ] Add playwright.staging.config.ts and staging-preview.e2e.ts for real login, public club view, admin session operation and unauthorized access. Do not use mocked Supabase responses for this suite.
- [ ] Expose npm run seed:staging, test:staging and test:e2e:staging. Remote runs must require RUN_STAGING_TESTS=true in addition to exact target validation; default verify must not mutate remote data.
- [ ] Gate: npm run verify passes; remote lifecycle and browser smoke pass with sanitized evidence, or their exact missing credentials/tooling are reported separately.

## Task 4 — Functional Vercel Preview and release runbook (PR 4)

Consumes: verified staging and real-backend tests.
Produces: working preview URL linked to its commit and migration state.

- [ ] Inspect existing Vercel framework/build/adapter settings before changing source.
- [ ] Set only Preview environment values to staging: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY and server-only SUPABASE_SERVICE_ROLE_KEY. Keep Production values unchanged. Prefer plugin secret handling; if required secret access is unavailable, request the minimal secure setup action without asking for secrets in chat.
- [ ] Configure staging Auth site/redirect URLs for the intended preview domains and password recovery. Use the documented narrowest suitable preview wildcard; do not change production Auth configuration.
- [ ] Apply reviewed staging migrations before deploying dependent frontend code. Record commit/schema compatibility; serialize changes on shared staging.
- [ ] Deploy the PR commit as Preview using supported Vercel tooling, inspect build logs, wait for ready state and inspect the actual URL.
- [ ] Run real-backend browser smoke against that URL, including a trusted server rating operation. Use the protected-deployment skill if Vercel protection blocks tests; do not disable account 2FA or protection casually.
- [ ] Verify refresh/navigation, mobile viewport, public read-only access, server secret isolation and persistent writes. Distinguish actual email delivery testing from seeded email-confirmed login.
- [ ] Update AGENTS.md: read tracker, use staging, run local checks, preserve migration files, deliver preview URL, never silently substitute production, report blocked checks.
- [ ] Write docs/staging-preview.md with one-time setup and per-task routine: inspect → implement → verify → staging migration → preview → smoke → PR evidence.
- [ ] Document production promotion separately: backup/recovery readiness, migration diff review, compatible rollout order, post-release smoke and forward-fix strategy. App rollback does not reverse database migrations; no automatic destructive down migration.
- [ ] Gate: deliver preview URL, commit SHA, PR links, staging project identity, applied migration names and verification summary. No merge or production deployment.

## Execution and efficiency rules

- Execute sequentially; use parallel read-only calls only for independent inventory.
- Checkpoint tracker and focused commits after each gate. Reuse an existing task branch/PR when resuming; inspect state before rerunning setup or tests.
- Do not repeat a passing verification suite unless source/config changes justify it.
- On tool failure, try at most two materially different reasonable approaches; then record the blocker and continue independent work.
- Never claim completion based only on docs, mock E2E or a successful build. Mark checks PASS, FAIL, BLOCKED or NOT RUN with brief evidence.
- If plugin-based manual operations are sufficient, do not add a credential-heavy CI deployment system just for this batch. GitHub Actions automation is a follow-up after the workflow works end to end.
- Final response in Indonesian: completed tasks, PR links, preview URL, tests actually run and remaining user setup. Keep it concise.

## Completion checklist

- [ ] Supabase staging is isolated from production.
- [ ] Fresh schema bootstrap and subsequent migration are verified.
- [ ] Seed/test commands reject production and missing targets.
- [ ] Actual Auth, RLS and session/rating/finance operations pass against staging.
- [ ] Vercel Preview uses staging and has been opened/tested.
- [ ] All SQL changes are committed; repo and database migration history agree.
- [ ] AGENTS.md and tracker support continuation from a new Work session.
- [ ] Production is unchanged; paid resource creation has explicit cost approval.
