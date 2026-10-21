# Courtside visual revamp — implementation review

The implementation follows the approved landing, Live and player-profile concept. Forest green, chalk and clay now carry across shared controls, the desktop sidebar, persistent mobile navigation, club pages, login/recovery and the local demo. Player identity and recorded rating lead the profile; Live uses one dark court panel with compact participant rows.

## Preserved behavior

Final set scores remain the scoring input. Rotation recommendations, manual overrides, substitutions, authorization, payment destinations, retry behavior and recent authentication transitions retain their existing data contracts. Public viewers receive no substitution/start-set controls. The landing and demo use explicitly fictional local data and make no backend requests. No database migrations or domain changes are included.

## Review corrections

- Light surfaces give all between-set/substitution steps readable text.
- Account actions sit in the account menu; logout regression tests open that menu.
- Bottom navigation reserves content space on mobile and tablet until the desktop sidebar starts.
- Small-screen account buttons and cancellation actions retain 44px targets.
- The session-close clay action uses dark text; the local demo has one primary heading.
- Between-set actions use equal columns; substitution actions retain unbroken labels.

Fresh whole-branch review found no remaining Critical or Important issues and accepted fidelity to the approved concept.

## Verification

`npm run verify` passed: Prettier/ESLint, Svelte check (0 errors, 0 warnings), staging-target checks, 98 unit tests, 53 browser tests and production build. Three credential-dependent unit/integration tests were skipped. Browser fixtures use synthetic data; no remote database writes are required. Credential-dependent integration tests remain intentionally skipped.

## Visual evidence

Actual application screenshots are captured after fonts and images load at 1440px, 800px, 390px and 360px for landing, Live and profile, with representative roster, history, fund, settings, auth, demo and between-set mobile screens. Every captured page had scroll width equal to its viewport and all image assets loaded. Substitution steps and both close-session stages were also inspected. These renders use fixtures, so names, scores and totals are examples rather than production club data. The generated concept is a direction reference; actual controls preserve the application’s final-score workflow rather than the concept’s illustrative point buttons.

## Asset provenance

`static/images/club-night.webp` is an original generated editorial photo, optimized to WebP. It uses the user-approved concept board as loose visual direction. The app interface is implemented independently in Svelte/HTML. Exact generation prompt:

> Produce ONLY an editorial sports photograph asset, no website UI, no typography, no text, no logos. Use the photograph portion of the attached concept board as loose art direction: authentic casual Indonesian indoor doubles badminton on forest-green court, three to four adult players in real sportswear, one player nearer camera seen from behind on RIGHT side of composition with racket in hand, another player across net, natural overhead sports hall lights. Landscape wide 3:2 photograph. Left 35 percent is quiet green court/hall for website composition, human action on right. Natural anatomy and realistic badminton equipment, no tennis, no rackets with giant heads. Warm neutral lighting, deep forest #163630, muted cream court lines, small clay orange detail. Premium documentary sports photography, crisp photographic realism, no fake badges, text, watermarks or graphic elements. Background wall blank. This will be used as the right-side hero photo behind an independent HTML app preview on cream landing page.

Manrope is self-hosted with its bundled OFL license. The existing Barlow Condensed heading font is retained.

## Handoff

This branch is for visual review. Merge requires separate authorization after the user reviews the implemented result.
