# First Use & Onboarding

## Public first visit

No onboarding modal and no account request.

If session is live:

```text
PB NEWBIE
LIVE ●

Session is active.
Waiting for players / current court state...
```

If no session:

```text
No badminton session is live right now.
Check History for previous sessions.
```

## Admin authentication

Email + password only.

For old magic-link-only accounts, provide password recovery/create-password flow using Supabase recovery. Do not restore magic link as a normal login method.

## Operator onboarding

If session is LIVE and device lacks a lease:

```text
Session is live

[ Operate this session ]

Anyone can watch. The operator can check players in,
record matches, and manage tonight's session.
```

After first successful claim:

```text
You're operating this session.

Start by checking in everyone who has arrived.

[ Check in players ]
```

No tutorial carousel.

## Empty-state onboarding

0 checked in:
`No players checked in yet. Tap players as they arrive.`

1–3 READY:
`3 ready — one more player needed for doubles. Warm-up isn't recorded.`

4+ READY:
`4 players are ready. [ Prepare next match ]`

## Returning operator

If valid lease persists, restore directly and refetch. If revoked, return to viewer mode and explain that control moved to another device.
