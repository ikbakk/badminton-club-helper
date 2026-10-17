# Release readiness

## Implemented

- Public landing and explicit club entry (PR #3); existing clubs retain their data.
- GitHub Actions runs `npm run verify` for pull requests and main, with Chromium installed.
- Public reads share the browser QueryClient with a 15-second freshness window. SSR creates an isolated client. Public surface queries retain usable content during refresh failures and provide retry actions.
- History, session detail, roster, player profile, Fund, session-close and confirmation use club-scoped surface keys. Admin roster data uses a separate short-lived query and is discarded when admin access is lost. Session evaluation remains private local state and is cleared on access loss.
- Courtside commands reject overlapping writes. Failed score input remains available for retry.
- Payment confirmation waits for queued/in-flight checklist writes. Successful writes invalidate public recap/history/fund reads.
- Existing recap image and text export are implemented; they were incorrectly listed as future work.

## Courtside and player follow-up

- First-session guidance explains roster, arrivals and four-player setup without preventing guests. Starting a session now refreshes the authoritative Live snapshot before opening check-in.
- Live shows the last successful synchronization time and an explicit offline state.
- The admin sees a provisional four-player preview only while the court is free. It reuses the unchanged Algorithm 1 policy, does not persist recommendations, and never forecasts an active match's next rotation.
- Player profiles show six recent session summaries from actual completed-set lineups: sets, wins/losses, partners and recorded rating change. Missing rating coverage stays unknown; no old sets are retro-rated.
- Recaps support result-only sharing, native image sharing where available, download and copied-text fallbacks. Sharing remains an explicit admin action.
- PostgreSQL CI smoke checks cover club entry isolation and the new player-summary read model using disposable fixtures.

## Release checks still required

- The player-summary UI additionally needs `20261017100000_player_session_summaries.sql`. It is read-only and does not modify rating state; the profile offers retry if the read model is unavailable.
- Apply reviewed pending migrations to the intended Supabase environment before releasing the public-club frontend. See `public-product-entry.md` for commands and ordering.
- Check linked migration status and database lint. A reduced disposable SQL fixture does not verify the complete existing production schema.
- Configure and test real signup confirmation and password recovery email delivery and exact redirect URLs.
- Check existing PB NEWBIE links and data after migration.
- Review the first GitHub Actions run; local verification is not evidence of a hosted CI run.

## Real-session validation

Run 3–5 actual club sessions. For each, export the admin evaluation and record perceived rotation fairness, team balance, and the courtside actions that caused friction. Follow `real-session-validation.md`; do not change algorithm weights or policies based on an isolated session.

Exercise slow connection, disconnect/reconnect, refresh mid-match, expired login, repeated taps, and a second device. Browser tests with mocked services cover selected failure paths, not production connectivity or human usability.

No production database, Auth configuration or deployment is changed by this quality pass.
