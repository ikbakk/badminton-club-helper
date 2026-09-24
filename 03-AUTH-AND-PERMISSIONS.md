# Authentication & Authorization

## UX principle

Same URLs and same core components for everyone.

Do **not** build `/admin/...` versus `/member/...` versions of the application.

Controls appear based on capabilities.

## Access types

### Viewer

No account required.

Read-only access to public-safe information:

- Live Session,
- queue/current court,
- player profiles/fun stats,
- session history,
- club-fund transparency,
- recaps,
- payment destination information if product chooses to expose it.

Do not expose:

- individual debt/private finance details,
- raw audit/event logs,
- internal algorithm diagnostics,
- secrets/credentials.

### Session Operator

Temporary, session-scoped authority.

Exactly **one active operator device per session**.

Can:

- check in players,
- add guest for tonight,
- change session statuses,
- request/accept/override Smart Rotation,
- swap pairing,
- start match,
- record set scores,
- substitute,
- finish/abandon match,
- close/reopen session,
- confirm today's fee after session close,
- submit reported court/shuttlecock costs for finance review.

Cannot:

- modify permanent roster/settings,
- manually modify permanent rating,
- confirm actual payments,
- mutate official expense ledger,
- change payment destination,
- manage permanent authorities.

### Finance Admin

Authenticated permanent authority.

Can:

- record/confirm payments,
- allocate payments to obligations,
- handle debt/prepayment/credit,
- record official court/shuttlecock/other expenses,
- review finance submissions,
- correct finance records according to audit rules,
- view private finance details.

### Club Admin

Authenticated permanent authority.

Can manage:

- roster,
- rating initialization/manual correction,
- club branding/settings,
- payment destinations,
- permanent authorities,
- session PIN/credential policy,
- finance intervention if necessary.

## Session PIN + device lease

A session credential/PIN grants permission to operate the existing session.

Do not store raw PINs.

Flow:

1. verify PIN server-side,
2. if no active lease, issue device lease,
3. if another device currently owns control, show takeover confirmation,
4. confirmed takeover revokes old lease and issues new lease.

Old device becomes read-only and should show:
`Session control moved to another device.`

Refresh/browser close on the same device should restore the valid lease if possible.

A dead phone is recovered by entering the same session PIN on another phone and taking over.

## Permanent admin takeover

A permanent Club Admin should not silently become the Session Operator merely by opening the page.

If another device owns the lease, explicitly choose `Take over session`.

## Supabase/RLS direction

Public reads should use deliberately public-safe tables/views/policies.

Important live writes should not be direct arbitrary browser CRUD.

Prefer:
`UI -> server command -> authorization -> transaction -> DB`

RLS is defense-in-depth, not a replacement for domain validation.

## One club in V1

This is not a multi-tenant SaaS.

Retain `club_id` where structurally sensible, but do not build:

- club switching,
- tenant onboarding,
- organization invitations,
- subscription management,
- multi-tenant admin console.
