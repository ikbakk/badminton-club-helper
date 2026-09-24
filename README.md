# Shuttle Night

A mobile-first helper for a casual, one-court badminton club. It is intentionally a club tool—not a SaaS, tournament system, or payment gateway.

## What is included

- Courtside Live session UI with manual/player-state controls, recommendation preview, match start, and final-score flow.
- Pure, testable baselines for opportunity-based rotation, balanced doubles pairing, bounded-margin team rating updates, and derived finance balances.
- Supabase-ready schema migration with core facts, append-only events, operator-lease structures, finance structures, and key database invariants.
- A clean public-safe UI prototype that runs without a Supabase project. It never pretends to persist data when credentials are missing.
- Unit tests and a Playwright live-session smoke test.

## Run locally

```sh
cp .env.example .env # optional for the current prototype
npm install
npm run dev
```

Then open the URL printed by Vite.

## Verify

```sh
npm run check
npm run lint
npm run test:unit -- --run
npm run test:e2e
npm run build
```

`test:e2e` installs the Playwright browser on first run.

## Supabase setup

1. Create a Supabase project and enable Email (magic-link) authentication.
2. Copy `.env.example` to `.env` and set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
3. Apply `supabase/migrations/202609270001_initial_schema.sql` through the Supabase CLI.
4. Before exposing writes, add tested `SECURITY DEFINER` server-command/RPC functions and RLS policies for each domain command. Critical state transitions must remain transactional and must not be direct browser CRUD.

The migration deliberately models all V1 tables, but the browser prototype is not a production command implementation until those command functions are deployed.

## Unfrozen decisions

The score/weight values in `src/lib/domain/rotation` and `src/lib/domain/rating` are explicit **versioned baseline simulations**, not claimed final policy. Calibrate them with the required real-session simulations and override history before enabling them as production authority.

See the numbered specification Markdown files for the complete product constraints.
