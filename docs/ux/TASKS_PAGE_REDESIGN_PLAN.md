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

Main-view sidebar:

- My Tasks
- Team Tasks
- Studio Tasks

Page-level toggle:

- Widget View returns to the full-width legacy task-widget layout.
- Main View returns to the focused sidebar/pane layout.

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
- The sidebar uses plain task-group labels, not widget jargon.
- The active pane has one primary action.
- Secondary counts can appear as small badges.
- Drag/reorder behavior inside My Tasks should remain intact.
- Do not break `MyTasksCard` behavior just to change the page shell.
- Widget View should be a page-level mode, not a nested sidebar section.

## Likely Implementation Path

1. Create a Tasks page shell with a left rail and active pane state. Done in first slice.
2. Render `MyTasksCard` directly as the default pane. Done in first slice.
3. Render existing secondary task widgets as panes instead of simultaneous columns. Done for Team Tasks and Studio Tasks.
4. Preserve `WorkspacePanel` as an optional "Widget View" for the full task-widget layout. Done as a page-header toggle in the correction slice.
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

### 2026-07-09 - Priority fix slice

User direction:

- keep task groups on one page each
- primary sidebar choices should be My Tasks, Team Tasks, Studio Tasks, and Widget View
- reduce busy task contexts before moving deeper into Messages reform

Codex follow-up:

- changed the `/daily` sidebar to My Tasks, Team Tasks, Studio Tasks, and Widget View
- restored the old `WorkspacePanel` task grid behind Widget View only
- kept task data, task completion, task queries, and Supabase behavior unchanged

Superseded by correction below:

- Widget View moved out of the sidebar and became a page-header toggle back to the full-width widget layout.

Verification:

- `npm run build` passed

### 2026-07-09 - Admin-sidebar formula alignment

User direction:

- make the `/daily` task selector a left sidebar like Settings and Members
- follow the existing sidebar formula instead of inventing a separate task-only rail

Codex follow-up:

- reused `AdminSectionNavItem` for My Tasks, Team Tasks, Studio Tasks, and Widget View
- aligned `/daily` to the Settings/Members two-pane grid and sidebar classes
- removed the temporary mobile horizontal task strip behavior from this page

Correction:

- Widget View was later moved out of the sidebar and into a page-level toggle.

Verification:

- `npm run build` passed

### 2026-07-09 - Main view vs widget view correction

User direction:

- the task sidebar should stretch down to match the right content panel
- Widget View should not be nested in the sidebar
- workers should be able to toggle between the focused main view and the previous full-page widget formatting

Codex follow-up:

- removed Widget View from the task sidebar
- added a page-header toggle between Main View and Widget View
- kept My Tasks, Team Tasks, and Studio Tasks as the focused main-view sidebar choices
- restored Widget View as the full-width `WorkspacePanel` layout instead of a nested right-pane option
- changed the main task grid to `items-stretch` and made the sidebar `h-full` so it matches the content panel height

Verification:

- `npm run build` passed

## Open Decisions

<span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Confirm whether employees understand "Studio Tasks" vs "Team Tasks" and whether the Main View / Widget View toggle feels obvious.
