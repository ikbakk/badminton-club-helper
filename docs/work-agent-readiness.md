# Work Agent Readiness

Last checked: 2026-10-21

## Environment identities

| Role                      | Project                  | Ref / ID               | Status                                                            |
| ------------------------- | ------------------------ | ---------------------- | ----------------------------------------------------------------- |
| Supabase dev              | `badminton-club-dev`     | `wmudjpordbayncgrkaiu` | Active, ap-southeast-2; new project, quote `$0/month`              |
| Supabase staging          | `badminton-club-staging` | `prwujfcdkstifszkvqrs` | Active, ap-southeast-2; existing Preview/test target               |
| Existing Supabase project | `badminton-club`         | `zjqqjgdrojhqiylapvqd` | Inactive; protected and untouched                                 |
| Vercel app                | `rallymatch`             | —                      | Main-to-Preview; Pro-gated (user-reported)                        |

Dev URL: `https://wmudjpordbayncgrkaiu.supabase.co`. Staging URL: `https://prwujfcdkstifszkvqrs.supabase.co`. Never store private keys here. No app rows or synthetic Auth users have been created in either project.

## Execution tracker

| Plan task                               | State                             | Evidence / blocker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Inventory and staging                | Partial                           | Dedicated staging project is active; exact-host staging target guard is implemented and passes 5 tests. User reports `rallymatch` deploys `main` as Preview. The Vercel 403 is an intentional Pro subscription gate, not a connection issue.                                                                                                                                                                                                                                                                                                                        |
| 2. Fresh bootstrap / migration contract | Partial, not accepted as complete | On new, empty `badminton-club-dev`, raw first migration replay reproduced the failure: `public.membership_type` is missing. Applying `202609270001_initial_schema.sql` and `202609270002_security_and_commands.sql` first, then the other 35 migrations, succeeded; 37 repo migration names are recorded, 23 public tables exist, all have RLS enabled, and app tables are empty. Supabase `apply_migration` still assigns generated remote versions (first `20261020172854`, last `20261020173736`), so this is verified dependency-aware bootstrap, not CLI version parity or a normal `db push` contract. A reviewed baseline/lineage plan and append-only follow-up migration remain outstanding. Security advisor reports 23 RLS tables without policies, 7 security-definer views, and callable security-definer RPCs; review against the intended RPC-only access model before declaring security gate complete. |
| 3. Authenticated lifecycle testing      | Blocked                           | No fixture rows or users were created. The connected Supabase tools expose publishable keys but provide no server-only staging-key retrieval operation. Need a secure way to configure that key, then implement and run actual Auth, authorization, session and rating tests.                                                                                                                                                                                                                                                                                       |
| 4. Vercel Preview                       | Blocked                           | User reports `rallymatch` uses `main` for Preview. The Pro gate (403) blocks live verification; staging environment values and Auth redirects also remain to configure.                                                                                                                                                                                                                                                                                                                                                                                             |

## Development schema bootstrap

The new, empty dev database failed on the lexically first migration as expected, then accepted all 37 checked-in migration SQL files when the initial schema/security files were applied first and the remaining files were applied in filename order. The failed attempt added no ledger row. This gives the dev project the app schema without test data, but the Supabase plugin records generated versions rather than the repo timestamps; do not use this as evidence of `supabase db push` parity.

## Staging schema application

The isolated staging database has SQL from these 37 files applied in dependency-aware order. The initial failed attempt wrote no migration record. The Supabase plugin's remote ledger uses generated versions and is not equal to the checked-in version history.

```text
20260926224903_onboarding_and_secure_commands.sql
20260926225808_club_dashboard_queries.sql
20260926230952_public_club_profile.sql
20260926232010_fix_roster_rating_insert.sql
20260926232455_fix_pin_hash_extension_schema.sql
202609270001_initial_schema.sql
202609270002_security_and_commands.sql
20260927120000_courtside_match_commands.sql
20260927123000_courtside_close_commands.sql
20260928091432_fix_guest_rating_insert.sql
20260928095727_set_leave_after_match.sql
20260928101354_public_read_models.sql
20260929044228_core_recovery_commands.sql
20260929044952_finance_admin_commands.sql
20260929045857_restrict_finance_helper.sql
20260929050133_restrict_default_function_execution.sql
20260929050256_restrict_admin_rpcs_to_authenticated.sql
20260929050338_promote_guest_to_member.sql
20260929050715_finance_submissions.sql
20260929051252_public_session_reports.sql
20260929053828_admin_claim_operator_lease.sql
20260929054051_session_attendee_payment_status.sql
20261004122835_fix_start_match_ready_player_lookup.sql
20261004133020_admin_login_session_controls.sql
20261004141126_bulk_check_in_and_public_payment_status.sql
20261004152042_deduplicate_public_session_matches.sql
20261004163710_club_admin_finance_access.sql
20261005120000_authorization_integrity_hardening.sql
20261005130000_smart_rotation_fairness.sql
20261005140000_drop_revoked_operator_lease_rpcs.sql
20261006051207_algorithm_2_rating_persistence.sql
20261006064254_algorithm_2_server_read_access.sql
20261006102817_algorithm_2_pairing_audit_and_public_rating.sql
20261006103627_harden_pairing_audit_validation.sql
20261011105500_club_settings_and_payment_destinations.sql
20261014110000_public_product_club_entry.sql
20261017100000_player_session_summaries.sql
```

Security and performance advisors completed against staging. They reported 23 tables without policies, 7 security-definer views, callable security-definer functions, 25 unindexed foreign keys, and 2 unused indexes. These need review against intended access patterns; this setup task did not alter existing SQL or policy behavior. Staging tables currently contain zero rows.

## Verification evidence

- `npm ci`: PASS.
- `npm run lint`: PASS in the second `npm run verify` attempt; Prettier check also passes for all changed files.
- `npm run check`: PASS, 0 Svelte errors and warnings.
- `node --test scripts/staging-target.test.mjs`: PASS, 5/5.
- `npm run test:unit -- --run`: PASS, 98 passed, 3 skipped.
- `npm run build`: PASS.
- `npm run verify`: PASS in GitHub Actions run 17 on PR #8, including Playwright E2E; the separate `database-read-models` job also passed. The docs checkpoint PR for the new dev project is awaiting CI. Local Playwright is blocked because Chromium's CDN download returned a corrupt 0 MiB archive. The Playwright web-server timeout is now 180 seconds to accommodate the two-minute local production build.

## Safety and continuation

- Before remote work, inspect this tracker and the current Supabase migration ledger; do not blindly replay applied SQL.
- Treat the plugin's generated migration versions as a schema application record, not proof of repository-history parity or clean CLI replay.
- Use `badminton-club-dev` for isolated development/bootstrap work; keep `badminton-club-staging` as the Preview/test target until the workflow is deliberately changed. Changing a project URL/ref redirects the app to that project's data; it does not copy users or database rows.
- Keep the inactive `badminton-club` project untouched. Never reset staging while another preview or task depends on it.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in a `PUBLIC_` variable, frontend code, logs, this tracker, or a commit.
- Record checks as PASS, FAIL, BLOCKED or NOT RUN with command/tool evidence.
