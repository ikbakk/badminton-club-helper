# Shuttle Night

A mobile-first helper for a casual, one-court badminton club. It is intentionally a club tool—not a SaaS, tournament system, or payment gateway.

## Current capabilities

- Public, read-only club, roster, and live-court view.
- Email + password Admin sign-in, club bootstrap, roster management, and session creation.
- Club Admin-authorized courtside operation: check-in, participant availability, Smart Rotation, balanced pairing, two-set scoring, between-set substitution, and match abandonment.
- Session close and finance ledger workflows, player ratings, and admin-only session evaluation/export.
- Supabase schema with append-only session events, RLS, public-safe projections, and transactional RPC commands.
- Unit tests and Playwright end-to-end tests.

## Run locally

```sh
cp .env.example .env
npm install
npm run dev
```

Set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in `.env`. Then open the URL printed by Vite.

## Verify

```sh
npm run verify
```

This runs formatting/lint checks, Svelte type checks, unit tests, Playwright smoke tests, and a production build. `test:e2e` installs the Playwright browser on first run.

## Supabase setup

1. Create a Supabase project and enable **Email + password** authentication.
2. Copy `.env.example` to `.env` and set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
3. Link the project and apply all migrations:

   ```sh
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. Create a first Admin user in Supabase Auth, then sign in and bootstrap the club in the app.

### Implemented RPC commands

- `start_session`
- `check_in_player`
- `add_guest_and_check_in`
- `change_participant_status`
- `start_match`
- `complete_set`
- `substitute_player`
- `abandon_match`
- Session, finance, rotation, and rating commands are implemented through authorized server endpoints and transactional database functions.

Critical state transitions remain transactional RPCs; the browser never performs direct table mutations.

## Documentation

- [Product scope](PRODUCT.md) · [Design system](DESIGN.md)
- [Architecture](docs/architecture.md) · [Session domain](docs/session-domain.md)
- [Smart Rotation](docs/algorithm-1-smart-rotation.md) · [Rating & pairing](docs/algorithm-2-rating-pairing.md)
- [Finance](docs/finance.md) · [Real-session validation](docs/real-session-validation.md) · [Roadmap](docs/roadmap.md)

## Demo data

The checked-in `supabase/seed/demo_data.sql` is idempotent and only adds sample records to a club named `PB NEWBIE`. It preserves any current LIVE session.

```sh
npx supabase db query --linked --file supabase/seed/demo_data.sql
```

It creates a roster, three closed sessions with attendance, matches and completed sets, obligations, recorded payments, expenses, session events, and a representative live Set 2 court if no match is already active.
