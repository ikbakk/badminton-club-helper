# Supabase Staging and Vercel Preview

This project uses a dedicated Supabase project for non-production integration testing. Never point test scripts or Vercel Preview at the production project. See [Work Agent Readiness](work-agent-readiness.md) for the currently verified project identities and setup blockers.

## Environment separation

| Environment                           | Supabase target                            | Use                                               |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Work agent / task integration testing | Dedicated `badminton-club-staging` project | Synthetic data and application integration checks |
| Vercel Preview                        | Same dedicated staging project             | Open and try reviewed task changes from a URL     |
| Vercel Production                     | Existing production project                | Real club data; never a test target               |

The initial staging project is `prwujfcdkstifszkvqrs`, in `ap-southeast-2`. It was created after the Supabase cost quote returned `$0/month`. Its keys are private configuration; do not copy them into this file, a PR, or logs.

## Required variables

The checked-in `.env.example` contains placeholders. For remote integration testing, use an ignored local environment file or an approved secret manager:

- `RUN_STAGING_TESTS=true` — explicit opt-in; otherwise remote writes must not run.
- `STAGING_SUPABASE_URL` and `STAGING_PROJECT_REF` — exact staging endpoint and ref.
- `PRODUCTION_PROJECT_REF` — guard value to make production-target tests fail closed.
- `STAGING_SUPABASE_ANON_KEY` — public client key for signed-in test requests.
- `STAGING_SUPABASE_SERVICE_ROLE_KEY` — server-only staging credential, never `PUBLIC_` and never browser-visible.
- `STAGING_TEST_PASSWORD` — unique synthetic account password, not a production password.
- `STAGING_APP_URL` — Vercel Preview URL for browser tests.

The current connected Supabase tools can inspect the staging project and expose publishable keys. They do not provide a server-only staging key retrieval operation. Set the secret through a secure dashboard/plugin path; never paste it into chat or commit it. The user reports that Vercel project `rallymatch` is configured to deploy branch `main` as a Preview. The plugin's 403 is an intentional Vercel Pro subscription gate in this setup; it is not a missing connection scope. Until the plan permits Preview deployment access, do not claim a live Preview was verified.

## Per-task workflow

1. Read `AGENTS.md`, this guide, and `docs/work-agent-readiness.md`. Confirm the current PR branch and staging migration list before any writes.
2. Implement a focused code change. For schema work, create an append-only migration and preserve the SQL in the repository.
3. Run `npm ci`, `npm run verify`, and the staging-target guard tests. The default verification command must not write to a remote database.
4. Apply reviewed schema changes to staging only after checking that the migration operation preserves the expected repository version. If the available tool creates an independent execution-time version, do not claim parity with the repo migration history.
5. Seed only synthetic fixtures; track created IDs and clean up only those IDs. Never reset shared staging while another preview may use it.
6. Deploy the PR commit to Vercel Preview, then verify the actual URL, public reads, real Auth, admin writes, trusted rating operations, mobile layout and persistence.
7. In the PR and readiness tracker, record commit SHA, staging target, migration evidence, test commands and preview URL. Keep production deployment separate.

## Migration limitation found during setup

The first lexically ordered migration, `20260926224903_onboarding_and_secure_commands.sql`, fails on an empty database because `public.membership_type` does not exist yet. Applying the base schema and security migration first lets the remaining checked-in SQL execute in this staging instance. That proves the SQL can be applied in a dependency-aware order, but does not prove normal Supabase CLI replay or migration-history parity: the Supabase plugin `apply_migration` records generated execution timestamps. Resolve the bootstrap and migration ledger with a clean reproducible procedure before treating new-database deployment as ready.

## Production promotion

Production promotion is not part of the task Preview loop. Before a separately authorized release, compare migration history, back up as appropriate, review the exact migration SQL, apply in the documented order, verify critical reads and writes, and use a forward fix if a migration has already been applied. Do not automatically reverse schema changes or use staging data as a production seed.
