# Tasks Page Redesign Plan

Purpose: make `/daily` start with the worker's own tasks, then offer other task contexts through a clear sidebar instead of a three-column widget wall.

Status: first implementation slice started in `src/pages/DailyChecklist.tsx`.

Framing: Tasks is the first tactical proof point for the broader Project OS website reform, not the whole core vision.

## Problem

The current Tasks page is powerful but too dense for daily worker use.

Known current implementation:

- route: `/daily`
- page: `src/pages/DailyChecklist.tsx`
- layout: `WorkspacePanel`
- definitions: `TASKS_WIDGET_DEFINITIONS`
- personal task core: `src/components/tasks/MyTasksCard.tsx`
- secondary boards: `src/components/tasks/AssignedTaskBoards.tsx`

The current default gives multiple widgets equal weight. That is useful for dashboards, but the worker-facing Tasks page should start with "My Tasks."

## Target Job

"Show me what I personally need to do now, and let me complete it."

## Proposed Information Architecture

Default pane:

- My Tasks

Sidebar / tabs:

- My Tasks
- Team Tasks
- Checklist
- Studio Tasks

Admin-only additions, if needed:

- Assign
- Templates
- Edit Tasks

Do not show every pane at once.

## Research Intake Influence

`docs/ux/CHATGPT_TASK_FIRST_NAV_RESEARCH_PROPOSAL.md` supports the current `/daily` direction: personal work first, secondary contexts behind a clear pane system, and no category sprawl.

Accepted near-term ideas:

- My Tasks stays the default.
- Secondary task contexts should not visually compete with personal work.
- Task cards should stay compact and action-focused.
- Detailed metadata belongs in the existing detail modal or a future detail panel, not on every row.
- Plain labels matter more than widget jargon.

Candidate future vocabulary:

- Today
- Mine
- Team
- Checklist
- Submitted
- Done

Those smart views are not yet approved as a data model or UI requirement. They are future vocabulary to test after the current My Tasks pane is worker-tested.

Deferred ideas:

- changing task statuses
- adding backend tags
- adding booking-generated task templates
- making tasks appear on the calendar
- requiring proof/media before task submission
- making `/daily` the default logged-in landing page

Those need Codex data/security review and director approval before implementation.

## Design Rules

- My Tasks is the first load.
- The sidebar uses plain labels, not widget jargon.
- The active pane has one primary action.
- Secondary counts can appear as small badges.
- Drag/reorder behavior inside My Tasks should remain intact.
- Do not break `MyTasksCard` behavior just to change the page shell.

## Likely Implementation Path

1. Create a Tasks page shell with a left rail and active pane state. Done in first slice.
2. Render `MyTasksCard` directly as the default pane. Done in first slice.
3. Render existing secondary task widgets as panes instead of simultaneous columns. Done for Checklist, Team Tasks, and Studio Tasks.
4. Preserve `WorkspacePanel` as an optional "Widget View" only if it remains useful. Deferred; do not add until user requests it.
5. Verify existing task query keys and realtime invalidation still work.

## Likely Files

- `src/pages/DailyChecklist.tsx`
- `src/components/tasks/MyTasksCard.tsx`
- `src/components/tasks/AssignedTaskBoards.tsx`
- `src/components/checklist/TeamChecklistWidget.tsx`
- `src/components/dashboard/widgetRegistry.tsx`
- `src/components/dashboard/WorkspacePanel.tsx`, only if retaining a widget view
- `src/hooks/useWorkspaceLayout.ts`, only if widget layout behavior changes

## Non-Goals

- Do not redesign task data models.
- Do not rewrite `MyTasksCard`.
- Do not change task completion semantics.
- Do not alter Supabase RPCs unless a real bug is found.
- Do not combine this with schedule or message changes.

## Data And Security Risk

Expected risk: low if UI-only.

Escalates to medium/high if:

- task completion writes change
- admin task deletion/editing changes
- query scopes change
- role-specific panes are introduced

Codex should review any data or permission change before Claude/Fable implements.

## Acceptance Criteria

- `/daily` opens on My Tasks.
- Workers can complete a task without switching panes.
- Secondary task contexts are available but not visually competing.
- Mobile shows one clear active pane.
- Desktop keeps a professional admin-capable layout.
- Existing My Tasks completion, reorder, pending, filter, and detail-modal behavior still works.

## Validation Notes

### 2026-07-09 - Claude clean-session audit

Result:

- static code audit confirmed `/daily` opens on My Tasks
- My Tasks completion, reorder, filters, and detail modal remain inside `MyTasksCard`
- Checklist, Team Tasks, and Studio Tasks render as separate panes
- no Supabase/data behavior changes were involved

Mobile findings:

- redundant mobile "Tasks" sidebar label added vertical noise
- desktop min-heights pushed the task content too far below the fold on small phones

Codex follow-up:

- hid the sidebar label on mobile
- made the tall pane/content min-heights desktop-only

## Open Decisions

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Should the secondary view be called "Widget View", "Boards", or something else?

<span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Confirm whether employees understand "Studio Tasks" vs "Team Tasks."
