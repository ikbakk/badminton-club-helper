# Design system

## Court Lines

PB NEWBIE is a mobile-first courtside interface. Its visual system treats the Live surface as a court object: the live match owns the strongest field, waiting players read as the sideline, and the next irreversible action uses clay orange.

### Color roles

- **Court ink:** `#163630` — Live field, primary navigation, high-priority score context.
- **Chalk:** `#fffaf0` — primary reading surface and controls.
- **Court ground:** `#f4f1e8` — page background.
- **Sideline:** `#b9c5bb` and `#e5ece5` — structural rules and quiet status fields.
- **Action clay:** `#e2653e` — primary operator action and focus accent.
- **Signal gold:** `#f5bb61` — live-state indicator only.

### Layout and components

- Use clean one-pixel rules, square or lightly softened corners, and soft downward shadows; avoid stacks of rounded cards.
- The header is quiet; Live carries the page’s primary state.
- The Court panel is dark and has faint internal court markings. Team names and final scores are always the visual center of an active match.
- Participant groups are compact sideline lists with text labels and an explicit count. Color supplements, never replaces, participant status.
- Sheets retain the club context with chalk ground, court-ink copy, and wide one-handed actions.
- Primary actions are clay-orange. Destructive actions are distinct but never compete with scoring.

### Type and motion

- Use a compact, bold sans treatment for club name, match labels, player names, and score inputs; do not introduce display typography that weakens courtside scanability.
- Set and score changes use a single short reveal. It respects `prefers-reduced-motion`.
- Focus, selection, form controls, and scrollbars are themed from the same court palette.

### Voice

- Indonesia-first, direct, and action-led: `Operasikan sesi`, `Check in pemain`, `Siapkan match`.
- Avoid admin-dashboard terminology during courtside operation. The next safe action should be clear without a tutorial.
