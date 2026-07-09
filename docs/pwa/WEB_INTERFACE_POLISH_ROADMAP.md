# Web Interface Polish Roadmap

Purpose: make the current website so obvious and calm that workers actually use it without training or hunting.

This is a child roadmap of `APP_BUILD_ROADMAP.md`. The master phase order stays in `APP_BUILD_ROADMAP.md`; this file details the website clarity work inside the daily workflow phases.

For the broader mission, role lanes, accountability, history protocol, and design memory, read `docs/00_PROJECT_OS/README.md`.

## North Star

Checkmark already has strong capabilities. The web interface must now make those capabilities obvious.

This roadmap is a tactical expression of the larger Project OS vision: a beautiful, refined, easy, stable, attractive, worker-magnetic Checkmark operating system. Do not reduce the whole project vision to one page or one widget.

The standard:

- a worker can find their own tasks first
- a worker can find DMs without knowing there is a hidden top-right icon
- a worker can request schedule changes without decoding "single block" vs "recurring weekly"
- an admin can set schedules and vacation markers without spreadsheet energy
- a daily workflow page does not show three equally loud columns by default

## Master Roadmap Relationship

`APP_BUILD_ROADMAP.md` controls order.

This roadmap currently attaches to:

- Phase 2: Role-Based Home
- Phase 3: Daily Workflows
- Phase 4: Admin Operations, only where schedule/member admin polish is required

This roadmap explicitly does not start Phase 5 Accountant.

## Research Intake

`docs/ux/CHATGPT_TASK_FIRST_NAV_RESEARCH_PROPOSAL.md` is a sanitized ChatGPT research intake file. It is useful context, not a source-of-truth roadmap.

Durable ideas accepted from that research:

- worker-critical routes should be visible without hunting
- the top bar should behave more like a utility zone than an overloaded page list
- a later global shell pass should consider desktop sidebar navigation and mobile bottom tabs
- nav badges should mean action needed, not decorative activity
- Messages and Forum need a clearer mental split
- task pages should avoid visible category sprawl and keep detailed metadata out of default cards

Deferred from that research:

- full app-shell/nav redesign
- default landing-page change from Overview to Tasks
- task status/data-model changes
- booking-generated task bundles
- calendar/task/schema integration
- proof-required task submission flows

Those deferred items need Codex architecture/data review and director approval before implementation.

## Current Focus

Website daily workflow clarity comes before Accountant.

Tasks is first because it is the clearest daily worker proof point, not because it is the only core goal.

Priority order:

1. Tasks page starts on My Tasks.
2. Messages and DMs become obvious from header and Forum.
3. Schedule flow splits weekly schedule, one-time change, and vacation/time off.
4. Dashboard keeps widgets but reduces first-screen overload.
5. Admin/member surfaces reuse the same sidebar grammar where it makes work clearer.

Later shell note:

- A global sidebar/bottom-tab nav reform is plausible, but it should happen as a dedicated app-shell pass after route-level worker-obviousness work has clarified Tasks, Messages, and Schedule.

## Inspected Code Map

Known current surfaces:

| Product Area | Route / Files | Current Shape | Initial Risk |
|---|---|---|---|
| App shell and top-right controls | `src/components/Layout.tsx`, `MessagesBell.tsx`, `DmDock.tsx` | DM exists as icon-only bell plus floating dock | UI discoverability risk |
| Tasks | `src/pages/DailyChecklist.tsx`, `WorkspacePanel.tsx`, `widgetRegistry.tsx`, `MyTasksCard.tsx`, `AssignedTaskBoards.tsx` | `/daily` renders a widget panel with multiple equal-weight widgets | Information overload risk |
| Schedule requests | `ScheduleRequestModal.tsx`, `WorkScheduler.tsx`, `MyScheduleWidget.tsx`, `useTeamSchedule.ts`, `mutations.ts` | Supports one-off blocks and recurring weekly requests | Copy/mental-model risk |
| Forum / DMs | `src/pages/Content.tsx`, `NewMessageDialog.tsx`, `useDmThreads.ts`, `dms.ts` | DMs can deep-link with `?dm=` and live in Forum plus header | Entry-point discoverability risk |
| Dashboard | `Dashboard.tsx`, `MemberHighlights.tsx`, `WorkspacePanel.tsx`, member widgets | Widget view is useful but can compete with daily actions | Hierarchy risk |
| Admin scheduler | `TeamManager.tsx`, `WorkScheduler.tsx` | Rich scheduler exists in Members admin | Admin complexity risk |

## Phase W0: Operating Foundation

Goal:

- make the roadmap, docs, AI roles, and uncertainty labels easy to find.

Deliverables:

- `docs/AI_CODERS_READ_THIS_FIRST.md`
- this roadmap
- `docs/ux/WORKER_OBVIOUSNESS_AUDIT.md`
- focused UX plans for Tasks, Schedule, and Messages
- Claude startup/skill wiring

Exit criteria:

- new sessions know where to start
- `APP_BUILD_ROADMAP.md` names this roadmap as a child plan
- uncertainty labels are standardized

## Phase W1: Worker-Obviousness Audit

Goal:

- turn real worker confusion into a build queue.

Minimum tests:

- Find your DMs.
- Start a new DM.
- Find your tasks.
- Complete one task.
- Request one vacation day.
- Change only next Thursday.
- Set the same weekly schedule.

Exit criteria:

- each tested page has a one-sentence job
- primary actions are visible
- confusion points become tickets or docs

## Phase W2: Tasks Page Rescue

Goal:

- make `/daily` start with My Tasks and move secondary task contexts behind a simple sidebar.

Design direction:

- left rail or tab rail: My Tasks, Studio Tasks, Team Tasks, Checklist, Requests/Completed as applicable
- main pane defaults to My Tasks
- widget view can remain available as a dashboard-style secondary mode if useful

Source doc:

- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md`

Exit criteria:

- employee sees personal work first
- no three-column wall as the default task page
- desktop remains professional
- mobile has one clear main action path

## Phase W3: Messages / DM Discovery

Goal:

- make DMs impossible to miss.

Design direction:

- header entry should say "Messages" where space allows, not only an icon
- unread count remains visible
- Forum should expose Direct Messages as a clear sidebar section
- empty states should offer "Start a message"

Source doc:

- `docs/ux/MESSAGES_DISCOVERY_PLAN.md`

Exit criteria:

- a worker can find DMs within 5 seconds
- top-right entry is labeled or otherwise obvious
- Forum and header lead to the same DM mental model

## Phase W4: Schedule Simplicity And Vacation

Goal:

- separate weekly schedules, one-time changes, and vacation/time off into obvious flows.

Design direction:

- "Set weekly schedule"
- "Request one-time change"
- "Request vacation/time off"
- vacation gets distinct labels, color, state, and admin review path

Source doc:

- `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`

Exit criteria:

- vacation is first-class, not a disguised schedule block
- users do not need to understand database concepts
- admins can review schedule requests without ambiguity

## Phase W5: Dashboard Hierarchy

Goal:

- keep dashboard widgets while reducing cognitive load.

Design direction:

- dashboard stays an overview
- daily work gets direct links to the clearer dedicated pages
- widget density should not hide the next best action

Exit criteria:

- Overview helps users decide where to go
- daily work pages do the heavy interaction work

## Phase W6: Verification And Handoff

Every scoped UI PR must verify:

- desktop route
- phone-width route
- light and dark mode if styles changed
- keyboard focus on new controls
- loading, empty, and error states when touched
- no horizontal overflow
- no hidden primary action

## Do Not Do Yet

- Do not start Accountant UI implementation.
- Do not convert every page at once.
- Do not redesign auth, Supabase, or service-worker behavior as part of a visual slice.
- Do not collapse old docs without a dedicated reference audit.

## Open Director Decisions

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Should vacation/time off be employee-requested only, admin-created only, or both?

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Should the worker-facing term be "Vacation", "Time off", "Away", or "Unavailable"?

<span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Test whether employees understand "Messages" as DMs, or whether "Direct Messages" needs to appear in the UI.
