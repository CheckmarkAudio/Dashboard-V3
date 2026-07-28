# Schedule UX Redesign Plan

Purpose: make schedule setup and changes obvious, including first-class vacation/time-off markers.

## Problem

The current schedule tools support real scheduling behavior, but the worker-facing choices are still clunky.

Known current implementation:

- `ScheduleRequestModal.tsx` supports:
  - single block
  - recurring weekly
- `WorkScheduler.tsx` supports:
  - pending requests
  - recurring weekly schedules
  - one-off blocks
- `useTeamSchedule.ts` reads:
  - `team_schedule_recurring`
  - `team_schedule_blocks`
- current schedule status model:
  - `pending`
  - `approved`
  - `denied`

Known gap:

- inspected types do not show a distinct vacation/time-off kind.

## Target Job

"Show me when I work, and let me request a normal schedule, a one-time change, or time off."

## Target Worker Choices

Use worker language:

1. Set weekly schedule
2. Request one-time change
3. Request vacation/time off

Avoid exposing:

- recurring rule
- block
- database status
- schedule template

## Vacation / Time-Off Direction

Vacation should be first-class.

Minimum UI behavior:

- clear button: "Request time off" or director-approved term
- date or date-range picker
- optional reason
- pending/approved/denied state
- distinct calendar marker
- visible in My Schedule and admin scheduler

Minimum data question:

- should time off be represented as a typed `team_schedule_blocks` row, a new table, or a separate request table?

Recommendation:

- Codex should inspect schema/RLS before implementation.
- Do not let Claude/Fable invent a time-off data model in a UI-only pass.

## Possible Data Models

### Option A: Add type to `team_schedule_blocks`

Example concept:

- `kind`: `work`, `time_off`, `coverage`, `unavailable`

Pros:

- reuses existing approvals and range logic
- lower implementation cost
- schedule overlays already understand blocks

Risks:

- existing code may assume every approved block means "working"
- calendar rendering must distinguish working vs unavailable

### Option B: New `team_time_off_requests` table

Pros:

- semantically clean
- avoids overloading "schedule block"
- easier future policy fields

Risks:

- new RLS, queries, mutations, UI, and calendar expansion logic
- larger implementation

### Option C: UI-only label on current blocks

Pros:

- fastest prototype

Risks:

- not production-safe
- likely confuses reporting and calendar behavior

Recommendation: Option A may be the best first implementation, but only after code and RLS review.

## Likely Implementation Path

1. Rename worker-facing choices in `ScheduleRequestModal`.
2. Split the form into three clearly labeled modes.
3. Keep existing one-time and weekly behavior working.
4. Add vacation/time-off data contract only after Codex review.
5. Update `WorkScheduler` pending review rows to show request type clearly.
6. Update calendar/My Schedule rendering so time off does not look like work time.

## Likely Files

- `src/components/schedule/ScheduleRequestModal.tsx`
- `src/components/admin/WorkScheduler.tsx`
- `src/components/dashboard/MyScheduleWidget.tsx`
- `src/components/members/ProfileWeeklySchedule.tsx`
- `src/lib/schedule/useTeamSchedule.ts`
- `src/lib/schedule/mutations.ts`
- `src/lib/schedule/expand.ts`
- `src/types/index.ts`
- `supabase/migrations/*`, only if adding schedule kind/time-off tables

## Non-Goals

- Do not implement payroll or PTO accounting here.
- Do not add Accountant concepts here.
- Do not change Google Calendar sync without a separate plan.
- Do not silently convert existing schedule blocks into time off.

## Acceptance Criteria

- workers can choose weekly schedule, one-time change, or time off without explanation
- admins can tell what kind of request they are reviewing
- vacation/time off does not appear as "working"
- mobile form is readable and thumb-friendly
- data model is explicitly reviewed before backend changes

## Locked Decisions (director-approved, 2026-07-24)

- **Term**: "Time off" is the exact user-facing term everywhere (button, badges, labels).
- **Who can create it**: both — members can request their own time off; admins can enter time off directly for any team member.
- **Approval**: member requests start `pending` and require admin approval (existing `approveBlock`/`denyBlock` path). Admin-entered time off is immediately `approved` — no review step.
- **Data contract**: Option A from below — `kind: 'work' | 'time_off'` on `team_schedule_blocks` (landed in migration `20260724100000_schedule_time_off_and_team_scope.sql`, PR #312). PR4B (this implementation) only wires the UI on top of that contract — no new tables, columns, or RLS.

<span style="color:#7c3aed">ASSUMPTION</span>: Time off affects employee availability but does not yet need payroll/accounting behavior.

## PR4B Implementation Notes (2026-07-24)

- `ScheduleRequestModal.tsx`: `TimeOffPlaceholder` replaced with a real `TimeOffForm` — start date + end date (same date = one day) + optional reason, submits `requestScheduleBlock({..., kind: 'time_off'})`. "Soon" badge removed.
- `WorkScheduler.tsx`: new "Add time off" admin action (`AdminTimeOffForm`, mirrors the member form's date-range shape) calling `createBlockAsAdmin({..., kind: 'time_off', status: 'approved'})`; pending-review rows and the approved one-off list both show a distinct "Time off" label + date-range (not time-range) display when `kind === 'time_off'`.
- `MyScheduleWidget.tsx` / `ProfileWeeklySchedule.tsx` / Calendar's Team Schedule tab: time off renders with a distinct sky-blue treatment (never the purple work-shift styling or a work wash block).
- **Bug found and fixed while implementing this**: `expandSchedule()` (`src/lib/schedule/expand.ts`) emits one row per one-off block, not one row per day it spans. Every UI surface that buckets entries "by day" (MyScheduleWidget's 7-day list, Calendar's Team Schedule tab) was keying off `starts_at`'s date only — a 3-day time-off request would only have appeared on its first day. Fixed by bucketing each entry into every day it overlaps, in the presentation layer only (`expandSchedule` and `resolveEffectiveWorkWindows` themselves were not touched).
- Full-day span convention: a time-off request stores `starts_at` = start date 00:00 local, `ends_at` = (end date + 1 day) 00:00 local (exclusive), so `resolveEffectiveWorkWindows`'s interval subtraction removes the entire day(s) regardless of what hours a work shift covers that day.

## Calendar page visual revamp (director brief, 2026-07-28)

Not started — logged in `docs/00_PROJECT_OS/00_PRIORITY_QUEUE.md`, not urgent. Director wants a
**preview/mockup first**, iterated in-chat, before any of this is built (same pattern used for
`HeaderActivityBar`). This section is the brief that preview should be built against.

### Problem, in the director's words

- "Team Schedule vs Booking calendar" — the tab toggle should be "extremely easy to notice."
- Employee-hours display: "I hate the grey icons, I dont like the purple, I dont like how we
  cant tell who is what."
- "We need to make sure that the hours match with the employee's schedule."
- Inspiration source named explicitly: Monday.com and "other planning scheduling apps."
- Separately, the schedule-edit modal: "the current modal but its unclear what an employees
  schedule is currently when they open the modal... I couldnt tell what I was updating or if i
  even had a set schedule to begin with... perhaps we need a visual breakdown of a person's
  current schedule so they can see while they are updating it."

### Where the current implementation lives

- Tab toggle + grid: `src/pages/Calendar.tsx` (`Bookings` / `Team Schedule 18` tabs, week grid
  below).
- Purple wash blocks: `bg-purple-700/15` (chips), `bg-purple-700/35` (default full-column wash,
  around line ~1296), `border-purple-500/*`, `text-purple-300` (the `+` add-shift icon).
- Grey/dimmed member avatars: `grayscale(1) opacity(0.45)` (dimmed) / `grayscale(1) opacity(0.85)`
  (hovered-but-not-this-member) around lines ~1328-1392, driven by `hoveredMemberId` state.
  **This default-greyscale-until-hover behavior was an explicit prior director decision, dated
  2026-05-27** ("can the icons be more greyed out and when you hover over them they light up to
  show you the schedule of the one you are hovering over?" — see the comment directly above the
  `hoveredMemberId` state declaration). The 2026-07-28 ask to make "who is what" identifiable
  without hovering is a change to that decision, not an oversight — worth confirming with the
  director whether the hover-highlight interaction should stay (just layered on top of
  always-identifiable colors/initials) or go away entirely.
- Schedule-edit modal: `src/components/schedule/ScheduleRequestModal.tsx` (see "Likely
  Implementation Path" above — this is the same modal already in scope for the weekly/one-time/
  time-off mode split; the "show current schedule while editing" ask is additive to that work,
  not a separate modal).

### Direction to explore for the preview

- Toggle: a clearly-segmented control (not two plain tab labels) — e.g. a pill/segmented switch
  with a visible active-state fill, similar to how Monday.com / Asana switch between
  Calendar/Timeline/Board views.
- Grid: brand-colored (gold/black/white) shift blocks instead of purple; each member gets a
  consistent, distinguishable identity (initial-avatar + a fixed accent color per person, not a
  shared purple/grey treatment) so "who is what" reads without needing to hover.
- Hour accuracy: confirm whether grid cells are computed from real `starts_at`/`ends_at` per
  member (likely yes, via `useTeamSchedule`/`expandSchedule`) or whether there's a rendering
  rounding/snapping bug making blocks look offset from the actual scheduled hours — needs a code
  read, not just a visual restyle, before mocking pixel-perfect alignment.
- Schedule-edit modal: add a "your current schedule" visual summary (e.g. a compact 7-day strip
  showing today's saved hours per day, or "No schedule set yet") rendered above/beside the edit
  form, so the member can see what they're about to change instead of an unlabeled blank form.

### Locked decisions (director-approved, 2026-07-28)

Two mockup rounds shown in-chat (`calendar_page_revamp_preview`, then
`team_schedule_toggle_active_preview` rendered against the real 6-person team — Bridget,
Checkmark, Christian, Matthan, Richard, Tony). Director signed off on the direction:

- **Bookings tab keeps its Google Calendar-style day/time grid layout.** This redesign is
  scoped to the Team Schedule tab only — do not touch Bookings' layout as part of this work.
- **Team Schedule tab** moves to a member-rows-down-the-side layout (avatar + name per row,
  one column per day), gold-filled segmented toggle replacing the two plain tab labels, and
  one fixed accent color per member (avatar + their hour-blocks everywhere) instead of the
  purple wash + greyscale-until-hover treatment. Block position/width within a day cell should
  reflect that member's real start/end time, not a fixed full-day fill.
- **Schedule-edit modal** gets the "current schedule" 7-day pill strip shown above the edit
  form (gold-tinted pill = a scheduled day with its hours, muted "Off" pill = no shift that
  day) — confirmed as the right direction.
- Per-member color palette used in the mockups (gold/teal/rose/amber/blue/neutral-gray) was a
  placeholder, not yet locked — fine to reuse or restyle at implementation time.
- Still open: whether the hover-highlight interaction from the 2026-05-27 decision (dim
  everyone, light up on hover) survives alongside always-visible per-member color, or is
  dropped entirely now that color alone carries identity. Ask before implementing.

### Non-goals (carried over from the section above)

Same as the existing Non-Goals list — no payroll/PTO accounting, no Accountant concepts, no
Google Calendar sync changes here. Bookings' calendar-grid layout is explicitly out of scope
for this redesign (see Locked decisions above).

