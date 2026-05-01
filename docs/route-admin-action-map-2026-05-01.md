# Route + Admin Action Map

Date: 2026-05-01
Purpose: define the canonical app surfaces, identify buried admin actions, and
decide which actions should be brought forward onto the primary pages.

## Canonical Route Map

| Route | Page / component | Linked from | Expected role | Primary backend dependency | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | `Dashboard` | Top nav `Overview` | signed-in member/admin | overview widgets, tasks, notifications | canonical member landing page |
| `/daily` | `DailyChecklist` | Top nav `Tasks` | signed-in member/admin | assigned task queries, task requests | member task surface |
| `/sessions` | `Sessions` | Top nav `Booking` | signed-in member/admin | `loadSessionsWindow`, `ClientsPanel`, booking modal | canonical booking surface |
| `/calendar` | `Calendar` | Top nav `Calendar` | signed-in member/admin | booking/session calendar queries | canonical calendar surface |
| `/content` | `Content` | Top nav label `Forum` | signed-in member/admin | forum / notifications | route is legacy name, label is current |
| `/profile/:memberId` | `Profile` | profile avatar, member links | signed-in member/admin | team member profile data | canonical profile page |
| `/admin` | `AdminHub` | Top nav `Dashboard` | admin/owner | workspace panel + admin widgets | canonical admin dashboard |
| `/admin/templates` | `AssignAdmin` | Top nav `Assign` | admin/owner | member task queries, template RPCs | canonical assign page |
| `/admin/assign-classic` | `Templates` | linked from new Assign page | admin/owner | legacy widget grid | preserved legacy surface, not canonical |
| `/admin/assign-mockup` | `AssignAdmin` | bookmark compatibility | admin/owner | same as `/admin/templates` | compatibility alias |
| `/admin/template-library` | `TemplateLibrary` | Assign page sidebar | admin/owner | template library RPCs | canonical template management |
| `/admin/my-team` | `TeamManager` | Top nav `Members` | admin/owner | `team_members`, template assignment, checklist generation | canonical members page |
| `/admin/team` | `TeamManager` | bookmark compatibility | admin/owner | same as `/admin/my-team` | compatibility alias |
| `/admin/health` | `BusinessHealth` | Top nav `Analytics` | admin/owner | analytics data + some legacy stats | canonical analytics surface |
| `/admin/settings` | `AdminSettings` | Top nav `Settings` | admin/owner | mostly local/UI settings now | canonical settings page |

## Known Compatibility / Legacy Routes

These routes look stale but are currently intentional:

- `/content` remains the route while the visible label says `Forum`
- `/admin/team` and `/admin/my-team` both render `TeamManager`
- `/admin/assign-mockup` and `/admin/templates` both render `AssignAdmin`
- `/admin/assign-classic` is a deliberate preserved legacy page
- deprecated member routes redirect to `/`

These should be documented and eventually retired carefully, not treated as random breakage.

## Admin Action Inventory

### Sessions / bookings

Canonical owner surface:

- `/sessions`

Back-end capability:

- `loadSessionsWindow`
- `admin_list_all_sessions`
- `admin_update_session`
- `admin_delete_session`
- `assign_session`

Current UI status:

- create booking: front-and-center on `/sessions`
- view bookings: front-and-center on `/sessions`
- edit booking: existed only in `AdminEditSessionsModal`
- delete/cancel booking: existed only in `AdminEditSessionsModal`
- assign/reassign engineer: exists in `SessionAssignModal`
- notification side effects: yes (`session_reassigned`, cancellation notification path)

Buried implementation found:

- `AdminEditSessionsModal` is reachable via `AdminEditTasksWidget`
- `AdminEditTasksWidget` historically lived in the Assign-side widget surface

Bring-to-front decision:

- `Manage Bookings` belongs on `/sessions`
- edit and cancel should be discoverable from the canonical booking page
- assigning/reassigning should also ultimately be reachable from `/sessions`, not only from admin assign flows

Current status after Codex change:

- `/sessions` now exposes `Manage Bookings` for admins and opens the existing `AdminEditSessionsModal`

### Clients

Canonical owner surface:

- `/sessions` -> `ClientsPanel`

Back-end capability:

- `create_client`
- `update_client`
- `archive_client`
- `get_clients`
- `search_clients`

Current UI status:

- add client: front-and-center on `/sessions#clients`
- search clients: visible
- edit client: hidden behind row 3-dot menu
- archive/restore client: hidden behind row 3-dot menu
- notification side effect: none obvious

Bring-to-front decision:

- add stays prominent
- edit should likely become a visible row action, not only a 3-dot action
- archive can remain a secondary action if the menu remains easy to find

### Tasks

Canonical owner surface:

- `/admin/templates` for assignment workflow

Back-end capability:

- `admin_list_all_assigned_tasks`
- `admin_update_assigned_task`
- template assignment RPCs
- task request RPCs

Current UI status:

- create/assign task: visible in assign flows
- edit task: buried in `AdminEditTasksModal`
- task request approval: legacy/admin widgets and assign-related surfaces
- notification side effect: yes (`task_edited`)

Buried implementation found:

- `AdminEditTasksModal` opens from `AdminEditTasksWidget`
- `AdminEditTasksWidget` is associated with the older widget-grid mental model

Bring-to-front decision:

- task editing should migrate onto the canonical Assign page itself, not depend on a separate edit widget mental model

### Members

Canonical owner surface:

- `/admin/my-team`

Back-end capability:

- add member via edge function
- edit member
- toggle role
- toggle active/inactive
- send setup email
- delete member
- assign templates to member
- generate checklist for member

Current UI status:

- add member: visible
- edit member: hidden in row 3-dot menu
- role/status changes: hidden in row 3-dot menu
- delete member: hidden in row 3-dot menu
- setup email resend: hidden in row 3-dot menu

Bring-to-front decision:

- the 3-dot menu is acceptable for dangerous member-management actions
- this page is already the canonical owner surface
- priority here is clarity, not relocation

### Notifications

Canonical owner surface:

- top-right bell / notifications panel

Current UI status:

- read notifications: visible
- open linked destination: visible
- mark read/all read: visible

Bring-to-front decision:

- no relocation needed right now
- main dependency is route accuracy and page highlight behavior

## Current Hidden-vs-Missing Assessment

### Hidden, not missing

- booking edit
- booking cancel/delete
- booking reassignment flow
- client edit
- client archive/restore
- task edit
- member role/status/delete/setup actions

### Likely missing or not surfaced enough

- direct booking row actions on `/sessions`
- direct session reassignment from `/sessions`
- stronger task-edit entry point on canonical Assign page

## Bring-To-Front Priorities

### Priority 1

Sessions:

- keep `/sessions` as the true booking control center
- surface edit/cancel directly there
- eventually surface assign/reassign there too

### Priority 2

Clients:

- make edit more visible in the client table
- keep archive as a secondary action

### Priority 3

Tasks:

- expose edit controls in the canonical Assign experience rather than relying on legacy widget vocabulary

### Priority 4

Members:

- keep the current page as the owner surface
- consider whether one or two common actions deserve row-level buttons later

## Practical Next Work Sequence

1. Session workflow audit
   - decide exact row/button placement on `/sessions`
   - make assign/reassign discoverable there

2. Client workflow audit
   - decide whether `Edit client` should become a direct row action

3. Task workflow audit
   - map what task-edit actions still depend on widget-grid legacy thinking

4. Route / PR cleanup
   - only after the canonical surfaces feel complete

## Guiding Rule

If an admin naturally expects to manage something from a page, the core action should
be visible on that page. Legacy widgets and 3-dot menus can hold secondary actions,
but not the only path to a critical workflow.
