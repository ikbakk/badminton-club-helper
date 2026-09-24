# Coding Agent Guardrails

## Do not invent product requirements

If behavior is not defined in this pack and affects domain semantics, stop and mark it as an open question rather than silently inventing a feature.

## Hard V1 exclusions

Do not add:

- RSVP,
- self check-in,
- multiple courts,
- tournament system,
- coaching,
- court reservations,
- native app,
- ML,
- playstyle inference,
- rally-by-rally scoreboard,
- payment gateway,
- chat/social feed,
- elaborate leaderboard,
- charts unless explicitly requested.

## Architectural guardrails

- SvelteKit + TypeScript.
- Supabase/Postgres is current persistence/auth direction.
- TanStack Query is primary server-state/cache layer.
- Realtime is a thin Live invalidation layer, not application state.
- Server/Postgres is authoritative.
- Important writes are commands, not arbitrary CRUD.
- Use transactions for state-machine changes.
- Keep Algorithm 1 and Algorithm 2 as pure/testable TypeScript domain logic.
- Store algorithm versions and diagnostics.
- Store facts; derive statistics.
- Do not store money as float.
- Do not store raw session PINs/tokens.
- Do not expose service-role secrets to the browser.

## Domain guardrails

- One court.
- One active Session Operator device.
- Two sets per normal match.
- Opportunity is per match, not per set.
- Player remains PLAYING across the entire match.
- Substitution occurs between sets.
- Rating updates per completed set.
- Algorithm 1 selects four.
- Algorithm 2 only pairs those four.
- Fee is set after session closes.
- Payment is handled by Finance Admin.
- Guest uses normal player identity with guest membership marker.
- Viewer does not require an account.

## UI guardrails

Optimize for one-handed/mobile courtside use:

- large tap targets,
- minimal confirmation dialogs,
- clear current court state,
- fast roster check-in,
- avoid dense admin dashboards during play.

Confirm destructive/high-impact actions:

- end session,
- takeover operator lease,
- abandon active match,
- sensitive finance correction.

Do not expose internal algorithm decimals to normal viewers.

## Data integrity

Prefer DB invariants:

- one LIVE session/club,
- one IN_PROGRESS match/session,
- one participant/session/player,
- one open status period/participant,
- one obligation/session/player.

Use explicit audit/event records for corrections and overrides.

## Offline behavior

No offline mutation queue.

If offline:

- cached view may remain visible,
- mutation controls disabled,
- authoritative refetch on reconnect.

## Supabase inactivity strategy

Use an external scheduled maintenance/availability check roughly every 2 days.

It should perform legitimate lightweight application/database checks and surface failures.

Do not create fake badminton sessions or fake weekly activity records to manufacture activity.
