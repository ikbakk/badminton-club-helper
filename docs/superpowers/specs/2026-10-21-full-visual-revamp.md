# Courtside full visual revamp

## Approved direction

The user approved the three-screen concept board (landing, Live mobile, player profile) generated in this conversation on 21 October 2026. This board governs composition, density, palette, shape, hierarchy and component character. It supersedes the previous landing screenshot as visual authority. Its illustrative data, dates, incidental photo lettering and controls are not product requirements.

Preserve the existing product and flows. Start from main commit d867923dc1073770ffd33e2e2d727aa1a7ec4dbd, which includes the separate auth/loading correction. Retain subsequent unrelated changes when integrating.

## Visual system

- Forest ink #163630, chalk #fffaf0, ground #f4f1e8, muted green #38675b, clay #e2653e; #0c241f text on clay. Gold remains a live indicator.
- Landing uses the existing self-hosted Barlow Condensed 800. Operational screens use a self-hosted, licensed Manrope family with readable medium and bold weights. Score numerals are tabular.
- Controls have 6px corners; panels and sheets have 10px corners, fine rules and restrained soft elevation. Avatars use player initials without invented photographs.
- Keep touch targets at least 44px. Body and control text contrast is at least 4.5:1; large text at least 3:1. Support keyboard focus, reduced motion and bottom safe-area insets.
- Use the existing Lucide icon system consistently. No ornamental oversized background words or repeated stacks of heavy outlined cards.

## Landing

Rebuild the hero around the approved image composition: strong condensed heading on the left, authentic indoor badminton activity photography on the right, compact overlapping match and next-player previews. Use the app's redesigned visual components for the previews with clearly fictional local data. No auth, club or database requests on the landing page.

Headline: "Main bareng. Giliran lebih teratur." Preserve the tested phrase "Lebih banyak main" only where meaningful in body copy, or update the existing landing test to assert the approved headline. CTA: "Buat klub" and "Coba demo", linked to the existing signup and demo flows. Navigation remains usable on mobile. Below the hero, provide a concise feature strip and a distinct walkthrough section; do not repeat one background photograph twice.

## Application shell and operational pages

A quiet club header carries the club name, access context and existing account/share actions. On mobile, primary navigation sits at the bottom with Live, Pemain, Riwayat and Kas; settings stays discoverable for admins without exposing controls to viewers. Desktop uses the same hierarchy with suitable persistent navigation. Preserve routes, prefetch behavior and cached access resolution.

Live centers the match panel: two equal team columns, visible set context, large scores and one primary next action. Match preparation, advisory recommendations, manual overrides, corrections, abandonment and substitutions retain existing behavior. Do not add per-point score persistence or plus/minus counters merely because the concept image drew them. Show editable final set scores using the existing contract.

Below the court, prioritize next-match preparation and compact participant groups. Participant statuses and counts remain explicit; long names and 9–14 attendees must fit. Keep between-set, idle, pending and offline states understandable.

Player listing/profile use initials, readable names, membership labels, compact sections and authentic persisted ratings/results. Reorder existing profile content to reflect the board: identity, rating, recent-session summary, then history. Do not invent match statistics, ranked badges, radar charts or rating-history graphs unsupported by current data.

Apply the shared system to history and session detail, fund/payment details, session-close review and confirmation, settings, login/signup, recovery, club selection/creation, demo screens, sheets and dialogs. These surfaces inherit the board's system rather than each receiving a different visual identity.

## Copy and state continuity

Apply blader/humanizer as an editorial pass. Use natural Indonesian, specific actions and short labels. Preserve factual meaning and error recovery. Keep the separately merged auth transitions and input retention. Use stable shell-shaped skeletons, inline pending indicators, explicit recoverable errors and truthful empty states. Never show invented zero balances or an empty roster while a request failed.

## Scope boundaries

SvelteKit/Svelte 5, Tailwind 4 and existing data/query architecture remain. No database migrations, algorithm changes, new integrations or permission changes. Public viewers remain read-only. Admin check-in, one court, doubles, normal two-set flow and fees at session close remain.

## Acceptance

Inspect actual rendered landing, Live and profile against the board at desktop 1440px and mobile 390px, with a narrow 360px check. Exercise secondary pages and material states. No horizontal overflow, hidden actions or fake interactive preview controls. Confirm score entry, recommendation override, substitution, auth, history, fund, settings and close-session workflows through existing E2E fixtures. Run npm run verify. Record skipped remote checks honestly. User reviews the implemented visual result before a separately authorized merge.
