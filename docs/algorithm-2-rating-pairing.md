# Algorithm 2 — Rating and balanced pairing

## Production model

The active version is **`trueskill-style-bounded-margin-v1`**, a deterministic uncertainty-weighted doubles approximation, not full Classic TrueSkill. Rating state is `rating + sigma`.

- New initialization: rating 1200, sigma 280. Sigma is clamped to 45–350 and decays by 0.94 per rated completed set.
- Result update uses team mean ratings, Elo-style expected result, and `K=18 × sigma / 280` per player.
- Bounded score-margin multiplier: `1 + 0.35 × margin / (margin + 10)`; evidence is capped asymptotically at 1.35.
- Existing legacy rating values are preserved; legacy uncertainty is normalized to sigma 280 at migration. Sets before the explicit V1 era marker are not retroactively rated.

## Pairing

Algorithm 1 selects four players. Algorithm 2 evaluates exactly three partitions: AB/CD, AC/BD, and AD/BC. Team strength is the mean of the two ratings; recommend the smallest absolute raw team-mean gap with deterministic tie-breaking. The admin may choose another legal pairing. No sigma, gender, play-style, or variety penalty changes the production ranking. Pairing recommendations are advisory; actual `set_players` remain authoritative.

## Persistence, correction, and trust

Only a completed decisive set updates ratings, using its actual four players (including any Set 2 substitution). A trusted server endpoint verifies Club Admin authority, loads authoritative state, and computes the canonical domain transition. A service-role-only Postgres transaction locks and validates the match, set, lineup, ratings, and revisions before atomically committing score, history, rating state, and lifecycle changes. Retry protection prevents duplicate set effects.

Correcting a score performs deterministic forward replay in canonical session/match/set order from initialization anchors, replacing V1 result history and current states atomically. No manual rating-adjustment UI/command is part of V1. Historical pre-V1 sets remain outside replay.

## Verification and limitations

Coverage includes model behavior, bounded sigma/margin, all three pairings, actual-lineup substitutions, deterministic replay oracle, retries, and persistence/authority integration. Application verification passed for the deployed version. Ratings are advisory: doubles outcomes cannot isolate individual contribution perfectly, especially for repeated partners. See [real-session validation](real-session-validation.md) before retuning.
