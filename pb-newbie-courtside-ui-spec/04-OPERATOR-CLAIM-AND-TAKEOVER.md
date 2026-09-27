# Operator Claim, Resume & Takeover

## Entry

When LIVE and device has no lease:
`[ Operate this session ]`

Permanent admin login is not required.

## PIN UI

Use a mobile numeric dialog/bottom sheet:

```text
Operate session

Enter session PIN
[ • • • • ]

[ Continue ]

Anyone with the PIN can operate tonight's session.
```

Follow backend PIN length; do not hardcode a length unnecessarily.

Never store raw PIN after verification.

## Wrong PIN

Inline: `That PIN isn't correct. Try again.`

## Claim

If no active lease, issue device lease, persist only opaque lease credential, refetch, and show operator controls.

## Takeover

If another lease exists, correct PIN must not immediately revoke it:

```text
Session already has an operator

Another device currently controls this session.
Taking over will make that device read-only.

[ Cancel ] [ Take over ]
```

## Resume

If current device still owns valid lease, restore silently and refetch.

## Lease rejected

Immediately disable controls, clear local lease, refetch, and show:

```text
Session control moved to another device.
You can still follow the session here.

[ Operate this session ]
```

Admins obey the same one-active-device rule.
