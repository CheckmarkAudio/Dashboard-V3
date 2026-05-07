# Google Calendar Sync Setup

Purpose: wire Checkmark's booking system to `checkmarkaudio@gmail.com` so:

- bookings created or edited in Checkmark sync into Google Calendar
- Apple Calendar reflects those events because the Google account is already connected there
- the team has one reliable operating policy while we finish true two-way sync

## Current state

Phase 1 is implemented in code.

What Phase 1 does:

- `Website -> Google Calendar -> Apple Calendar`
- new bookings sync outward
- booking edits sync outward
- booking cancellations remove the synced Google event
- session reassignments resync the event details

What Phase 1 does not do yet:

- `Apple/Google -> Website`
- direct event creation in Apple Calendar will NOT create a Checkmark booking
- direct event edits in Apple Calendar will NOT update Checkmark yet

## Safe operating policy for the next 1-2 weeks

Until Phase 2 ships, use this rule:

`If it's not in Checkmark, it's not booked.`

Recommended team behavior:

1. Create and edit bookings in Checkmark only.
2. Use Apple Calendar as the mirrored day-to-day viewing surface.
3. Do not create bookings directly in Apple Calendar unless you are prepared to manually enter the same booking into Checkmark immediately.
4. If someone must add something from a phone fast, add it to Checkmark in the browser on the phone.

This is the lowest-risk way to avoid split-brain scheduling while still getting the convenience of Apple Calendar.

## Files involved

- outbound OAuth flow: [supabase/functions/google-calendar-auth/index.ts](/Users/bridges/GITHUB/Dashboard-V3/supabase/functions/google-calendar-auth/index.ts)
- outbound event sync: [supabase/functions/google-calendar-sync/index.ts](/Users/bridges/GITHUB/Dashboard-V3/supabase/functions/google-calendar-sync/index.ts)
- shared Google helpers: [supabase/functions/_shared/googleCalendar.ts](/Users/bridges/GITHUB/Dashboard-V3/supabase/functions/_shared/googleCalendar.ts)
- client helpers: [src/lib/googleCalendar.ts](/Users/bridges/GITHUB/Dashboard-V3/src/lib/googleCalendar.ts)
- settings UI: [src/pages/admin/AdminSettings.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/pages/admin/AdminSettings.tsx)
- schema changes: [20260506130000_google_calendar_phase1.sql](/Users/bridges/GITHUB/Dashboard-V3/supabase/migrations/20260506130000_google_calendar_phase1.sql)
- admin RPC patch: [20260506133000_admin_sessions_google_event_fields.sql](/Users/bridges/GITHUB/Dashboard-V3/supabase/migrations/20260506133000_admin_sessions_google_event_fields.sql)

## Step 1: Create the Google Cloud OAuth client

Use the Google account that owns the calendar integration project. It does not have to be `checkmarkaudio@gmail.com`, but the OAuth consent flow will eventually be completed by the Google account you want to connect.

In Google Cloud Console:

1. Create or pick a project.
2. Enable `Google Calendar API`.
3. Configure the OAuth consent screen.
4. Create an `OAuth client ID`.
5. Choose `Web application`.
6. Add the authorized redirect URI:

```text
https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/google-calendar-auth
```

7. Copy:

- `Client ID`
- `Client Secret`

Notes:

- During local/dev testing you can add additional redirect URIs later if needed, but production should use the Supabase function URL above.
- The current implementation requests:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/userinfo.email`

## Step 2: Set Supabase function secrets

You need three secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Generate `GOOGLE_TOKEN_ENCRYPTION_KEY` as a long random string. Example:

```bash
openssl rand -base64 32
```

Then set the secrets:

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID" \
  GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET" \
  GOOGLE_TOKEN_ENCRYPTION_KEY="YOUR_LONG_RANDOM_SECRET"
```

## Step 3: Run the new migrations

If this project is linked to the correct Supabase project:

```bash
supabase db push
```

If you deploy SQL another way, make sure both new migrations are applied:

- `20260506130000_google_calendar_phase1.sql`
- `20260506133000_admin_sessions_google_event_fields.sql`

## Step 4: Deploy the new Edge Functions

Deploy both functions:

```bash
supabase functions deploy google-calendar-auth
supabase functions deploy google-calendar-sync
```

If your workflow prefers a single pass:

```bash
supabase functions deploy google-calendar-auth google-calendar-sync
```

## Step 5: Connect the Google account in the app

Once the migrations and functions are live:

1. Open `Admin Settings`.
2. Go to the `Database` section.
3. Use `Connect Google Calendar`.
4. Complete OAuth using `checkmarkaudio@gmail.com`.
5. Confirm the app shows the connected Google email.

Important expectation:

- Phase 1 currently targets the Google account's `primary` calendar.
- If you want a dedicated calendar like `Checkmark Bookings`, that is a good next refinement. The current code stores `calendar_id`, so switching from `primary` to a specific calendar is straightforward.

## Step 6: Test the exact behavior

Run this test in order:

1. Create a booking in Checkmark.
2. Confirm it appears in Google Calendar.
3. Confirm it appears in Apple Calendar.
4. Edit the booking in Checkmark.
5. Confirm the Google/Apple event updates.
6. Cancel the booking in Checkmark.
7. Confirm the Google/Apple event disappears.

Then run the non-supported test so everyone understands the boundary:

1. Create a brand-new event directly in Apple Calendar.
2. Confirm it appears in Google Calendar.
3. Confirm it does NOT appear in Checkmark.

That last result is expected until Phase 2 is built.

## Failure modes to watch for

Common issues:

- Google OAuth succeeds but the app shows no connection:
  - check redirect URI in Google Cloud
  - check Supabase function deployment
  - check function secrets

- Bookings save but do not appear in Google:
  - check `google_calendar_connections`
  - check Edge Function logs for `google-calendar-sync`
  - check `sessions.google_sync_status`
  - check `sessions.google_sync_error`

- Apple does not show updates:
  - verify the event exists in Google first
  - then confirm Apple Calendar is still syncing the correct Google account

## Recommended operational enhancement before Phase 2

If the team is nervous about missing bookings, add a short daily habit:

1. Open Checkmark first.
2. Compare today's bookings with Apple Calendar.
3. If anything exists only in Apple, enter it into Checkmark immediately.

That is simple, but it sharply reduces the chance of a two-week mismatch window causing a dropped appointment.

## Phase 2 target

Phase 2 should add:

1. Google Calendar webhook notifications
2. incremental sync token storage
3. import/update logic for Google-originated changes
4. conflict rules when Checkmark and Google both changed
5. a clear policy for unmatched Apple/Google-created events
6. sync audit logging

Recommended Phase 2 rollout:

1. import external edits on already-synced events first
2. then support external event creation
3. only then allow Apple/Google to behave like a full second write surface

That staged rollout is the safest way to accelerate without introducing silent conflicts.
