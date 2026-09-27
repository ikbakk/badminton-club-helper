# Session Close, Reopen & Fee

## End session

Place in a less accident-prone Live action/menu, not beside frequent score buttons.

## Confirmation

```text
End tonight's session?

11 players
24 completed sets
Started 19:04

3 players are still READY.

[ Keep playing ]
[ End session ]
```

If a match is IN_PROGRESS, block normal close and require complete/abandon first.

## Close

Atomically:

- session -> CLOSED,
- set `closed_at`,
- close open participant status periods,
- finalize remaining participants,
- append event.

## Fee AFTER close

```text
Session complete

TODAY'S FEE

Last session
Rp15.000

Fee per person
[ 15.000 ]

11 attendees

Expected
Rp165.000

[ Confirm fee ]
```

Suggest latest previous fee. First session is manual.

Confirming:

- saves fee,
- creates one obligation per applicable attendee,
- marks nobody paid.

## Final summary

```text
SESSION COMPLETE

11 players
24 sets
3h 04m

Expected fees
Rp165.000

[ View recap ]
[ Share ]
```

## Expense report

Operator may report court/shuttlecock cost for Finance Admin review; this is not an official ledger expense.

## Reopen safety

Recommended V1 rule: allow reopen only before fee confirmation/obligation generation. After fee confirmation, require a deliberate admin correction flow later rather than casual reopen.
