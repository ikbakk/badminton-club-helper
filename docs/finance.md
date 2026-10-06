# Finance

## Authority

Club Admin is the only write authority for session and finance operations. There is no separate Finance Admin or Session Operator role.

## Session fee and obligations

Fee is set/confirmed during session close, not session start. The session fee is an integer rupiah amount; closing creates an obligation for each attendee. One obligation represents the amount owed by one player for one session.

## Payments, credit, and debt

Payments represent money actually received and may be allocated across obligations. Credit is derived as total player payments minus allocations; debt is derived as obligations minus allocations. Neither is a separately mutable authoritative balance. Finance UI should distinguish actual ledger entries from informal expectations.

## Expenses and fund

Official expense categories are COURT, SHUTTLECOCK, and OTHER. Club fund is derived as all actual payments minus official expenses. Public reporting may expose aggregate fund transparency, but individual debt/payment details and private finance records remain restricted.

## Product boundary

The application is not a payment gateway. Payment destinations and transfer instructions do not prove receipt; only an authorized recorded payment is ledger evidence. Do not reintroduce legacy operator-submission or separate Finance Admin authority from obsolete specifications.
