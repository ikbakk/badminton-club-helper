# Failure & Recovery UX

## One active operator

Exactly one active Session Operator device per session.

The reusable session PIN/credential allows recovery on another phone.

## Refresh / browser closes

If the same device still owns a valid lease:

- restore session control,
- refetch authoritative state,
- continue.

## Phone dies

On another device:

1. open Live,
2. enter same session PIN,
3. if old lease exists, show takeover warning,
4. confirm takeover,
5. revoke old lease,
6. issue new lease,
7. refetch current state.

No session-state transfer is needed because state lives on the server.

## Takeover warning

Do not silently steal control.

Example:

```text
Session is currently being operated on another device.
Taking over will make that device read-only.

[ Cancel ] [ Take Over ]
```

## Old phone returns

It should:

- refetch current state,
- detect invalid lease,
- become read-only,
- show `Session control moved to another device.`

## Internet loss

No offline writes.

Show cached/last-known state read-only:
`Offline — showing last synchronized session state. Controls unavailable.`

On reconnect:

- refetch authoritative state,
- restore controls only if lease is still valid.

Do not queue stale offline mutations.

## Realtime disconnect

App remains functional through TanStack Query/refetch.

## Backend/Supabase unavailable

Do not pretend writes succeeded.

Show a clear service-unavailable state.

Scheduled maintenance checks should provide developer failure visibility before game day when possible.

## Accidental operator input

Prefer explicit corrections over arbitrary undo/redo.

Support targeted correction paths:

- correct score,
- change status,
- cancel prepared match,
- abandon active match,
- correct substitution where safely possible,
- reopen recently closed session.

Record corrections/events.

Do not implement generic historical Undo/Redo in V1.

## Atomicity

Multi-row operations must be transactional so partial states cannot occur.

Examples:

- match completed but players still PLAYING,
- score saved but rating/event missing,
- payment saved but allocation half-written.

Use Postgres transactions/server functions as appropriate.
