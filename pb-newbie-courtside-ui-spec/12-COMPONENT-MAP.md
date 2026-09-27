# Suggested Component / Command Map

Adapt to existing repository structure.

## Routes

```text
/live
/players
/players/[id]
/history
/history/[sessionId]
/fund
/auth/sign-in
/auth/recovery
/settings
```

No `/admin/*` family required.

## Live components

- LiveSessionHeader
- CourtCard
- ActiveMatchCard
- SetScoreForm
- BetweenSetsActions
- WaitingList
- ParticipantStatusGroups
- OperatorControlBar
- CheckInSheet
- ParticipantActionSheet
- GuestFormSheet
- PrepareMatch
- PlayerSelectionList
- TeamAssignmentCard
- SubstitutionSheet
- EndSessionDialog
- PostSessionFeeSheet
- OperatorPinSheet
- TakeoverDialog
- ConnectionBanner

## Server commands

Conceptually:

```text
claimOperator
takeOverOperator
checkInPlayer
addGuestAndCheckIn
changeParticipantStatus
setLeaveAfterMatch
prepareMatch
startMatch
completeSet
substitutePlayer
completeMatch
abandonMatch
correctSetScore
closeSession
reopenSession
confirmSessionFee
submitFinanceReport
```

## Domain placement

Keep rules in testable modules, not Svelte components:

```text
domain/session
domain/rotation
domain/rating
domain/pairing
domain/finance
```

## Live projection

Strongly consider a coherent Live projection returned by server:

```ts
{
	(session, operatorCapability, participants, activeMatch, recentCompletedMatch);
}
```

This reduces frontend coordination and makes Realtime invalidation/refetch simple.
