import type {
  AdminWidgetRegistration,
  MemberScope,
  MemberWidgetRegistration,
  WidgetPlacement,
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetRegistration,
  WorkspaceWidgetState,
} from './types'

// ═════════════════════════════════════════════════════════════════════
// MEMBER — widgets available to members.
//
// A member widget can appear on one or more MEMBER pages via its
// `defaultPlacements` array. Each placement specifies which page and
// how big (span × rowSpan). Crossing into an admin scope is a compile
// error — `MemberWidgetRegistration` narrows the placement Scope to
// `MemberScope` only.
// ═════════════════════════════════════════════════════════════════════
// PR #32 — column-snap model. Each placement declares a column
// (`col`); the grid renders 3 independent vertical stacks. Widgets
// auto-arrange inside their column, but dropping a widget into col 3
// keeps it in col 3 even if col 1 is empty. `rowSpan` governs widget
// HEIGHT within its column (rs=2 renders 2× tall). Within-column order
// falls out of registration order here; users reorder via drag.
//
// Overview stacks:
//   col 1: team_tasks · booking_snapshot
//   col 2: today_calendar (rs2)
//   col 3: forum_notifications (rs2)
//
// Tasks stacks:
//   col 1: team_tasks   |   col 2: studio_tasks   |   col 3: team_board
export const MEMBER_WIDGET_REGISTRATIONS: MemberWidgetRegistration[] = [
  {
    id: 'team_tasks',
    title: 'My Tasks',
    description: 'Personal queue — synced with the Tasks page.',
    defaultPlacements: [
      { scope: 'member_overview', span: 1, rowSpan: 1, col: 1 },
      { scope: 'member_tasks', span: 1, rowSpan: 1, col: 1 },
    ],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'today_calendar',
    title: 'Calendar',
    description: "Today's schedule — toggle days with the arrows.",
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 2, col: 2 }],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'forum_notifications',
    title: 'Notifications',
    description: 'Unread messages across channels and new assignments.',
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 2, col: 3 }],
    accessVisibility: 'shared',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'booking_snapshot',
    title: 'Booking',
    description: 'Upcoming sessions and quick book.',
    // Col 1 — stacks under My Tasks (registered AFTER so it lands
    // second in col 1's default order).
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 1, col: 1 }],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  // ─── Tasks page (`/daily`) widgets ──────────────────────────────
  {
    id: 'studio_tasks',
    title: 'Studio Tasks',
    description: 'Shared studio tasks anyone on the team can complete.',
    defaultPlacements: [{ scope: 'member_tasks', span: 1, rowSpan: 1, col: 2 }],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_board',
    title: 'Team Tasks',
    description: 'Team-wide view of member + studio work.',
    defaultPlacements: [{ scope: 'member_tasks', span: 1, rowSpan: 1, col: 3 }],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
]

// Member-side widget bank — registered but NOT on any member page today.
export const MEMBER_BANK_REGISTRATIONS: MemberWidgetRegistration[] = [
  {
    id: 'team_snapshot',
    title: 'Daily Snapshot',
    description: 'Progress, streak, and must-do.',
    defaultPlacements: [],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_directory',
    title: 'Team',
    description: 'Quick-reference row of teammates.',
    defaultPlacements: [],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_activity',
    title: 'Team activity',
    description: 'Recent team actions tagged by flywheel stage.',
    defaultPlacements: [],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'flywheel_summary',
    title: 'Flywheel Summary',
    description: 'Five-stage snapshot on the member surface.',
    defaultPlacements: [],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
]

// ═════════════════════════════════════════════════════════════════════
// ADMIN — widgets on the admin Hub page ("/admin").
// Admin widgets' placements must target `admin_overview` only — the
// type system enforces it via `AdminWidgetRegistration`.
// ═════════════════════════════════════════════════════════════════════
// PR #32 — column-snap model (see MEMBER comment block for the full
// grammar).
//
// Hub stacks:
//   col 1: admin_quick_assign · admin_task_requests
//   col 2: admin_flywheel (rs2)
//   col 3: admin_notifications · admin_team
//
// Assign stacks:
//   col 1: admin_assign  |  col 2: admin_task_requests  |  col 3: admin_templates (rs2)
export const ADMIN_WIDGET_REGISTRATIONS: AdminWidgetRegistration[] = [
  {
    id: 'admin_quick_assign',
    title: 'Quick Assign',
    description: 'Fire off a one-off task without leaving the Hub.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1, col: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_flywheel',
    title: 'Flywheel',
    description: 'KPIs across the five flywheel stages.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 2, col: 2 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_notifications',
    title: 'Notifications',
    description: 'Unread channels, new assignments, and quick post as admin.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1, col: 3 }],
    accessVisibility: 'admin',
    dataScope: 'self',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_assign',
    title: 'Assign',
    description: 'Send out sessions, tasks, or task groups.',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 1, col: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_task_requests',
    title: 'Task Requests',
    description: 'Members asking for tasks to be added to their queue.',
    // Hub col 1 (stacks under Quick Assign). Assign col 2.
    defaultPlacements: [
      { scope: 'admin_overview', span: 1, rowSpan: 1, col: 1 },
      { scope: 'admin_assign', span: 1, rowSpan: 1, col: 2 },
    ],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_team',
    title: 'Team',
    description: 'Your crew at a glance.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1, col: 3 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_templates',
    title: 'Templates',
    description: 'Reusable blueprints for onboarding + repeat work.',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 2, col: 3 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // Legacy task_edit_requests approvals (daily-checklist edits).
    // De-placed — admins can surface via controls.
    id: 'admin_approvals',
    title: 'Checklist Approvals',
    description: 'Pending daily-checklist edit requests.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
]

// Admin-side widget bank — registered but NOT on the Hub grid today.
export const ADMIN_BANK_REGISTRATIONS: AdminWidgetRegistration[] = [
  {
    id: 'team_focus',
    title: 'Team Focus',
    description: 'Live team completion, submissions, and member momentum.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'approval_queue',
    title: 'Approval Queue',
    description: 'Pending edits and submissions that need admin attention.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_schedule',
    title: 'Today Schedule',
    description: 'The studio schedule for today across the team.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_shortcuts',
    title: 'Admin Shortcuts',
    description: 'Jump directly into the key admin workspaces.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'global',
    allowedRoles: ['admin', 'owner'],
  },
]

// Convenience aggregation — every registered widget on either side.
// Used for layout sanitization ("is this id still valid?") and for
// component-map lookups. Do NOT iterate this for rendering — iterate
// the page-specific scoped helper below instead.
export const WORKSPACE_WIDGET_REGISTRATIONS: WorkspaceWidgetRegistration[] = [
  ...MEMBER_WIDGET_REGISTRATIONS,
  ...MEMBER_BANK_REGISTRATIONS,
  ...ADMIN_WIDGET_REGISTRATIONS,
  ...ADMIN_BANK_REGISTRATIONS,
]

// Build default widget state for a given scope by filtering registrations
// whose `defaultPlacements` include that scope, then projecting each
// placement into widget state. Scope-matched placements decide span +
// rowSpan so a widget can be 2×2 on Overview and 1×1 on Tasks if needed.
function buildDefaultWidgetStateForScope(
  registrations: WorkspaceWidgetRegistration[],
  scope: WorkspaceScope,
): WorkspaceWidgetState[] {
  const perColumnOrder: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const result: WorkspaceWidgetState[] = []
  for (const widget of registrations) {
    const placement = widget.defaultPlacements.find(p => p.scope === scope)
    if (!placement) continue
    const col = placement.col
    const order = perColumnOrder[col] ?? 0
    perColumnOrder[col] = order + 1
    result.push({
      id: widget.id,
      order,
      visible: true,
      span: placement.span,
      rowSpan: placement.rowSpan ?? 1,
      col,
    })
  }
  return result
}

// Bump whenever the default widget order / span / scope assignment
// changes. Saved layouts whose `version` does not match are discarded
// in storage.ts so the new default ordering takes effect for everyone.
//
// v8 (2026-04-20): rebalance Overview grid so both columns terminate at
// the same row — team_tasks 3→2, forum_notifications 1→2.
// v9 (2026-04-22, PR #7): widget visibility model formalized; multi-page
// placement introduced; new `assigned_tasks` widget defaults onto
// Overview + Tasks; Tasks page becomes a widget grid scope.
// v10 (2026-04-22, PR #11): `assigned_tasks` widget retired — its
// content folded into `team_tasks` (MyTasksCard reads assigned_tasks
// directly). Saved v9 layouts that referenced `assigned_tasks` get
// sanitized away; the rebuilt default keeps `team_tasks` on both
// Overview and Tasks pages, giving users one unified "My Tasks" view.
// v11 (2026-04-22, PR #16): new `admin_task_requests` widget joins
// the admin Hub overview so admins see the user-submitted approval
// queue inline alongside existing approvals.
// v12 (2026-04-23, PR #19): Hub swaps the full `admin_assign` widget
// for the lightweight `admin_quick_assign`. The full surface now
// lives on the Assign page. Saved v11 layouts referencing
// `admin_assign` on `admin_overview` get sanitized away.
// v13 (2026-04-24, PR #29): all widgets settle at span: 1 so the
// grid is 3 equal-width columns across every page. New Tasks-page
// widgets (studio_tasks, team_board) registered. New Assign-page
// scope + widgets (admin_templates plus dual placement for
// admin_assign + admin_task_requests). Legacy `admin_approvals`
// (daily-checklist edits) de-placed. Existing v12 layouts reset.
// v14 (2026-04-24, PR #30): rowSpans restored so per-page positioning
// matches the pre-refactor layouts — Overview stacks Tasks+Booking
// in col 1 with Calendar/Notifications spanning both rows; Hub stacks
// Quick Assign+Task Requests in col 1 with Flywheel spanning col 2
// and Notifications+Team in col 3; Assign places Assign·TaskRequests
// in row 1 with Templates spanning col 3. Tasks + Assign page
// definitions wired through their own scope filters.
// v15 (2026-04-24, PR #32): column-snap manual placement. Each
// widget has a `col` in [1..3]; the grid renders 3 independent
// vertical stacks (no row-major flow across columns). Within a
// column, widgets auto-stack by `order` and dragging reorders with
// standard sortable shift semantics. Dragging to a different column
// snaps to that column. `rowSpan` still controls widget height inside
// its column. `WorkspaceWidgetState` gains `col`; saved v14 layouts
// reset to the new defaults.
export const WORKSPACE_LAYOUT_VERSION = 15

// Default layouts per scope. Each scope picks its widgets from the
// relevant side's registrations (all + bank) and uses only those whose
// `defaultPlacements` target that scope.
export function getDefaultWorkspaceLayout(scope: WorkspaceScope): WorkspaceLayout {
  const memberScopes: MemberScope[] = ['member_overview', 'member_tasks']
  const isMemberScope = (memberScopes as WorkspaceScope[]).includes(scope)
  const pool = isMemberScope
    ? [...MEMBER_WIDGET_REGISTRATIONS, ...MEMBER_BANK_REGISTRATIONS]
    : [...ADMIN_WIDGET_REGISTRATIONS, ...ADMIN_BANK_REGISTRATIONS]
  return {
    scope,
    version: WORKSPACE_LAYOUT_VERSION,
    widgets: buildDefaultWidgetStateForScope(pool, scope),
  }
}

// Re-export WidgetPlacement for consumers that want to type placements
// inline without reaching into the types module.
export type { WidgetPlacement }
