# Public product entry

## Design and scope

The product's working name is Courtside. PB NEWBIE is an existing club, with the same status as any other club. The landing page neither identifies nor fetches it. The Court Lines palette, Indonesia-first language, one-court doubles flow, and both algorithms remain the operating model within each club.

- `/` is prerendered HTML with a clear “Buat klubmu” action and a fictitious, labeled court illustration. It makes no club/account requests.
- `/signup` opens account creation at `/start?mode=signup`.
- `/start` handles email/password sign-in, signup confirmation, the organizer's own club links, and creation when they have no club.
- `/clubs/[clubId]/live` and the sibling Players, History, Fund, Settings, and session-close routes always carry an explicit club ID.
- Old unscoped application links lead to `/start`. Unknown club links do not fall back to another club.
- The club shell provides a public Live link to copy. Visitors remain read-only and need no account.

An account can create one club; each new club gets that authenticated user as its Club Admin. Existing memberships are preserved. No public club directory or PB NEWBIE promotion is included. UUID links avoid name collisions and do not change when a club is renamed. Billing, subscriptions, custom slugs, private/invite-only viewing, multiple courts, and additional admin invitations are separate future work. Public club links are not secrecy guarantees: the existing public-safe data remains publicly readable.

## Server and query boundaries

Previously, the entry route automatically opened Live, public club/Live reads selected the first record, bootstrap allowed only the first club globally, and fund projections aggregated across all clubs.

The new migration adds transactional `create_club`, with an advisory lock per authenticated user, input validation, and atomic admin membership creation. Existing write RPCs still enforce club-specific authority. Review exposed a missing player/session association check in the retained single-player check-in RPC; this migration adds the same association guard already present in bulk check-in. The old bootstrap is not used by the UI.

History and fund projections now include `club_id`; fund totals and activity retain the original accounting rules within each club. The unscoped fund activity RPC loses browser execution privileges. Public player/session detail loading verifies association with the route's club before fetching detail.

Live queries and controller snapshots include club identity. Query functions capture that identity across asynchronous reads, so navigation during loading cannot put another club’s snapshot under the original key. Public caches include club identity for aggregate reads. Account access is accepted only for the selected club; changing club routes remounts local screen state. Auth changes clear account-entry caches; signing out of Live removes the scoped snapshot containing private diagnostics.

## Release requirements

Apply `20261014110000_public_product_club_entry.sql` to the intended Supabase project before releasing this frontend. Verify linked migration status and database lint afterward. Enable the intended signup policy in Supabase Auth, and allow the deployed `/start` URL as an email-confirmation redirect and `/reset-password` as the recovery redirect. Keep confirmation enabled as appropriate; the UI waits for confirmation when Supabase does not return a session. No migration or production deployment is performed by this branch.

## Verification

- Browser tests cover neutral entry, no implicit club fetch, confirmation-required signup, new club creation, explicit navigation, invalid links, and legacy entry.
- Existing courtside, history evaluation, and settings tests use explicit club URLs.
- A shared QueryClient unit test verifies independent club snapshots and invalidation keys.
- `supabase/tests/public_product_entry.sql` exercises the exact migration in an empty disposable Postgres database: anonymous/direct writes denied, separate owners, duplicate-owner creation denied, club-specific history, fund totals/activity, and the global activity RPC revoked. Single-player check-in also rejects foreign-club players and another club’s session, without participant/period/event side effects. It rolls back all fixtures.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally supplies an installed Chromium when browser downloads are unavailable. This affects tests only.

## Results

- Base inspected: GitHub main `669653f0bdef8ba7d1ca8bfaad17d0fbe9c891d1`.
- `npm run verify`: PASS with a supplied local Chromium executable. Formatting, ESLint, Svelte checks, 81 unit tests, 37 Playwright flows, and production build pass. Three opt-in remote rating tests remain skipped.
- Root prerender: `.svelte-kit/output/prerendered/pages/index.html` exists. No public club is requested by the landing page.
- Browser inspection: landing and signup reviewed at 390 × 844, 360 × 844, and desktop. Main CTA visible, no horizontal overflow. Existing courtside navigation also tested at 390 and 360 pixels.
- Exact new migration executed in disposable PGlite/Postgres with the SQL smoke fixtures: PASS. This checks migration syntax, separate ownership, one club per account, anonymous/direct-write denial, and separated finance/history.
- Linked Supabase health: BLOCKED: `npx supabase migration list --linked` returned `ProjectRefNotLinkedError` (“Cannot find project ref. Have you run supabase link?”). Migration not applied remotely. Signup deliverability and production redirects need verification on the intended project before release.
- Skills: `ux-landing-page` installed outside the product repository; SvelteKit guidance read directly on skills.sh. The indexed SvelteKit installer did not find that skill in its current upstream repository.
- Initial browser download failed because the CDN response was an invalid archive. Tests ran with Chromium 153 obtained through the npm-distributed browser tooling outside the product repository; no application dependency was added.

Remaining release work: apply the migration, configure/verify signup and confirmation, and validate existing clubs with the new links. Billing, private club visibility, custom slugs, and admin invitations are intentionally deferred. This is a public entry foundation, not a paid-product launch certification.

## Password recovery and release setup

`/start` provides “Lupa kata sandi?” with a neutral email-sent message and explicit service errors. Supabase sends the recovery email; the application never handles or prints email tokens. `/reset-password` waits for Supabase to validate the current authenticated user, then saves matching passwords of at least eight characters. A signed-in user can also update their own password here. Invalid or expired links without a valid session cannot submit. Failed saves retain input. After success, the session is signed out, account/query caches are cleared, and the user returns to password sign-in. If sign-out fails after saving, the page accurately reports the saved password and retries sign-out without rewriting it.

For the intended environment:

1. Set frontend `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`; keep `SUPABASE_SERVICE_ROLE_KEY` server-only. See `.env.example`.
2. Authenticate the Supabase CLI with the intended account and run `npx supabase link --project-ref <project-ref>`. Supply database credentials through the CLI prompt or a protected environment, never through committed files.
3. Run `npx supabase migration list --linked`, review pending migrations, and use `npx supabase db push --linked --dry-run` to inspect the exact release plan. Apply only after approval for that environment; do not blindly apply unrelated pending migrations.
4. After application, run `npx supabase migration list --linked` and `npx supabase db lint --linked`. The disposable SQL smoke is not intended for an existing production database.
5. In Supabase Auth URL Configuration, set Site URL to the intended HTTPS origin and add exact allowed URLs `<origin>/start` and `<origin>/reset-password`. Add localhost development URLs only to development projects. This client derives redirect URLs from its current origin; no new environment variable is required.
6. Enable email/password signup under the intended policy. Verify confirmation and recovery templates retain Supabase's `{{ .ConfirmationURL }}` link and verify outbound email delivery/SMTP and rate limits. Do not disable confirmation merely to bypass email configuration.
7. Test with a dedicated account: signup → real confirmation email → create club → sign out → real recovery email → new password → sign in. Verify the old password fails and an expired/reused recovery link cannot establish a new session. Confirm existing PB NEWBIE data and its explicit links remain intact.

Remote configuration is not changed by this code branch. The current workspace has no Supabase credential variables or linked project; live email delivery and redirect configuration remain unverified.

Recovery follow-up verification: `npm run verify` PASS (81 unit tests, 37 Playwright flows, lint, Svelte checks, and build). Five added browser cases cover send/retry, expired links, a validated recovery-token redirect, failed save, and saved-password/sign-out failure without duplicate writes. Remote linked migration status was retried and remains blocked by `ProjectRefNotLinkedError`. No remote migration or Auth configuration was changed.
