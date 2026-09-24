# Open Decisions / Do Not Guess

These items are intentionally not frozen.

## Algorithm 1 exact formula

Known inputs/semantics are frozen, but exact rotation-debt repayment, weighting, and urgency threshold are not.

Resolve through simulation + real override data.

## Algorithm 2 production rating model

Candidates:

- Team Elo,
- TrueSkill-style,
- bounded-margin TrueSkill-style.

Run simulations before choosing.

## Initial skill scale

Human labels are desired, but exact numerical mappings and uncertainty values are not frozen.

## Rating score-margin function

Must be bounded if used. Exact function is not frozen.

## Rating correction/recompute policy

Historical score correction may require recomputing sequential ratings forward. Exact V1 correction scope needs implementation judgment/product confirmation.

## Session PIN creation/rotation UX

Required semantics are known; exact PIN lifecycle/creation UX is not fully specified.

## Public payment destination visibility

Payment info should be available where useful, but exact privacy/public exposure should be reviewed during implementation.

## Finance correction policy

Auditability is required, but exact edit-vs-reversal strategy for finalized ledger entries can be refined in M4.

## Recap image visual design

Desired direction: game-character/build-card-like compact shareable summary. Exact visual system is not specified yet.
