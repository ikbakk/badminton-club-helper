# UX and performance optimization

## Scope and verification limits

This pass focuses on the Live route, where the operator needs the current court state without losing it during synchronization. It does not change session rules, authorization, rotation or pairing behavior, ratings, finance, or the match lifecycle.

The repository was inspected at `main` commit `5c2ee9330ed5991fb12d0488db9fb709c66e181a`. A local dev server started, but the cloud browser could not reach the local server. The repo's Playwright suite also could not launch because its Chromium binary was absent; the official download returned a truncated zero-byte archive. Therefore the interaction and screenshots still need a real browser run before the UX findings can be considered visually verified.

## Initial architecture and confirmed bottlenecks

- The root layout provided a TanStack `QueryClient`, but no route used it for reads or writes.
- `/live/+page.ts` loaded the active session before rendering. The Live component then called `refreshLive()` again after loading club, roster, session history, and fund data.
- The component awaited `getPublicClub()`, then `getPublicRoster()`, then history and fund requests, then the second Live refresh. It also awaited `currentUser()`, then loaded the admin club and roster. These unrelated requests delayed the same page-level loading state.
- `LiveController` held `session`, `participants`, and `activeMatch` in local Svelte state and directly fetched them after commands.
- Live refreshes could come from mutation completion, a Realtime callback, a 15-second timer, visibility change, reconnect, and route loading. Several paths could request the same snapshot.
- A single `loading` flag also represented account/roster work. Refreshing account data could replace usable Live content with a loading view.
- Other routes still use local `$state`, a manual `publicCache` promise map in `dashboard.ts`, and route-specific loading flags. This pass leaves those secondary surfaces for a later focused migration.

## Live data dependencies

```text
Before
SvelteKit page load: active session → participants → active match → auth/fairness
Live component: public club → public roster → history + fund → Live refresh
Live component: current user → admin club → admin roster

After
Live query: active session → (participants + active match + auth) → fairness when authorized
Background: public club + (history + fund) → public roster
Background: current user → admin club → admin roster
```

The active session remains the true dependency for participant and match reads. Participants, active match, and the local auth-session read now run concurrently once the active session is known. Fairness remains conditional on an authenticated session. Public history still feeds the Live summary, but it no longer blocks the court view.

## Query ownership and refresh behavior

- `['live', 'active-session']` is the TanStack query key for the authoritative Live snapshot.
- TanStack Query owns its cached result, freshness, retries, and background lifecycle. `LiveController` reads and writes that query cache; it no longer keeps a second copy of the Live snapshot.
- The query uses a 15-second stale window and retains a 15-second background polling fallback while the tab is visible. The fallback remains useful if a Realtime notification is missed.
- Focus and reconnect use TanStack's configured refetch behavior. Manual visibility and reconnect refresh handlers were removed; the online handler only updates local offline/write-safety state and shows a connection notice.
- A successful courtside command runs as a TanStack mutation, then invalidates the Live query. Realtime broadcasts invalidate the same key. Both use `cancelRefetch: false`, so a refresh already in flight is allowed to finish instead of being cancelled and immediately duplicated.
- Realtime remains a freshness signal. It does not patch the displayed session, participants, or match.
- `src/routes/live/+page.ts` was removed because its server-state fetch was unused by the page and duplicated the browser read.

## Loading and mutation policy

- The Live skeleton appears only when the active-session query has no cached data and its first request is pending.
- Background refreshes keep the last usable court state visible. A refresh failure with cached data shows a restrained retry message; a cold-load failure shows an explicit retry action.
- Account and roster refreshes no longer toggle the Live loading replacement.
- The existing command label remains localized to the action in progress (for example, `Menyimpan skor…`). Complex match and score transitions still wait for authoritative persistence before the view reconciles.
- Offline state continues to block writes while keeping the last usable Live snapshot available.

## Changes in this pass

- Added a TanStack query for the Live snapshot and a TanStack mutation boundary for Live commands.
- Removed the duplicate route loader and manual refresh/visibility/polling handlers.
- Parallelized independent Live reads and moved public summary work off the Live critical path.
- Preserved cached content during background reconciliation and added a retry state for query errors.
- Added a Playwright regression flow that returns to Live from Players, History, and Fund at 390×844 and 360×780, checks for horizontal overflow and cold-loading replacement, and counts Live-session requests.
- Fixed the optional remote rating test so it does not construct a Supabase client when remote tests are disabled and local credentials are absent.

## Remaining UX and data-fetch debt

- Players, History, History detail, Fund, and session-close still own remote data in route-local state. TanStack Query should be adopted there only when a focused pass can preserve their loading, authorization, and finance behavior.
- `dashboard.ts` retains its manual cache. The remaining route reads should move to query keys before that cache is removed.
- Admin authentication/club/roster loading remains separate from the Live snapshot. It is no longer a blocking replacement, but the club and roster dependency remains sequential.
- The Live summary's public history remains local state and uses the legacy public cache.
- The actual 12-player end-to-end session, accessibility review, and visual comparison at the requested mobile widths remain unverified until a browser can run the updated Playwright flow.

## Verification

- `npm run verify`: **blocked at Playwright**. Formatting/lint and Svelte checks passed; unit tests passed (74 passed, 3 skipped; 1 suite skipped). Playwright collected 20 tests, but every test failed before page execution because the configured Chromium headless-shell binary is missing. The browser download attempt returned a truncated archive, so no browser-level result is available.
- `npm run build`: passed after the Live route loader was removed.
- Supabase linked-project health: not run; no linked-project credentials/CLI context were available. No migration was needed.
- No 12-player live-session or visual review at 390×844 / 360×780 was completed. The added Playwright navigation check remains unverified until Chromium can launch.
