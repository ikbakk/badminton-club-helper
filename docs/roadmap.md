# Roadmap

## Done

- Playable one-court session, public read-only views, Club Admin operations, and finance/session-close workflows.
- Algorithm 1 Smart Rotation with persisted actual-opportunity history; deployment gate passed.
- Algorithm 2 rating and balanced pairing with trusted persistence and deterministic correction replay; deployment gate passed.
- Admin real-session evaluation and JSON export; automated application verification passes.
- Club profile and manual payment destination settings, with explicit opt-in to public display.

- Session recap image download and copyable text in closed-session History.
- Public landing, explicit club creation and club-scoped navigation; signup and password recovery.
- Shared query freshness and retry states across public surfaces; duplicate courtside-command guard.
- GitHub Actions verification on pull requests and main, plus disposable PostgreSQL read-model tests.
- First-session guidance, saved-session check-in transition, synchronization status and provisional admin rotation preview.
- Per-session player results/partners/rating summaries and result-only/native recap sharing.

## Now — V1 closeout

- Extend sessions to multiple courts with a shared READY pool and an optional deciding set after 1–1.
- Keep the repository and developer handoff clean, documented, and easy to verify.
- Validate the shipped workflow over 3–5 real club sessions; capture rotation/pairing feedback and courtside friction.
- Make operational UX fixes only when supported by observed use. Do not tune Algorithm 1 or Algorithm 2 during validation based on isolated observations.

## Later

- Further recap sharing polish based on real-session feedback.
- Further payment-destination polish based on real-session feedback.
- Deployment and operations hardening.
