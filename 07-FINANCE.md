# Finance Model & Workflow

## Authority boundary

Session operation and money control are separate.

Session Operator can:

- confirm today's fee after session close,
- generate attendance obligations,
- report expected court/shuttlecock costs,
- share a WhatsApp summary.

Finance Admin / Club Admin can:

- record actual payments,
- allocate payments,
- record official expenses,
- correct financial records.

## Session fee

Do not ask for fee at session start.

After session closes:

1. suggest the most recent previous session's fee,
2. operator confirms or edits,
3. write `sessions.fee_per_person`,
4. create one obligation per attendee.

First-ever session: manual entry.

## Obligation

Meaning:
`Player owes RpX for Session Y.`

One obligation per player/session.

## Payment

Meaning:
`Actual money was received from player.`

Payment may cover:

- current session,
- previous debt,
- future session credit.

Example:
Player pays Rp30,000 when fee is Rp15,000:

- allocate Rp15,000 to current obligation,
- remaining Rp15,000 remains unallocated credit,
- next session can allocate that credit to the new obligation.

No need for the app to model verbal/social agreements beyond the ledger facts.

## Credit

Derived:
`sum(player payments) - sum(player payment allocations)`

Do not maintain a separate authoritative mutable credit balance.

## Debt

Derived from obligations minus allocations.

## Expenses

Primary categories:

- COURT
- SHUTTLECOCK
- OTHER

Official expenses require Finance Admin/Club Admin authority.

## Finance submission when Finance Admin is absent

Session Operator can submit a non-ledger report:

- reported court cost,
- reported shuttlecock cost,
- notes.

This is `PENDING`, not an official expense.

Finance Admin later reviews and creates/confirms official ledger entries.

## WhatsApp handoff

After session close, app may generate/share a summary such as:

```text
Badminton — 27 Sep
Players: 11
Fee: Rp15.000
Expected fees: Rp165.000
Reported court: Rp120.000
Reported shuttlecocks: Rp30.000
Finance confirmation pending
```

## Club fund transparency

Public/read-only reporting can show aggregate money:

- received,
- court expenses,
- shuttlecock expenses,
- other expenses,
- accumulated club fund.

Do not publicly expose individual debt/payment details unless explicitly decided later.

Club fund:
`all actual payments - all official expenses`

No manually editable authoritative balance.
