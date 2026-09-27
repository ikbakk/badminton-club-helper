# Loading, Errors, Realtime & Offline

## Loading

Render shell/nav immediately. Use compact skeleton/loading state for Live content.

## Pending command

Disable only relevant mutation and show specific text such as `Saving score…`.

## Failure

Preserve user input when safe:

```text
Couldn't save Set 1.
Your score is still here.

[ Try again ]
```

Never show a command as completed before server confirmation.

## Realtime

Use Supabase Realtime as an invalidation signal. Refetch coherent authoritative Live state; do not manually reconstruct transactional state from many row events.

## Takeover

Lease invalidation immediately removes mutation controls and moves device to viewer state.

## Offline

```text
Offline
Showing the last synchronized session state.
Session controls are unavailable.
```

No offline mutation queue.

On reconnect: refetch, verify lease, restore controls only if still valid.

## Backend unavailable

Show cached state as stale/read-only if available:
`Club service is temporarily unavailable. We can't safely update the session right now.`

## Optimistic updates

Be conservative for start match, score completion, substitution, match/session close. Local selection UI can be optimistic.

## Accessibility

Text + color for status, explicit team labels, sensible dialog focus, and ~44px+ touch targets.
