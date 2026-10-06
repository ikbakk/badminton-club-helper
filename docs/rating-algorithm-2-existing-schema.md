# Algorithm 2 — Existing Schema Definition (Phase 0)

## Current Tables

The repository's authoritative initial migration defines these reusable structures:

| Table                            | Relevant current columns and constraints                                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `players`                        | `id` PK, `club_id` FK, display/membership metadata.                                                                                                                                                       |
| `player_ratings`                 | `player_id` PK/FK, `rating numeric NOT NULL DEFAULT 1200`, `uncertainty numeric NOT NULL DEFAULT 0.7 CHECK >= 0`, `updated_at`.                                                                           |
| `player_rating_history`          | UUID PK; `player_id` FK; nullable `set_id` FK; source restricted to `SET_RESULT`, `MANUAL_ADJUSTMENT`, `INITIALIZATION`; before/after rating and uncertainty; nullable `algorithm_version`; `created_at`. |
| `matches` / `sets`               | Match has session sequence; set has one/two match number, status and final scores. A completed set has non-null unequal scores.                                                                           |
| `set_players`                    | `(set_id, player_id)` PK with actual `team` A/B. This is the authoritative actual lineup, including a Set-2 substitution.                                                                                 |
| `pairing_recommendations`        | `match_id` FK, algorithm version, diagnostics.                                                                                                                                                            |
| `pairing_recommendation_players` | `(recommendation_id, player_id)` PK, recommended A/B team and rating/uncertainty snapshots.                                                                                                               |
| `session_events`                 | Append-only event record used by existing session commands.                                                                                                                                               |

## Relationships

```text
players ── player_ratings
   │
   └── player_rating_history ── set_id ── sets ── set_players
                                       │
                                     matches ── pairing_recommendations
                                                    └── pairing_recommendation_players
```

## Current Write Paths

| Operation            | Current RPC / path       | Current rating behavior                                                               |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| Roster player        | `add_roster_player`      | Inserts `1200 / 0.7`.                                                                 |
| Guest check-in       | `add_guest_and_check_in` | Inserts `1200 / 0.7`.                                                                 |
| Match start          | `start_match`            | Creates Set 1 and actual `set_players`; no rating update.                             |
| Set completion       | `complete_set`           | Completes set/lifecycle and creates Set 2 lineup from actual Set 1; no rating update. |
| Substitution         | `substitute_player`      | Changes actual Set 2 `set_players`; no rating update.                                 |
| Score correction     | `correct_completed_set`  | Updates active-match completed score only; no rating replay.                          |
| Manual rating change | none found               | No existing authoritative adjustment command.                                         |

The latest deployed authorization functions use authenticated Club Admin authority through `valid_operator_lease(session, null)` compatibility parameters; no PIN/lease is the authority source.

## Existing vs Missing

| Capability               | Existing                   | Reusable    | Change required                                                       |
| ------------------------ | -------------------------- | ----------- | --------------------------------------------------------------------- |
| Current player rating    | Yes                        | Yes         | Add algorithm-version metadata and migrate sigma scale.               |
| Uncertainty              | Yes, legacy 0.7 scale      | Column only | Explicit conversion to Algorithm 2 sigma units.                       |
| Per-set history          | Yes                        | Yes         | Add replay source and unique per-player/set/version protection.       |
| Algorithm version        | History only, nullable     | Yes         | Add current-state version.                                            |
| Actual set lineup        | Yes                        | Yes         | Use directly; never use recommendation lineup.                        |
| Pairing recommendation   | Yes                        | Yes         | Persist from trusted server only after rating path exists.            |
| Idempotent rating result | No                         | No          | Unique `SET_RESULT` row per player/set/version plus state validation. |
| Forward replay           | No                         | No          | Authoritative replay command/function required.                       |
| Manual correction anchor | History column supports it | Partial     | Needs timeline ordering/anchor semantics and an RPC before supported. |

## Constraints / RLS / Grants

Remote catalog inspection confirmed PK/FK/check constraints above, including no existing uniqueness constraint for `(player_id, set_id, algorithm_version)` in rating history. The rating tables are RLS-enabled through the existing security migration. The later authorization-hardening migration revokes direct DML from `anon` and `authenticated`; writes must remain guarded commands.

## Legacy Compatibility Risk

`uncertainty=0.7` is **not** compatible with selected model sigma 45–350 (newcomer 280, established 65). It must never be interpreted as sigma 0.7 by the selected model.

Minimal deterministic strategy:

1. Preserve rating centre values (1200 remains the selected model centre).
2. Migrate every existing `player_ratings.uncertainty` into sigma 280 because there is no prior rating history/model version from which confidence can be recovered safely.
3. Add an `INITIALIZATION` history anchor for each migrated player recording its pre-migration rating and the new sigma, versioned as `trueskill-style-bounded-margin-v1`.
4. Change roster/guest creation to `1200 / 280` with the same initialization anchor.
5. Do **not** retrospectively rate historical completed sets, because doing so would mix an unversioned legacy period with a new selected model without an explicit historical recalibration decision.

## Proposed Minimal Migration

Extend—not replace—existing structures:

- `ALTER player_ratings ADD algorithm_version text NOT NULL` after a deterministic backfill.
- extend history source check with `REPLAY`; add a partial unique index for `SET_RESULT` rows `(player_id, set_id, algorithm_version)`.
- add a stable replay ordering key/metadata only if required; existing canonical order can be session start, match sequence, set number, set id.
- replace authoritative `complete_set` and `correct_completed_set` with commands that invoke one canonical trusted rating implementation and persist history/current state atomically.

## Live Data Compatibility Inspection

After `SUPABASE_DB_PASSWORD` was configured, `npx supabase projects list`, a linked `select 1`, and read-only aggregate queries succeeded against active linked project `badminton-club` (`zjqqjgdrojhqiylapvqd`). Migration history is current through `20261005140000`.

| Inspection                  | Result                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Current ratings             | 9 rows; rating range 1120–1280; 2 at 1200 and 7 non-default ratings.                                                                         |
| Current uncertainty         | Range 0.35–0.7; 1 row at 0.7 and 8 rows at another legacy value. All values are incompatible with Algorithm 2 sigma units.                   |
| Rating history              | 0 rows: no `SET_RESULT`, `INITIALIZATION`, `MANUAL_ADJUSTMENT`, versioned, or unversioned history exists.                                    |
| Completed sets              | 26 completed sets.                                                                                                                           |
| Malformed completed lineups | 0 completed sets have a lineup count other than four.                                                                                        |
| Algorithm 2 boundary        | No Algorithm 2 history exists, so migration application can establish a clean V1 rating era without overwriting authoritative model history. |

The non-default ratings are retained as existing approximate skill priors. Their associated legacy confidence values cannot be interpreted or reconstructed because no history exists. Therefore all nine current players receive the same high new-model sigma (280), regardless of whether their legacy value was 0.35 or 0.7. This intentionally discards only incompatible legacy confidence semantics, not rating values.

## Phase 0 Gate

**EXISTING SCHEMA GATE: PASS**

The compatibility policy is frozen: preserve every current numeric rating; convert all legacy uncertainty values to 280; add a versioned initialization anchor; initialize future roster/guest players at 1200/280; and do not rate the 26 pre-era completed sets retroactively.
