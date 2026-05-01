# Admin Workflow Stability Plan

Date: 2026-05-01
Owner context: post-security stabilization follow-up

## Purpose

This plan is for cleaning up the app surfaces that feel unstable without
accidentally undoing the security hardening work completed on 2026-05-01.

The target problem set:

- stale frontend routes/components
- overlapping PRs and partial merges
- hidden or incomplete admin actions in the UI
- production schema drift only where a page depends on a changed RPC/table/view

## Executive Read

The route layer is not the main source of chaos right now.

What looks unstable is the admin action layer:

- some routes are intentionally aliased or preserved for backwards compatibility
- some admin actions still live on the legacy widget-grid page
- the newer canonical pages do not yet expose every action clearly

This means the current problem is less "mystery broken router" and more
"split admin surface + preserved legacy paths + discoverability drift."

## Verified Findings From Code

### 1) Canonical route layer is relatively small and understandable

Primary app routes are defined in:

- [/Users/bridges/GITHUB/Dashboard-V3/src/app/routes.ts](/Users/bridges/GITHUB/Dashboard-V3/src/app/routes.ts:1)
- [/Users/bridges/GITHUB/Dashboard-V3/src/App.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/App.tsx:1)
- [/Users/bridges/GITHUB/Dashboard-V3/src/features/member/routes.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/features/member/routes.tsx:1)
- [/Users/bridges/GITHUB/Dashboard-V3/src/features/admin/routes.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/features/admin/routes.tsx:1)

Current main member routes:

- `/`
- `/profile/:memberId`
- `/daily`
- `/sessions`
- `/calendar`
- `/content`

Current main admin routes:

- `/admin`
- `/admin/team`
- `/admin/my-team`
- `/admin/templates`
- `/admin/assign-classic`
- `/admin/assign-mockup`
- `/admin/template-library`
- `/admin/health`
- `/admin/settings`

### 2) Some "stale-looking" routes are intentionally preserved

These are not necessarily bugs:

- `/admin/team` and `/admin/my-team` both resolve to `TeamManager`
- `/admin/assign-mockup` and `/admin/templates` both resolve to `AssignAdmin`
- deprecated member routes redirect to `/`
- `/content` is still the route even though the UI label says `Forum`

This is compatibility behavior, not automatically drift.

### 3) The biggest workflow split is Assign

The most important admin split is:

- canonical/new Assign page: `/admin/templates`
- legacy/preserved Assign page: `/admin/assign-classic`

Relevant files:

- [/Users/bridges/GITHUB/Dashboard-V3/src/pages/admin/AssignAdmin.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/pages/admin/AssignAdmin.tsx:1)
- [/Users/bridges/GITHUB/Dashboard-V3/src/pages/admin/Templates.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/pages/admin/Templates.tsx:1)

The code comments explicitly say the legacy page still contains historical
widget-grid actions while the new page is the canonical route.

That creates a predictable source of admin confusion:

- the route looks current
- the action may still only be reachable in the legacy surface

### 4) Session delete exists, but is hidden in a non-obvious place

The backend session delete RPC is wired and real:

- [/Users/bridges/GITHUB/Dashboard-V3/src/lib/queries/adminSessions.ts](/Users/bridges/GITHUB/Dashboard-V3/src/lib/queries/adminSessions.ts:1)

The UI path to it is:

- `AdminEditTasksWidget` -> `Edit Booking` button
- `AdminEditSessionsModal`
- row expansion
- delete/confirm button inside the row editor

Relevant files:

- [/Users/bridges/GITHUB/Dashboard-V3/src/components/admin/tasks/AdminEditTasksWidget.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/components/admin/tasks/AdminEditTasksWidget.tsx:1)
- [/Users/bridges/GITHUB/Dashboard-V3/src/components/admin/sessions/AdminEditSessionsModal.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/components/admin/sessions/AdminEditSessionsModal.tsx:1)

Delete button lives here:

- [/Users/bridges/GITHUB/Dashboard-V3/src/components/admin/sessions/AdminEditSessionsModal.tsx](/Users/bridges/GITHUB/Dashboard-V3/src/components/admin/sessions/AdminEditSessionsModal.tsx:435)

This is a prime example of "implemented but not discoverable."

### 5) Hidden admin actions are currently a bigger problem than missing RPCs

Confirmed existing sensitive/admin actions:

- session edit
- session delete
- task edit
- client create/update/archive

Confirmed likely issue:

- the UI information architecture does not make these actions obvious from the
  pages where an admin naturally expects them

## Working Diagnosis

The most likely sources of present-day instability are:

### A. Hidden admin actions

The action exists, but is buried in:

- a widget
- a modal inside a widget
- a legacy page
- a compatibility route not exposed clearly in the current nav

### B. Split canonical vs legacy surfaces

The new canonical admin page and the preserved legacy page both exist, but
responsibility is not fully consolidated.

### C. Partial merge / preserved-route confusion

The route system contains deliberate aliases and bookmarks-preserving fallbacks.
This is helpful for continuity but makes it harder to tell whether a route is:

- canonical
- compatibility-only
- legacy but still active
- effectively retired

### D. Page-specific schema drift

This matters only where a page depends on:

- a changed RPC
- a changed table/view
- a changed field shape

This should be investigated page-by-page, not as a broad fear.

## Recommended Execution Order

### Phase 1: Canonical route and admin-action inventory

Create a single source of truth for:

- route
- page/component
- visible nav entry
- canonical vs compatibility vs legacy
- key admin actions available on the page
- backend dependency

Deliverable:

- `route-admin-action-map.md`

### Phase 2: Session workflow cleanup first

Because session delete is already a known discoverability issue, start here.

Answer for sessions:

- where admins expect to manage bookings
- where edit currently lives
- where delete currently lives
- whether delete should stay modal-only or be surfaced directly on `/sessions`

Target result:

- one obvious booking-management surface
- no hidden-only critical action

### Phase 3: Assign/admin split cleanup

Review what actions still live only in `/admin/assign-classic` and decide one of:

- move into `/admin/templates`
- link explicitly from `/admin/templates`
- retire completely

Priority actions to map:

- edit booking
- edit task
- task request approval
- assign log
- approval log
- template management

### Phase 4: Merge/drift cleanup only where user-facing

Do not broadly hunt all schema drift.

Only inspect backend alignment where a specific page is unstable:

- sessions
- clients
- tasks
- notifications
- bookings

### Phase 5: Retire or relabel compatibility paths

After workflows are stable, reduce confusion by:

- documenting which routes are canonical
- visually labeling legacy paths where they still exist
- eventually deleting dead compatibility routes once bookmarks are no longer needed

## Immediate Next Task

The best next implementation task is:

### Make session admin controls discoverable

At minimum:

- expose a clearer path from the booking/session surface to edit/delete flows
- remove the need for an admin to know that "Edit Booking" is buried in the
  Assign-side `Edit` widget

This is the highest-value workflow stabilization task because:

- the backend is already secure and wired
- the action matters operationally
- the issue is already reproducible
- it will build confidence quickly

## Guardrails

- Do not re-run stitched dashboard SQL as a source of truth
- Do not do broad Supabase warning cleanup while workflow cleanup is underway
- Keep changes narrow and page-specific
- Prefer making actions discoverable before rewriting their backend
- Treat `/admin/templates` as canonical unless explicitly superseded

## Recommended Tool Ownership

Best use of tools/agents for this work:

- Codex: strongest for route/audit mapping, cross-file drift detection, and
  surgical repo changes that need careful reasoning
- Claude: strong follow-up implementer once the exact surface and constraints
  are written down clearly
- Cursor: useful as the editor shell, but should not be the source of truth for
  architectural decisions in this cleanup

Practical recommendation:

- use Codex first to map and define each cleanup task
- use Claude second for larger implementation batches once the target is crisp
