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

## Open Decisions

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Choose the UI term: "Vacation", "Time off", "Away", or "Unavailable."

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Should employees request time off, admins create it, or both?

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Should time off need approval every time, or can admins enter approved time off directly?

<span style="color:#7c3aed">ASSUMPTION</span>: Time off affects employee availability but does not yet need payroll/accounting behavior.

