# Acceptance / E2E Scenarios

## Public viewer

Unauthenticated viewer sees PB NEWBIE and current live state with no mutation controls.

## Claim operator

Correct session PIN grants sole operator lease without permanent admin login; raw PIN is not retained.

## Takeover

Phone B with correct PIN sees warning, confirms takeover, Phone A's mutations are rejected and it becomes read-only.

## Check-in

Tap Budi once -> participant created once, READY, timestamps/status period/event recorded, viewer updates.

## Rest/return

READY -> RESTING closes READY period. RESTING -> READY opens new READY period and current wait starts from zero.

## First match

Exactly four READY selected -> one match IN_PROGRESS, four PLAYING, no second active match allowed.

## Two sets

Set 1 final score persists. Set 2 completes. Match completes and eligible players return READY.

## Substitution

Set 1 has Iqbal. Replace Iqbal with Rafi for Set 2 and mark Iqbal RESTING. Historical lineups remain correct.

## Offline

Operator loses network -> last state visible read-only, mutations disabled, no queued writes. Reconnect refetches and verifies lease.

## Close

No active match -> close confirmation -> CLOSED, periods finalized, post-session fee shown.

## Fee

Previous fee Rp15.000 is suggested. Confirming creates one obligation per attendee and zero automatic payments.

## Active-match protection

Attempt to close during IN_PROGRESS match is blocked until complete/abandon.

## Viewer realtime

Operator mutation causes viewer to receive/refetch updated authoritative state without manual refresh.

## Command failure

Score save failure preserves entered scores, shows retry, and does not falsely mark set complete.
