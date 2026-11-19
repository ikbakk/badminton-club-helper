# Finance

## Authority

Club Admin is the only write authority for session and finance operations. There is no separate Finance Admin or Session Operator role.

## Session fee and obligations

Charges are confirmed during session close. The Club Admin enters a base rupiah amount for every checked-in attendee, a per-kok price, and court rent. When kok counting is enabled, every completed match needs a count (zero is valid). Match kok cost is split by actual completed set appearances, including substitutions, with deterministic whole-rupiah rounding. A player adjustment needs a reason. The confirmed obligation stores the base, kok, and adjustment breakdown for each attendee.

Confirming charges also records the entered court rent as a paid COURT expense in the same transaction. This immediately reduces Kas. A zero rent needs no expense row. Kok usage adds to player charges; buying kok stock is a separate SHUTTLECOCK expense and must only be recorded when money is actually spent.

## Payments, credit, and debt

Payments represent money actually received and may be allocated across obligations. Credit is derived as total player payments minus allocations; debt is derived as obligations minus allocations. Neither is a separately mutable authoritative balance. Finance UI should distinguish actual ledger entries from informal expectations.

## Manual payment destinations

Club Admins can configure one bank destination, one ShopeePay destination, and an HTTPS QRIS image link in Settings. Destination details are admin-only by default. The admin can explicitly publish them on the public Fund page; public read models return no destination row while publication is off. These are instructions only: payment still requires admin confirmation in the ledger.

## Expenses and fund

Official expense categories are COURT, SHUTTLECOCK, and OTHER. Kas is the cumulative club fund: all confirmed received payments minus paid expenses across sessions. Unpaid player obligations are shown separately and do not increase Kas. Public reporting may expose aggregate fund transparency, but individual debt/payment details and private finance records remain restricted.

## Product boundary

The application is not a payment gateway. Payment destinations and transfer instructions do not prove receipt; only an authorized recorded payment is ledger evidence.
