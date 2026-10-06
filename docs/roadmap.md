# Roadmap

## Done

- Playable one-court live session and public read-only views.
- Club Admin authentication and authorized session/roster operations.
- Finance core and session close workflow.
- Algorithm 1 Smart Rotation with persisted actual-opportunity history.
- Algorithm 2 rating, balanced pairing, trusted persistence, and deterministic correction replay.
- Admin real-session evaluation tooling and JSON export.

## Now

- Validate with 3–5 real club sessions.
- Fix operational UX friction found courtside; use observed evidence rather than speculative algorithm changes.

## Later

- Session recap/share card.
- Settings and payment-destination polish.
- Security cleanup and deployment/operations hardening.

## Decisions

The production rotation thresholds and rating/pairing model are implemented and versioned. Changes should follow real-session evidence and tests; no open decision remains to choose Algorithm 2's model or freeze Algorithm 1's initial production policy.
