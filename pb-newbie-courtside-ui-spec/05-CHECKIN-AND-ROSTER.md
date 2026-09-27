# Check-in, Roster & Availability

## Primary action

Before play:
`[ Check in players ]`

## Check-in screen

Optimize for fast taps:

```text
Check in players                         [Done]

Search players...

HERE
✓ Sarah          READY
✓ Andi           READY

NOT HERE
○ Iqbal
○ Budi
○ Nisa
○ Fajar

[ + Guest ]
```

Tap NOT HERE -> immediately check in as READY, record timestamp/event/status period, move to HERE. No confirmation.

## Add guest

```text
Add guest

Name
[ Rafi ]

Approximate level
[ Low Intermediate ▾ ]

[ Add & check in ]
```

If a matching recent guest exists, offer reuse. Do not build complex identity resolution.

## Player quick actions

Tap checked-in non-playing player:

```text
Sarah
READY • waiting 18m

[ Rest ]
[ Away ]
[ Out ]
[ Leave ]
[ Leave after next match ]
```

Only show valid transitions.

## Live groups

```text
READY (6)
Sarah       18m
Budi        14m
...

RESTING (1)
Dimas

AWAY (1)
Fajar
```

Use text labels, never color alone.

Returning RESTING/AWAY -> READY starts a new current READY wait from zero. Historical eligible wait remains derivable.
