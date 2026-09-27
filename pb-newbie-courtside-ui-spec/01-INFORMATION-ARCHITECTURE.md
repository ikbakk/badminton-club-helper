# Information Architecture

## Global shell

Mobile header:

```text
PB NEWBIE                         [Admin]
```

Authenticated permanent admin:

```text
PB NEWBIE                           [•••]
```

Current operator:

```text
PB NEWBIE                     ● Operating
```

## Primary navigation

Bottom navigation:

```text
Live      Players      History      Fund
```

`Live` is the default/primary surface.

Do not create separate role-based URL trees. The same route gains controls according to capability.

## Capability rendering

```text
Viewer -> read-only
Viewer + operator lease -> courtside controls
Authenticated admin -> permanent admin controls
Admin + operator lease -> both
```

Never equate `isAdmin` with `isOperator`.

## Live hierarchy

When session is LIVE:

1. live/session header,
2. current court,
3. next action,
4. READY/waiting and unavailable groups,
5. operator controls.

When no session:
Viewer: `No session is live right now.`
Admin additionally gets `[ Start Session ]`.

## Design rule

This is not a dashboard. Avoid dense tables/charts/cards during play. Prefer one dominant next action and large touch targets.
