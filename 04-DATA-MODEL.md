# PostgreSQL / Supabase Data Model

This is a concrete direction, not necessarily final SQL naming.

## clubs

```text
id uuid PK
name text
logo_path text nullable
created_at timestamptz
```

No default session duration.

No required default fee. Session-close UX should suggest the most recent previous session fee.

## payment_destinations

```text
id uuid PK
club_id FK
type BANK | E_WALLET | QRIS
provider text
account_name text
account_reference text nullable
qr_image_path text nullable
is_active boolean
```

## players

```text
id uuid PK
club_id FK
display_name text
avatar_path text nullable
membership_type MEMBER | GUEST
is_active boolean
created_at timestamptz
```

## player_ratings

```text
player_id PK/FK
rating numeric
uncertainty numeric
updated_at timestamptz
```

## player_rating_history

```text
id uuid PK
player_id FK
set_id FK nullable
source SET_RESULT | MANUAL_ADJUSTMENT | INITIALIZATION
rating_before
rating_after
uncertainty_before
uncertainty_after
algorithm_version
created_at
```

## sessions

```text
id uuid PK
club_id FK
status LIVE | CLOSED | CANCELLED
fee_per_person integer nullable
started_at timestamptz
closed_at timestamptz nullable
created_by_user_id nullable
created_at timestamptz
```

Money is integer rupiah.

Enforce at most one LIVE session per club with a partial unique index.

## session_participants

```text
id uuid PK
session_id FK
player_id FK
status READY | PLAYING | RESTING | AWAY | OUT | LEFT
checked_in_at timestamptz
left_at timestamptz nullable
ready_since timestamptz nullable   # optional materialized convenience
leave_after_match boolean
created_at
updated_at
UNIQUE(session_id, player_id)
```

Do not store authoritative `sets_played`, `wins`, `losses`, or accumulated waiting counters here.

## participant_status_periods

```text
id uuid PK
session_participant_id FK
status
started_at timestamptz
ended_at timestamptz nullable
```

Partial unique index: at most one open period (`ended_at IS NULL`) per participant.

## matches

```text
id uuid PK
session_id FK
sequence_number integer
status PREPARED | IN_PROGRESS | COMPLETED | ABANDONED
rotation_recommendation_id nullable
started_at nullable
completed_at nullable
created_at
UNIQUE(session_id, sequence_number)
```

At most one `IN_PROGRESS` match per session.

## sets

```text
id uuid PK
match_id FK
set_number smallint
status IN_PROGRESS | COMPLETED | ABANDONED
team_a_score smallint nullable
team_b_score smallint nullable
started_at nullable
completed_at nullable
UNIQUE(match_id, set_number)
```

For V1, set number is 1 or 2.

## set_players

```text
set_id FK
player_id FK
team A | B
PRIMARY KEY(set_id, player_id)
```

A command transaction validates exactly 2 players/team before rated completion/start as appropriate.

## rotation_recommendations

```text
id uuid PK
session_id FK
algorithm_version text
diagnostics jsonb nullable
created_at
```

## rotation_candidate_scores

```text
recommendation_id FK
player_id FK
rank integer
priority_score numeric nullable
recommended boolean
diagnostics jsonb nullable
PRIMARY KEY(recommendation_id, player_id)
```

Diagnostics may include inputs such as:

- eligible opportunities,
- missed opportunities,
- full rotations,
- current wait,
- consecutive rotations,
- participation/fill-in context.

Do not make diagnostic JSON the source of truth for domain facts.

## pairing_recommendations

```text
id uuid PK
match_id FK
algorithm_version text
diagnostics jsonb nullable
created_at
```

## pairing_recommendation_players

```text
recommendation_id FK
player_id FK
recommended_team A | B
rating_snapshot
uncertainty_snapshot
PRIMARY KEY(recommendation_id, player_id)
```

## session_obligations

Created only after today's fee is confirmed after session close.

```text
id uuid PK
session_id FK
player_id FK
amount integer > 0
created_at
UNIQUE(session_id, player_id)
```

## payments

```text
id uuid PK
club_id FK
player_id FK
amount integer > 0
method CASH | BANK | SHOPEEPAY
received_at timestamptz
recorded_by_user_id FK
created_at
```

A payment is actual money received and is not necessarily tied to one session.

## payment_allocations

```text
id uuid PK
payment_id FK
obligation_id FK
amount integer > 0
created_at
```

Remaining unallocated payment amount is player credit. Do not store a second authoritative `credit_balance`.

## expenses

```text
id uuid PK
club_id FK
session_id FK nullable
category COURT | SHUTTLECOCK | OTHER
description text nullable
amount integer > 0
occurred_at timestamptz
recorded_by_user_id FK
created_at
```

Club balance:
`SUM(payments.amount) - SUM(expenses.amount)`

Do not store a manually editable authoritative club balance.

## finance_submissions

Session Operator can report costs without mutating official ledger.

```text
id uuid PK
session_id FK
reported_court_cost integer nullable
reported_shuttlecock_cost integer nullable
notes text nullable
submitted_by_operator_lease/grant reference
submitted_at
status PENDING | CONFIRMED | REJECTED
reviewed_by_user_id nullable
reviewed_at nullable
```

## session operator credential / lease

Implementation may split credential and lease tables.

Required semantics:

- PIN/credential belongs to current session and is stored hashed.
- exactly one active device lease at a time,
- takeover revokes previous lease,
- closed session invalidates operator authority.

## session_events

Append-only application history:

```text
id uuid PK
session_id FK
event_type text
entity_type text nullable
entity_id uuid nullable
actor_user_id uuid nullable
actor_operator_lease_id uuid nullable
metadata jsonb nullable
created_at timestamptz
```

No normal update/delete workflow.

## Database principles

- Store facts, derive statistics.
- Use DB constraints for invariants where practical.
- Use transactions for multi-row state transitions.
- Keep algorithm business logic in testable TypeScript domain modules, even when persistence uses Postgres.
