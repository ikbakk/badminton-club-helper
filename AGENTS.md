# Agent entrypoint

## Project and phase

PB NEWBIE is a one-court badminton club helper. V1 closeout: repository cleanup and 3–5 real club sessions. No feature work or algorithm tuning during validation.

## Architecture and authority

- SvelteKit/Svelte 5 UI → trusted server/data operations → pure `src/lib/domain/` logic → Postgres as state/atomicity authority.
- Public viewers need no account and are read-only. Authenticated `CLUB_ADMIN` is the only write authority.
- See `docs/architecture.md` for trusted boundaries; migrations are immutable history, not a place for cosmetic renames.

## Invariants

- One court, doubles, normally two sets; substitutions only between sets.
- Algorithm 1 selects four READY players; Algorithm 2 pairs only those four.
- Recommendations are advisory. Actual persisted match/set lineups—especially `set_players`—are authoritative.
- Fees are set at session close. No Session Operator PIN/lease or separate Finance Admin authority.
- Do not tune either algorithm or its constants during live validation.

## Where to look

- Product/design: `PRODUCT.md`, `DESIGN.md`
- Domain: `src/lib/domain/`; live orchestration: `src/lib/features/live/`
- Trusted persistence/server endpoints: `src/lib/server/`, `src/routes/api/`, and `supabase/migrations/`
- Current behavior docs: `docs/architecture.md`, `docs/session-domain.md`, both algorithm docs, `docs/finance.md`, and `docs/real-session-validation.md`

## Workflow

- `npm run dev` · `npm run check` · `npm run test:unit -- --run` · `npm run test:e2e` · `npm run build`
- Run `npm run verify` before handoff. E2E needs Playwright browsers installed once (`npx playwright install chromium`).
- Remote DB checks (`npx supabase migration list --linked`, `npx supabase db lint --linked`) require credentials and project linkage. Never commit secrets or expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Preserve transaction boundaries and authorization tests. Make migrations only for actual schema changes; never rewrite applied history.
