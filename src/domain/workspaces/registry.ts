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
// PR #29 — every widget is `span: 1, rowSpan: 1` so columns stay
// equal width across the 3-col grid. Widget heights flex to content.
// This makes drag-reorder predictable — a widget always moves into
// a 1×1 slot, never straddles columns.
export const MEMBER_WIDGET_REGISTRATIONS: MemberWidgetRegistration[] = [
  {
    // Widget id stays `team_tasks` so saved layouts keep resolving;
    // the rendered component is `MyTasksCard`. Appears on BOTH member
    // pages — Overview default + the new Tasks widget grid.
    id: 'team_tasks',
    title: 'My Tasks',
    description: 'Personal queue — synced with the Tasks page.',
    defaultPlacements: [
      { scope: 'member_overview', span: 1, rowSpan: 1 },
      { scope: 'member_tasks', span: 1, rowSpan: 1 },
    ],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'forum_notifications',
    title: 'Notifications',
    description: 'Unread messages across channels and new assignments.',
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 1 }],
    accessVisibility: 'shared',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'today_calendar',
    title: 'Calendar',
    description: "Today's schedule — toggle days with the arrows.",
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 1 }],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'booking_snapshot',
    title: 'Booking',
    description: 'Upcoming sessions and quick book.',
    defaultPlacements: [{ scope: 'member_overview', span: 1, rowSpan: 1 }],
    accessVisibility: 'personal',
    dataScope: 'self',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  // ─── Tasks page (`/daily`) widgets ──────────────────────────────
  // MyTasksCard is re-used here (see team_tasks above — dual
  // placement). Studio + Team boards register as their own widgets.
  {
    id: 'studio_tasks',
    title: 'Studio Tasks',
    description: 'Shared studio tasks anyone on the team can complete.',
    defaultPlacements: [{ scope: 'member_tasks', span: 1, rowSpan: 1 }],
    accessVisibility: 'shared',
    dataScope: 'team',
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_board',
    title: 'Team Tasks',
    description: 'Team-wide view of member + studio work.',
    defaultPlacements: [{ scope: 'member_tasks', span: 1, rowSpan: 1 }],
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
// PR #29 — all admin widgets settle at `span: 1, rowSpan: 1` so
// columns stay equal width across the grid, the same as member
// widgets. Drag-reorder is predictable; widget heights flex.
export const ADMIN_WIDGET_REGISTRATIONS: AdminWidgetRegistration[] = [
  {
    id: 'admin_quick_assign',
    title: 'Quick Assign',
    description: 'Fire off a one-off task without leaving the Hub.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // Full 3-tile Assign widget — lives on the Assign page grid now,
    // not the Hub (PR #29).
    id: 'admin_assign',
    title: 'Assign',
    description: 'Send out sessions, tasks, or task groups.',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_notifications',
    title: 'Notifications',
    description: 'Unread channels, new assignments, and quick post as admin.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1 }],
    accessVisibility: 'admin',
    dataScope: 'self',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_flywheel',
    title: 'Flywheel',
    description: 'KPIs across the five flywheel stages.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_team',
    title: 'Team',
    description: 'Your crew at a glance.',
    defaultPlacements: [{ scope: 'admin_overview', span: 1, rowSpan: 1 }],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // Legacy task_edit_requests approvals (daily-checklist edits).
    // Kept registered; placement is intentionally empty so the default
    // layout doesn't surface it until reviewed. Can be re-enabled by
    // an admin via the workspace controls.
    id: 'admin_approvals',
    title: 'Checklist Approvals',
    description: 'Pending daily-checklist edit requests.',
    defaultPlacements: [],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // PR #16 — user-submitted task requests awaiting admin review.
    // Placed on BOTH the Hub (quick-glance) AND the Assign page
    // (full review surface).
    id: 'admin_task_requests',
    title: 'Task Requests',
    description: 'Members asking for tasks to be added to their queue.',
    defaultPlacements: [
      { scope: 'admin_overview', span: 1, rowSpan: 1 },
      { scope: 'admin_assign', span: 1, rowSpan: 1 },
    ],
    accessVisibility: 'admin',
    dataScope: 'team',
    allowedRoles: ['admin', 'owner'],
  },
  {
    // PR #29 — Templates library as a widget on the Assign page so
    // the whole page runs on WorkspacePanel (drag-reorder + expand).
    id: 'admin_templates',
    title: 'Templates',
    description: 'Reusable blueprints for onboarding + repeat work.',
    defaultPlacements: [{ scope: 'admin_assign', span: 1, rowSpan: 1 }],
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
  const result: WorkspaceWidgetState[] = []
  let order = 0
  for (const widget of registrations) {
    const placement = widget.defaultPlacements.find(p => p.scope === scope)
    if (!placement) continue
    result.push({
      id: widget.id,
      order: order++,
      visible: true,
      span: placement.span,
      rowSpan: placement.rowSpan ?? 1,
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
export const WORKSPACE_LAYOUT_VERSION = 13

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
