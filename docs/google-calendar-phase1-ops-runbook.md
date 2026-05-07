# Google Calendar Phase 1 Ops Runbook

## Purpose

This runbook explains how Checkmark booking sync works during **Phase 1** and how the team should use it day to day so no bookings are missed.

Phase 1 is:

`Checkmark -> Google Calendar -> Apple Calendar`

It is **not** true two-way sync yet.

---

## Source Of Truth

**Checkmark is the source of truth.**

That means:

- If a booking is not in Checkmark, it is not officially booked.
- Apple Calendar is a mirrored viewing surface during Phase 1.
- Google Calendar is the sync hub between Checkmark and Apple Calendar.

Do **not** create or edit official bookings directly in Apple Calendar during Phase 1.

---

## What Syncs In Phase 1

When a booking is created or edited in Checkmark, it should sync out to:

1. Google Calendar
2. Apple Calendar

Expected Phase 1 behavior:

- New Checkmark bookings appear in Google Calendar.
- Updated Checkmark bookings update in Google Calendar.
- Cancelled Checkmark bookings are removed from Google Calendar.
- Apple Calendar reflects those Google Calendar changes because the Google account is already connected there.

What does **not** happen yet:

- New Apple Calendar events do not come back into Checkmark.
- Edited Apple Calendar events do not update Checkmark.
- Deleted Apple Calendar events do not update Checkmark.

---

## Team Rule

Use this exact rule internally:

**If it is not in Checkmark, it is not booked.**

Recommended operating habit:

- Use Checkmark to create bookings.
- Use Checkmark to edit bookings.
- Use Apple Calendar to view schedule context.
- If someone notices a problem in Apple Calendar, correct it in Checkmark.

---

## Daily Workflow

### For admins

1. Create or edit bookings in Checkmark.
2. Confirm important changes appear in Apple Calendar.
3. If a sync issue is suspected, treat Checkmark as correct until proven otherwise.

### For staff

1. Check Apple Calendar for schedule awareness.
2. Check Checkmark when confirming official booking details.
3. Do not add official client bookings directly in Apple Calendar.

---

## Go-Live Checklist

Before relying on the sync for real bookings, verify all of these:

1. Create a test booking in Checkmark.
2. Confirm it appears in Google Calendar.
3. Confirm it appears in Apple Calendar.
4. Edit the booking title, date, or time in Checkmark.
5. Confirm the change appears in Google Calendar.
6. Confirm the change appears in Apple Calendar.
7. Cancel the booking in Checkmark.
8. Confirm it disappears from Google Calendar.
9. Confirm it disappears from Apple Calendar.

If any of these fail, do not treat Apple Calendar as authoritative.

---

## If Something Looks Wrong

### Case 1: Booking is correct in Checkmark but wrong or missing in Apple Calendar

Action:

1. Check Google Calendar first.
2. If Google is correct, Apple likely has a refresh delay.
3. Wait briefly and refresh Apple Calendar.
4. Do not recreate the booking manually in Apple Calendar.

### Case 2: Booking exists in Apple Calendar but not in Checkmark

Action:

1. Assume it is not officially booked yet.
2. Search Checkmark carefully.
3. If it is truly missing, create or restore the booking in Checkmark.
4. Do not rely on the Apple-only event.

### Case 3: Someone changed a booking directly in Apple Calendar

Action:

1. Re-open the booking in Checkmark.
2. Apply the intended change there.
3. Let sync push the update back out.

### Case 4: A client-facing booking is time-sensitive and sync seems delayed

Action:

1. Use Checkmark as final confirmation.
2. Notify the team from Checkmark details if needed.
3. Do not create duplicate “backup” events in Apple Calendar unless clearly marked as temporary.

---

## Known Limitations

Current Phase 1 limitations:

- No inbound Apple-to-Checkmark sync
- No inbound Google-to-Checkmark sync
- Potential short delay before Apple reflects Google updates
- Manual discipline is required to avoid dual-entry mistakes

---

## Recommended Next Step

Phase 2 should add controlled inbound sync:

- Google/Apple edits on already-synced events can update Checkmark
- conflict rules determine which system wins
- externally created events need matching rules and audit visibility

Until Phase 2 is live, keep booking entry centralized in Checkmark.
