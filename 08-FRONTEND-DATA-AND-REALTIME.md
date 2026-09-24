# Frontend Data, TanStack Query & Supabase Realtime

## Division of responsibility

- **Postgres/server commands:** authority.
- **TanStack Query:** server-state fetching, caching, retries, invalidation.
- **Supabase Realtime:** thin change notification/invalidation for Live Session.
- **UI local state:** transient UI concerns only.

Do not duplicate authoritative server state into a large custom frontend store.

## Query examples

Potential query keys:

```text
["live-session"]
["session", sessionId]
["session", sessionId, "participants"]
["session", sessionId, "matches"]
["players"]
["player", playerId]
["history"]
["finance"]
```

Exact key design can be refined during implementation.

## Mutations

Important mutations call server/domain commands.

On success:

- invalidate relevant TanStack Query keys,
- refetch authoritative state.

## Realtime behavior

Use Realtime primarily for `/live`.

When a relevant DB change notification arrives:

- do not manually reconstruct complex transactional state from individual row events,
- invalidate/refetch the relevant live-session query/projection.

Example:

```text
DB transaction changes match + 4 participants + periods
-> Realtime signal
-> queryClient.invalidateQueries(...)
-> fetch coherent current state
```

## Where Realtime is unnecessary

Do not subscribe everything.

Normally no realtime needed for:

- player detail/history,
- historical session list,
- finance reports,
- club settings.

## Fallback

Core app must still work if Realtime is unavailable.

Suggested:

- mutation initiator invalidates/refetches locally,
- Live page may use slow fallback polling/refetch while session is LIVE,
- reconnect triggers authoritative refetch.

Do not make WebSocket connectivity a correctness dependency.

## Reads vs writes

Browser may use safe reads/realtime according to RLS.

Important state transitions should use controlled commands rather than arbitrary:

```ts
supabase.from("session_participants").update(...)
```

Business rules belong in server/domain command handling and transactions.
