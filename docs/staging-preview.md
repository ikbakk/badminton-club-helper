# Supabase Staging and Vercel Preview

This project uses a dedicated Supabase project for non-production integration testing. Never point test scripts or Vercel Preview at the production project. See [Work Agent Readiness](work-agent-readiness.md) for the currently verified project identities and setup blockers.

## Environment separation

| Environment                           | Supabase target                  | Use                                           |
| ------------------------------------- | -------------------------------- | --------------------------------------------- |
| Work agent / task integration testing | `badminton-club-dev` project     | Isolated development/bootstrap database       |
| Vercel Preview                        | `badminton-club-staging` project | Open and try reviewed task changes from a URL |
| Vercel Production                     | Existing production project      | Real club data; never a test target           |

The development project is `wmudjpordbayncgrkaiu` (`https://wmudjpordbayncgrkaiu.supabase.co`) in `ap-southeast-2`; Supabase quoted `$0/month` before it was created. All 37 repo migrations now exist there after applying the initial schema/security migrations before the older dependent files. The empty-database replay confirmed that normal filename order currently fails on `public.membership_type`, and plugin-applied migration versions do not match repo versions. The existing staging project `prwujfcdkstifszkvqrs` remains the Preview/test target. Keys are private configuration; do not copy them into this file, a PR, or logs.

## Required variables

The checked-in `.env.example` contains placeholders. For remote integration testing, use an ignored local environment file or an approved secret manager:

- `RUN_STAGING_TESTS=true` — explicit opt-in; otherwise remote writes must not run.
- `STAGING_SUPABASE_URL` and `STAGING_PROJECT_REF` — exact staging endpoint and ref.
- `PRODUCTION_PROJECT_REF` — guard value to make production-target tests fail closed.
- `STAGING_SUPABASE_ANON_KEY` — public client key for signed-in test requests.
- `STAGING_SUPABASE_SERVICE_ROLE_KEY` — server-only staging credential, never `PUBLIC_` and never browser-visible.
- `STAGING_TEST_PASSWORD` — unique synthetic account password, not a production password.
- `STAGING_APP_URL` — Vercel Preview URL for browser tests.

The current connected Supabase tools can inspect these projects and expose publishable keys. They do not provide a server-only staging key retrieval operation. Set the secret through a secure dashboard/plugin path; never paste it into chat or commit it. The user reports that Vercel project `rallymatch` is configured to deploy branch `main` as a Preview. The plugin's 403 is an intentional Vercel Pro subscription gate in this setup; it is not a missing connection scope. Until the plan permits Preview deployment access, do not claim a live Preview was verified.

## Per-task workflow

1. Read `AGENTS.md`, this guide, and `docs/work-agent-readiness.md`. Confirm the current PR branch and staging migration list before any writes.
2. Implement a focused code change. For schema work, create an append-only migration and preserve the SQL in the repository.
3. Run `npm ci`, `npm run verify`, and the staging-target guard tests. The default verification command must not write to a remote database.
4. Apply reviewed schema changes to staging only after checking that the migration operation preserves the expected repository version. If the available tool creates an independent execution-time version, do not claim parity with the repo migration history.
5. Seed only synthetic fixtures; track created IDs and clean up only those IDs. Never reset shared staging while another preview may use it.
6. Merge reviewed task changes to `main` to trigger the `rallymatch` Vercel project, which the user reports is configured to deploy `main` as Preview. Verify the actual Preview URL, public reads, real Auth, admin writes, trusted rating operations, mobile layout and persistence when the Vercel plan permits access. If the Pro subscription gate blocks deployment or access, record the exact blocker and do not claim Preview verification. Confirm the project target is Preview; production promotion remains separate and requires explicit authorization.
7. In the PR and readiness tracker, record commit SHA, staging target, migration evidence, test commands and preview URL. Keep production deployment separate.

## Migration limitation found during setup

On the empty dev project, the first lexically ordered migration, `20260926224903_onboarding_and_secure_commands.sql`, failed because `public.membership_type` did not exist yet. Applying `202609270001_initial_schema.sql` and `202609270002_security_and_commands.sql` first, then the other 35 files, succeeded. This is evidence that the SQL can create the schema in dependency order, not evidence that normal CLI replay works: `apply_migration` recorded generated execution-time versions (`20261020172854` through `20261020173736`), not repository migration timestamps. A clean, repeatable migration contract still needs a reviewed baseline/lineage design and a follow-up migration test before treating new-database setup as ready.

Changing app environment values from the dev/staging project ref and URL to a production project only changes the database/Auth target; it does not transfer schema history, users, or rows. Provision and verify the production project separately before switching.

## Production promotion

Production promotion is not part of the task Preview loop. Before a separately authorized release, compare migration history, back up as appropriate, review the exact migration SQL, apply in the documented order, verify critical reads and writes, and use a forward fix if a migration has already been applied. Do not automatically reverse schema changes or use staging data as a production seed.
