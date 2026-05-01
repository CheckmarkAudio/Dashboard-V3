# Interaction Blueprint Backlog

Date: 2026-05-01
Purpose: stabilize modal/widget/button placement across the app using
wireframe-first blueprints before visual polish or code rewrites.

## Method

For each surface:

1. identify the canonical owner page
2. identify the actual backend capabilities already wired
3. identify hidden vs missing actions
4. create a low-fidelity blueprint
5. approve button placement
6. implement only after the blueprint is accepted

## Priority Order

### Tier 1 — operator confidence

These directly affect day-to-day admin usability and should be blueprinted first.

1. `/sessions` booking board
   - owner page: `/sessions`
   - current blueprint: [docs/mockups/booking-admin-blueprint.html](/Users/bridges/GITHUB/Dashboard-V3/docs/mockups/booking-admin-blueprint.html)
   - actions to stabilize:
     - `Book Session`
     - `Manage Bookings`
     - row `View`
     - row `Edit`
     - row `Assign`
     - row `Cancel`
     - `Manage Clients`

2. `ClientsPanel`
   - owner page: `/sessions#clients`
   - blueprint: [docs/mockups/clients-panel-blueprint.html](/Users/bridges/GITHUB/Dashboard-V3/docs/mockups/clients-panel-blueprint.html)
   - current state:
     - add is visible
     - edit is hidden in 3-dot menu
     - archive/restore is hidden in 3-dot menu
   - blueprint goal:
     - confirm whether `Edit client` becomes a direct row action
     - keep `Archive` secondary unless needed more often

3. `AdminEditSessionsModal`
   - current owner path: `/sessions` via `Manage Bookings`
   - blueprint goal:
     - internal button placement
     - confirm delete/cancel hierarchy
     - confirm filter row layout

4. `AdminEditTasksModal`
   - current owner path: legacy-ish admin edit workflows
   - blueprint goal:
     - decide how task editing should surface from canonical Assign
     - confirm row expand/edit/save/cancel layout

### Tier 2 — canonical page cleanup

5. `/admin/templates` canonical Assign page
   - blueprint goal:
     - where task editing belongs
     - where assign, save-template, preview-template belong
     - whether legacy edit widgets can be retired

6. `TemplateAssignFlowModal`
   - blueprint goal:
     - 3-step flow clarity
     - next/back/assign button placement

7. `TemplateEditorModal`
   - blueprint goal:
     - create vs edit actions
     - item add/remove/save placement

8. `SessionAssignModal`
   - blueprint goal:
     - better assignment path from booking context
     - engineer selection / conflict warning / confirm button placement

### Tier 3 — admin management polish

9. `/admin/my-team` roster row actions
   - blueprint goal:
     - determine what remains in the 3-dot menu
     - determine whether any action deserves direct row visibility

10. `ConfirmModal`
    - blueprint goal:
      - standardize dangerous action confirm hierarchy sitewide

11. `PublishChecklistModal`
12. `AdminTaskCreateModal`
13. `MultiTaskCreateModal`
14. `TaskRequestModal`
15. `TaskReassignRequestModal`
16. `TaskDetailModal`

### Tier 4 — secondary widget clarity

17. `AdminQuickAssignWidget`
18. `PendingTaskRequestsWidget`
19. `AdminApprovalLogWidget`
20. `AdminAssignLogWidget`
21. `AdminTemplatesWidget`
22. `AdminClockInWidget`
23. `AdminNotificationsWidget`
24. `AdminTeamWidget`
25. `AdminApprovalsWidget`

These matter, but they should come after the page-level flows and the high-use modals.

## Existing Inventory

### Modal files

- `CreateBookingModal`
- `SessionFormModal`
- `AdminEditSessionsModal`
- `AdminEditTasksModal`
- `AdminTaskCreateModal`
- `MultiTaskCreateModal`
- `TaskRequestModal`
- `TaskReassignRequestModal`
- `TaskDetailModal`
- `AddFromTemplateModal`
- `TemplateEditorModal`
- `TemplateDuplicateModal`
- `TemplatePreviewModal`
- `TemplateAssignFlowModal`
- `PublishChecklistModal`
- `ConfirmModal`
- `SubmissionModal`
- `SelfReportModal`
- `ForcePasswordChangeModal`
- `PipelineEntryModal`

### Widget files

- `AdminClockInWidget`
- `AdminEditTasksWidget`
- `AdminQuickAssignWidget`
- `PendingTaskRequestsWidget`
- `AdminApprovalLogWidget`
- `AdminAssignLogWidget`
- `AdminTemplatesWidget`
- admin/member overview widgets

## Output Standard

Each blueprint should answer:

- what page owns this interaction
- what primary action is most important
- what secondary actions stay visible
- what dangerous actions stay tucked behind confirmation
- what action remains menu-only
- what route/RPC this surface depends on

## Recommended Working Rhythm

1. blueprint 1 surface
2. approve button placement
3. implement that one surface
4. test it
5. move to the next

This should keep the app stable while steadily making it more satisfying to use.
