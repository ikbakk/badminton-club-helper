---
name: Courtside
description: Sport editorial identity for casual badminton clubs
colors:
  ink: '#163630'
  deep: '#0c241f'
  chalk: '#fffaf0'
  ground: '#f4f1e8'
  soft: '#e5ece5'
  line: '#d6ddd3'
  muted: '#38675b'
  action: '#e2653e'
  action-deep: '#a94225'
typography:
  display:
    fontFamily: Barlow Condensed, sans-serif
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: '-0.025em'
  body:
    fontFamily: Manrope, sans-serif
    fontWeight: 400
    lineHeight: 1.7
  title:
    fontFamily: Manrope, sans-serif
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: '-0.035em'
rounded:
  control: 6px
  panel: 10px
spacing:
  compact: 8px
  field: 16px
  mobile-page: 20px
  section: 24px
components:
  button-primary:
    backgroundColor: '{colors.action}'
    textColor: '{colors.deep}'
    rounded: '{rounded.control}'
    height: 44px
    padding: 11px 17px
  button-secondary:
    backgroundColor: '{colors.chalk}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    height: 44px
    padding: 11px 17px
---

# Courtside design system

## Overview

The approved three-screen concept (landing, Live mobile, player profile) is the visual reference. The identity pairs expressive badminton photography and condensed landing type with restrained operational screens. App state and the next action receive emphasis; decoration stays secondary.

## Colors

Ink carries match context and headings. Chalk is the reading surface, ground separates sections, and soft green identifies avatars and quiet fields. Clay is the primary action; dark text on clay is required. Use action-deep for small accent text on light surfaces. Gold indicates a live state, never a general marketing accent. Keep body contrast at least 4.5:1.

## Typography

Self-hosted Manrope is the operational and body family. Barlow Condensed 800 belongs to landing display headings only. Operational names and headings are bold but compact; score numerals are large and tabular. Long names wrap in content and truncate only in the space-constrained club header. Labels stay readable without pervasive uppercase tracking.

## Layout

Mobile pages use approximately 20px side gutters, a quiet club header, and four persistent bottom navigation destinations: Live, Pemain, Riwayat and Kas. Admin settings remain in the header. Account/share actions stay reachable; Live's logout is inside the native account menu. Reserve bottom space including safe-area inset so final controls can scroll clear of navigation.

Desktop uses a 224px sidebar and a centered content column. Landing has its own wide editorial composition: headline left, badminton photograph right, compact match preview and overlapping next-player panel. Its lower walkthrough uses a different composition rather than repeating the photograph.

## Elevation & Depth

Use restrained downward shadows for the landing preview, account menu, modal layers and important panels. Ordinary content is separated by fine structural rules. No hard offset shadows, decorative halos or oversized background words.

## Shapes

Controls use the control radius, panels use the panel radius, and initials avatars are circular. Sheets round the top edge while retaining full mobile width. Forms, selectable rows and notices inherit these shapes.

## Components

`AppButton` owns primary, secondary, ghost and danger variants. `Avatar` owns initials and size variants; `BrandMark` supplies the consistent two-stripe mark. `AuthFrame` supplies the shared sign-in/recovery composition. `AppShell` owns account/club context and responsive navigation. `QueryNotice`, `LoadingSkeleton`, `CourtSheet` and `CourtDialog` carry the same surface language.

Live uses one dark match panel per court. Multicourt sessions place the panels in a horizontal scroll-snap row with an explicit court selector and a visible next-panel edge; a single court stays full-width. All courts share the READY player pool. Score fields capture final set scores, not live point tracking. Keep advisory selection, manual override and between-set substitutions in their existing flows. Player profiles lead with identity and persisted rating, then per-session summaries and historical totals. Never substitute invented statistics for missing data.

## Do's and Don'ts

- Do keep role, offline, pending and error states explicit. Preserve visible existing data when a refresh fails.
- Do use the existing Lucide icon family and at least 44px touch targets.
- Do label landing/demo records as fictional and keep them independent of backend state.
- Do respect reduced motion and retain keyboard focus visibility.
- Don't use the concept's incidental dates, score counters, badges or photo lettering as new feature requirements.
- Don't expose admin controls to public visitors or change algorithm semantics during visual work.

## Shared session recap

The downloadable recap follows the approved green-and-chalk attendance card: club and date, player/court/match/set counts, the complete attendee roster in two columns, then optional session fees and payment counts. Match-by-match results are omitted. The court metric is labeled “Court dipakai” and counts distinct courts in recorded matches; the public history read model does not expose configured session court count. Empty sessions show zero courts used.

`src/lib/features/history/share-card.ts` owns the self-contained SVG source. `src/lib/assets/recap-court.svg` supplies the reusable court and shuttlecock ornament. Embed the existing Manrope font, escape dynamic text, wrap long names, and increase height for larger rosters. Preview and SVG download use that source; a single final rasterization produces the PNG for WhatsApp. Export and share actions wait until the PNG is ready.
