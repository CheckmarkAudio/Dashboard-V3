# Google Calendar Two-Way Sync Execution Plan

Date: 2026-05-17

This is the active step-by-step plan for finishing calendar two-way sync without destabilizing the current live booking flow.

## Current State

Live production connection:

- Supabase project: `ncljfjdcyswoeitsooty`
- Live site: `https://dashboard-v3-dusky.vercel.app`
- Google account: `checkmarkaudio@gmail.com`
- Calendar target: `primary`

What works now:

- Checkmark bookings can push to Google Calendar.
- Google Calendar can then mirror into Apple Calendar, depending on Apple refresh behavior.
- Settings -> Database has a `Push pending bookings` recovery button.
- Booking detail shows whether a booking is `synced`, `pending`, or `error` with Google.
- `google-calendar-sync` has an admin-triggered `pull_inbound_changes` action for already-linked Google events.

What is not finished:

- True automatic Apple/Google -> Checkmark sync is not live.
- Brand-new Apple/Google-only events are not imported into Checkmark.
- Inbound sync needs a production smoke test on one already-linked event before the team relies on it.
- Conflict handling is still basic and should remain conservative.

## Operating Rule Until Phase 2 Is Proven

Checkmark is still the source of truth.

Use this rule with the team:

> If it is not in Checkmark, it is not officially booked.

Apple Calendar is currently a mirror/viewing surface. Google Calendar is the transport layer.

## Non-Negotiable Guardrails

Every slice must preserve:

- Clean, DRY code.
- Performance: no unnecessary polling, no broad background loops, no full-calendar imports by default.
- Accessibility: visible status, real buttons, useful labels, no color-only meaning.
- Security: admin/owner-only sync controls, team-scoped writes, no service-role cross-team writes.
- Data safety: no hard-delete from external calendar deletes; no silent import of unmatched events.

## Phase 2A Goal

Controlled manual inbound sync for already-linked events only:

`Checkmark <-> Google Calendar <-> Apple Calendar`

Scope:

- Pull changes from Google/Apple edits into existing Checkmark bookings.
- Match only by `sessions.google_event_id`.
- Allowed inbound fields: client/title, date, start time, end time, room/location, notes.
- External delete/cancel maps to Checkmark `cancelled`, not hard-delete.
- Unmatched external events are skipped for now.

## Step-By-Step Plan

### Step 1: Baseline Outbound Health

Goal: confirm current Checkmark -> Google path is healthy before touching inbound logic.

Checks:

1. Create a future test booking in Checkmark.
2. Open the booking detail modal.
3. Confirm the Google row says `synced`.
4. Click the Google `Open day` link.
5. Confirm the event exists on that date in Google Calendar.
6. Refresh Apple Calendar and confirm whether Apple mirrors it.

Pass condition:

- The Checkmark booking has `google_sync_status='synced'`, a non-null `google_event_id`, and no sync error.

If fail:

- Do not start inbound work.
- Fix outbound first.

### Step 2: Manual Inbound Smoke Test

Goal: prove one external edit can update one existing Checkmark booking.

Use one synced, non-client-critical test booking.

Test:

1. Open the synced booking date in Google Calendar using the booking detail `Open day` link.
2. Open the matching Google event on that day.
3. Change only the start/end time by a small amount.
4. Save in Google Calendar.
5. In Checkmark Settings -> Database, click `Pull inbound changes`.
6. Reopen the booking in Checkmark.
7. Confirm the Checkmark booking date/time updated.

Pass condition:

- Checkmark updates the correct `sessions` row.
- `calendar_last_changed_source='google'`.
- `google_sync_status='synced'`.
- No unrelated booking changes.

If fail:

- Capture the exact UI error.
- Query that one `sessions` row by id.
- Fix the smallest issue in `google-calendar-sync`.

### Step 3: Inbound Field Verification

Goal: verify the allowed inbound field set one field at a time.

Test separately:

- Time change.
- Date change.
- Title/client-name change.
- Location/room change.
- Description/notes change.
- Google cancel/delete.

Pass condition:

- Each allowed field changes in Checkmark as expected.
- External cancel maps to `status='cancelled'`.
- No hard-delete occurs.

Stop condition:

- If any field maps unpredictably, disable or narrow that field before continuing.

### Step 4: Conflict Safety

Goal: avoid silent overwrites when Checkmark and Google both changed the same booking.

Minimum safe implementation:

- Compare `calendar_last_changed_source`.
- Compare `calendar_last_changed_at`.
- If both sides changed recently, do not auto-apply inbound.
- Surface a visible warning or skip count.

Suggested conflict window:

- 5 minutes.

Pass condition:

- A near-simultaneous Checkmark + Google edit does not silently overwrite one side.

### Step 5: Admin Visibility

Goal: make sync state legible without opening Supabase.

Current visibility:

- Settings shows connected account, pending outbound bookings, inbound summary, inbound error.
- Booking detail shows Google sync status and link.

Next visibility to add:

- Last Google push time on booking detail.
- Last inbound pull time on booking detail or Settings.
- Better skipped/conflict counts after inbound pull.
- A small "needs attention" list for sync errors.

### Step 6: Optional Automation

Only after Phase 2A is proven manually:

- Add a scheduled sync or webhook path.
- Keep manual `Pull inbound changes` as the fallback.
- Do not auto-import unmatched external events yet.

Recommended first automation:

- Low-frequency scheduled pull for linked events only.

Avoid for now:

- Full live webhook complexity.
- Silent import of new Apple-only events.
- External hard-deletes.

## What To Work On Next

Immediate next Codex task:

1. Run Step 2 manual inbound smoke test.
2. If it fails, patch `google-calendar-sync` narrowly.
3. If it passes, document the exact result and move to Step 3.

## Lessons Learned

### 2026-05-17: Google event id is not a Google web URL

Observed failure:

- Booking detail showed `Google: synced` with a non-null `google_event_id`.
- Clicking the original `Open` link navigated to `calendar.google.com/calendar/u/0/r/eventedit/{google_event_id}`.
- Google returned a `500` page.

Interpretation:

- `google_event_id` proves the API event exists, but Google Calendar's web UI does not accept the raw API event id in that URL shape.
- Until we store Google's `htmlLink` or build the correct encoded `eid` link with calendar id, the safe link target is the Google Calendar day view.

Decision:

- Booking detail should link to `Open day`, not raw event edit.
- Use the day view to manually confirm whether the synced event exists in Google.
- If Google shows the event but Apple does not, the issue is Apple calendar selection/refresh/mirroring, not Checkmark outbound sync.

### 2026-05-17 Lesson: inbound pull must be bounded

Observed:

- `Pull inbound changes` could spin continuously after reconnect.
- The worker was allowed to page through the connected Google Calendar without a date window on its first full scan.

Decision:

- First recovery/full scans are limited to the recent/future booking window and capped by page count.
- The app timeout stops the button from staying in a loading state forever.
- Do not store a Google `nextSyncToken` produced from the bounded recovery scan; Google sync tokens are tied to the exact query shape that produced them.

Follow-up:

- Phase 2B should replace the recovery scan with a linked-event-specific lookup strategy or a stable incremental token strategy.
- If Checkmark shows `Synced` but Apple does not, first verify the event appears in Google Calendar day view. Apple can lag or mirror the wrong Google calendar.

Good Claude-safe boundary:

- Codex owns calendar sync, edge functions, Supabase sync-state logic, and calendar runbooks.
- Claude can keep working on unrelated UI/export polish as long as it does not touch:
  - `src/lib/googleCalendar.ts`
  - `src/lib/calendar.ts`
  - `src/components/calendar/*`
  - `src/pages/admin/AdminSettings.tsx`
  - `supabase/functions/google-calendar-*`
  - Google calendar docs/runbooks

## Quick Recovery Commands

Build:

```bash
npm run build
```

Deploy auth function:

```bash
supabase functions deploy google-calendar-auth --project-ref ncljfjdcyswoeitsooty
```

Deploy sync function:

```bash
supabase functions deploy google-calendar-sync --project-ref ncljfjdcyswoeitsooty
```

Inspect recent session sync rows:

```bash
supabase db query --linked "select id, client_name, session_date, start_time, end_time, status, google_event_id, google_sync_status, google_sync_error, google_last_synced_at, calendar_last_changed_source, calendar_last_changed_at, created_at from public.sessions where team_id = '00000000-0000-0000-0000-000000000001' order by created_at desc limit 12;"
```

## Done Definition

Two-way sync is ready for daily team use when:

1. Checkmark create/edit/cancel reliably pushes to Google.
2. Google/Apple edits to already-linked events reliably pull into Checkmark.
3. External cancels do not hard-delete Checkmark data.
4. Unmatched external events are skipped or queued, not silently imported.
5. Sync errors are visible in the app.
6. The team has a clear operating rule for where booking changes should happen.
7. The runbooks are updated with the verified production behavior.
