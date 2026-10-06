# PB NEWBIE

PB NEWBIE is a mobile-first helper for a casual badminton club running one court. Members use a public link to view club and court state; signed-in Club Admins run sessions and manage club operations. It is a club tool, not a tournament system or payment gateway.

## V1 status

- Public, read-only club, roster, live session, and history views.
- Club Admin sign-in, club setup, roster management, attendance, and courtside session operation.
- Session close, per-session fees, payments, expenses, and finance reporting.
- Deployed Smart Rotation (Algorithm 1) and balanced pairing/rating (Algorithm 2); both recommendations can be overridden by the admin.
- Admin-only session evaluation and JSON export for the 3–5 real-session validation phase.
- Supabase/Postgres persistence with RLS, public-safe read models, transactional state changes, and append-only session/audit history.

**Authority:** public visitors have no account requirement and are read-only. An authenticated `CLUB_ADMIN` is the only application write authority. See [Architecture](docs/architecture.md).

## Stack

SvelteKit, Svelte 5, TypeScript, Supabase/Postgres, TanStack Query, Vitest, and Playwright.

## Local development

Requirements: Node.js/npm and a Supabase project. From the repository root:

```sh
npm install
cp .env.example .env
# Fill in the values described below, then:
npm run dev
```

Open the local URL printed by Vite. `.env` is git-ignored; never commit credentials.

| Variable                    | Required                        | Purpose                                                                                                                  |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_SUPABASE_URL`       | Yes                             | Supabase project URL; public configuration.                                                                              |
| `PUBLIC_SUPABASE_ANON_KEY`  | Yes                             | Supabase anon/publishable key used by the browser and authenticated server checks.                                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for trusted server commands | Private server-only key used for authorized rating/evaluation persistence. Never expose it to browser code or commit it. |

Optional remote rating integration tests use `RUN_REMOTE_RATING_TESTS=true`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `REMOTE_RATING_TEST_BASE_URL`. Do not point those tests at production data; they create test records. They are not required by the default verification command.

## Supabase setup and health checks

1. Create a Supabase project and enable email/password authentication.
2. Set the environment variables above in `.env`.
3. Link the CLI to the intended project and apply the checked-in migrations:

   ```sh
   npx supabase link --project-ref <project-ref>
   npx supabase migration list --linked
   npx supabase db push
   npx supabase db lint --linked
   ```

4. Create the first user in Supabase Auth, sign in, and bootstrap the club in the app.

Do not edit applied migration history to remove legacy terminology. Treat migration-list drift and new database lint findings as issues to investigate; known historical warnings should be documented with their exact output rather than suppressed. Remote database commands require CLI login and a linked project; they are not part of `npm run verify`.

Current linked-database lint reports five non-blocking unused `p_lease_id` parameter warnings on legacy compatibility functions (`valid_operator_lease`, `suggest_session_fee`, `submit_session_finance`, `confirm_session_fee`, and `reopen_session`). Do not rewrite applied migrations just to silence them; check for new warnings when validating a database change.

## Common commands

| Command                      | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `npm run dev`                | Start local development server.                    |
| `npm run check`              | Run Svelte/TypeScript diagnostics.                 |
| `npm run lint`               | Check formatting and lint rules.                   |
| `npm run test:unit`          | Run unit/integration tests in watch mode.          |
| `npm run test:unit -- --run` | Run tests once (as in verification).               |
| `npm run test:e2e`           | Run Playwright end-to-end tests.                   |
| `npm run build`              | Create production build.                           |
| `npm run verify`             | Lint, type-check, all tests, and production build. |

Install the Playwright browser once with `npx playwright install chromium`. Run `npm run verify` before handing off changes. Playwright uses its configured isolated browser contexts; no developer browser session is needed.

## Source-of-truth documentation

- [Product scope and invariants](PRODUCT.md) · [Visual direction](DESIGN.md)
- [Architecture and authority](docs/architecture.md) · [Session domain](docs/session-domain.md) · [Finance](docs/finance.md)
- [Algorithm 1 — Smart Rotation](docs/algorithm-1-smart-rotation.md) · [Algorithm 2 — ratings and pairing](docs/algorithm-2-rating-pairing.md)
- [Real-session validation](docs/real-session-validation.md) · [Roadmap](docs/roadmap.md)

## Demo data

`supabase/seed/demo_data.sql` is idempotent and adds examples for the `PB NEWBIE` club while preserving an existing live session. Review the SQL and target project before running:

```sh
npx supabase db query --linked --file supabase/seed/demo_data.sql
```
