# Shuttle Night

A mobile-first helper for a casual, one-court badminton club. It is intentionally a club tool—not a SaaS, tournament system, or payment gateway.

## Current capabilities

- Public, read-only club, roster, and live-court view.
- Email + password Admin sign-in, club bootstrap, roster management, and session creation.
- PIN-protected, single-device courtside operator lease with explicit takeover.
- Check-in for members and guests, participant availability states, manual doubles selection, two-set scoring, between-set substitution, and match abandonment.
- Supabase schema with append-only session events, RLS, public-safe projections, and transactional RPC commands.
- Unit tests plus a Playwright public-live smoke test.

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
- `claim_operator_lease`
- `check_in_player`
- `add_guest_and_check_in`
- `change_participant_status`
- `start_match`
- `complete_set`
- `substitute_player`
- `abandon_match`
- `close_session` and `confirm_session_fee` (database-ready; UI is intentionally out of the current live-slice scope)

Critical state transitions remain transactional RPCs; the browser never performs direct table mutations.

## Unfrozen decisions

The score/weight values in `src/lib/domain/rotation` and `src/lib/domain/rating` are explicit **versioned baseline simulations**, not final policy. Calibrate them with the required real-session simulations and override history before enabling them as production authority.

See the numbered specification Markdown files for complete constraints and the courtside UI pack for the interaction flows.

## Demo data

The checked-in `supabase/seed/demo_data.sql` is idempotent and only adds sample records to a club named `PB NEWBIE`. It preserves any current LIVE session and its operator PIN.

```sh
npx supabase db query --linked --file supabase/seed/demo_data.sql
```

It creates a roster, three closed sessions with attendance, matches and completed sets, obligations, recorded payments, expenses, session events, and a representative live Set 2 court if no match is already active.
