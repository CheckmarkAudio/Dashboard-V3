# Google Calendar Phase 2 Sync Spec

Date: 2026-05-07

This spec defines the intended behavior for **Phase 2** of calendar sync.

Phase 1 is already designed as:

`Checkmark -> Google Calendar -> Apple Calendar`

Phase 2 extends that into a controlled two-way system:

`Checkmark <-> Google Calendar <-> Apple Calendar`

Because Apple Calendar syncs through the connected Google account, the backend integration target remains **Google Calendar**, not Apple APIs directly.

## Rollout Gate

Phase 1 is already live on production and connected to:

- Google account: `checkmarkaudio@gmail.com`
- calendar target: `primary`

Phase 2 must be rolled out in a way that does **not** interrupt the
existing outbound path.

That means:

- keep current outbound sync behavior intact while inbound sync is added
- treat inbound sync as an additive worker/path, not a rewrite
- test every Phase 2 slice against live Phase 1 create/edit/cancel behavior
- preserve the team operating rule until inbound sync proves stable:
  **If it is not in Checkmark, it is not booked**

---

## Core Principle

Checkmark remains the operational system of record for studio bookings, even after Phase 2.

That means:

- external calendar edits are allowed, but they must reconcile back into Checkmark
- Checkmark keeps the canonical booking structure
- Google Calendar is the transport and change-notification layer
- Apple Calendar is a user-facing calendar client

The goal is convenience without letting multiple systems silently drift.

---

## Scope

Phase 2 covers:

- Google or Apple edits to already-synced Checkmark bookings
- detection of Google-side changes
- conflict handling between Checkmark and Google/Apple
- audit visibility on where a change originated

Phase 2 does **not** need to support every possible Google Calendar feature.

Out of scope unless later approved:

- attendee management
- recurring-series exceptions beyond the Checkmark recurrence model
- Google Meet link generation
- shared multi-calendar routing beyond the chosen team calendar
- arbitrary Apple-only metadata

---

## Source Of Truth Model

### Canonical record

The canonical booking record remains the row in `sessions`.

Google Calendar events are synchronized representations of that row.

### Canonical identity

Each synced booking must map one-to-one through:

- `sessions.id`
- `sessions.google_event_id`

The Google event should also keep a private metadata marker containing the Checkmark session id.

This identity mapping is mandatory for safe inbound sync.

---

## Allowed Inbound Changes

Phase 2 should begin with a **restricted inbound-edit set**.

Recommended allowed external edits:

- title / summary
- date
- start time
- end time
- notes / description
- room / location

Recommended Checkmark-only fields:

- internal workflow status beyond normal booking status
- hidden admin notes
- internal team assignment logic if you do not want Apple edits to change assignees yet
- anything used for analytics/flywheel logic that external calendars do not model cleanly

This keeps early two-way sync understandable and lowers the chance of silent damage.

## First Slice Being Built

The first implementation slice should be intentionally conservative:

- **manual admin-triggered inbound sync**, not background automation yet
- only for bookings that already have a `google_event_id`
- no auto-import of brand-new external events
- no hard-delete of Checkmark bookings from external deletes
- external cancels map to Checkmark `cancelled`

This lets the team test real Google/Apple edits against existing linked
bookings without interrupting the stable Phase 1 outbound path.

---

## Inbound Sync Cases

### Case 1: External edit to an already-synced booking

Example:

- staff changes time in Apple Calendar
- Google receives the event update
- Checkmark should update the matching `sessions` row

Expected behavior:

1. Google notifies Checkmark that the event changed
2. Checkmark fetches the latest event payload
3. Checkmark finds the matching session by `google_event_id`
4. Checkmark applies only the allowed inbound fields
5. Checkmark records the external update in audit metadata

### Case 2: External cancellation or deletion of an already-synced booking

Recommended behavior:

- do not hard-delete the session automatically
- instead mark it cancelled in Checkmark
- log that the cancellation originated externally

This is safer than deleting the booking row.

### Case 3: External event created directly in Google/Apple with no matching session

Recommended initial behavior:

- do **not** automatically create a Checkmark booking
- instead flag it as an unmatched external event
- surface it in an admin review queue or alert list

Reason:

Automatic creation sounds convenient, but it creates the highest risk of bad data, duplicate bookings, and incomplete required fields.

After the system proves reliable, a later phase can optionally allow:

- “import this external event into Checkmark”

but not silent auto-import at first.

---

## Conflict Rules

This is the most important part of Phase 2.

### Definition

A conflict exists when:

- Checkmark changed a booking
- Google/Apple also changed the same booking
- both changes happened close enough together that one should not silently overwrite the other

### Recommended first-pass rule

Use **last-write-wins with logging** only if the changes are outside a short conflict window.

Use **manual review** when both sides changed inside a short window.

Suggested window:

- 5 minutes

Meaning:

- if only Google changed after the last known Checkmark sync, apply it
- if only Checkmark changed, push Checkmark outward
- if both changed inside the conflict window, flag the booking for review instead of guessing

### Why not always last-write-wins

Pure last-write-wins is simple, but it is also how bookings get quietly corrupted.

For scheduling, silent overwrites are worse than visible review items.

---

## Delete And Cancel Policy

Recommended policy:

- external delete -> convert to cancelled session
- external cancellation semantics -> cancelled session
- Checkmark delete/cancel -> delete or cancel corresponding Google event as Phase 1 already expects

Do not automatically hard-delete a Checkmark booking because an external calendar event disappeared.

---

## Audit Requirements

Phase 2 should not ship without basic audit visibility.

Each synced booking should eventually be able to answer:

- when was it last synced
- what system changed it last
- what fields changed
- whether a conflict occurred
- whether the last inbound sync failed

Minimum recommended fields or equivalent audit model:

- `google_last_synced_at`
- `google_sync_status`
- `google_sync_error`
- `calendar_last_changed_source`
- `calendar_last_changed_at`

A separate event log table is even better if desired later.

---

## Sync Engine Requirements

### Notifications

Checkmark should subscribe to Google Calendar change notifications for the chosen calendar.

### Fetch model

On notification:

1. fetch changed events from Google
2. map them to Checkmark sessions
3. apply allowed updates
4. store sync result / errors

### Recovery

The system must tolerate missed notifications.

Recommended fallback:

- periodic reconciliation job
- re-fetch recent changes with Google sync tokens

Without this, one dropped webhook can leave calendars drifting.

---

## UI Requirements

Phase 2 should expose the sync state to admins clearly.

Recommended UI additions:

- current connection status
- last successful sync time
- last sync error
- unmatched external events list
- conflict review list

Nice-to-have:

- “External changes detected” badge
- quick diff view between Checkmark and external event state

---

## Rollout Strategy

Recommended rollout order:

### Phase 2A

Support inbound edits only for already-linked events.

Allowed:

- time/date/title/notes/location changes

Not yet allowed:

- external-event auto-import
- broad attendee/recurrence semantics

### Phase 2B

Add unmatched external event review queue.

### Phase 2C

Add optional import flow for unmatched external events if the team still wants it after real usage.

This staged rollout lowers risk dramatically.

---

## Team Policy During Early Phase 2

Even after inbound sync launches, the recommended policy is:

- Checkmark is still the safest place to create bookings
- Apple edits are allowed only after Phase 2A is verified
- unmatched external events must be reviewed before being treated as official

---

## Acceptance Criteria

Phase 2A is ready when all of these are true:

1. A synced Checkmark booking edited in Apple Calendar updates the correct `sessions` row.
2. A synced Checkmark booking edited in Google Calendar updates the correct `sessions` row.
3. Checkmark edits still push outward correctly after inbound sync is enabled.
4. External deletes do not silently remove booking rows; they convert safely to cancellation behavior.
5. Simultaneous edits within the conflict window are flagged instead of silently overwritten.
6. Sync failures are visible to admins.
7. Missed notifications can be recovered by reconciliation.

---

## Recommendation

Do not let Phase 2 begin as “full freeform Apple editing everywhere.”

Start with:

- linked-event inbound edits only
- restricted field set
- conflict review
- unmatched-event review queue

That gets most of the value of two-way sync without turning bookings into a silent data-merging problem.
