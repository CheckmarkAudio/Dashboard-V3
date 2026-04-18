import type { AppRole } from '../permissions'
import type {
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetRegistration,
  WorkspaceWidgetState,
} from './types'

export const WORKSPACE_WIDGET_REGISTRATIONS: WorkspaceWidgetRegistration[] = [
  // ─── Member Overview ("/") ────────────────────────────────────────────
  // The 4 widgets on a member's Overview launchpad, each previewing a
  // main nav item (Tasks / Calendar / Booking / Forum).
  //
  // Visual order in the 3-col mixed-size grid:
  //   Row 1: team_tasks     (col 2) + forum_notifications (col 1)
  //   Row 2: today_calendar (col 2) + booking_snapshot    (col 1)
  //
  // Registration order IS the default render order; layout version is
  // bumped whenever this order changes so existing saved layouts reset
  // to the new default.
  //
  // Admins are routed to `/admin` (Hub) for their landing screen and
  // do NOT see these member widgets — each is scoped to 'member_overview'
  // only. The Hub has its own dedicated widgets below.
  {
    id: 'team_tasks',
    title: 'Tasks',
    description: 'Today by flywheel stage.',
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },
  {
    id: 'forum_notifications',
    title: 'Notifications',
    description: 'Unread messages across channels.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },
  {
    id: 'today_calendar',
    title: 'Calendar',
    description: "Today's schedule.",
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },
  {
    id: 'booking_snapshot',
    title: 'Booking',
    description: 'Upcoming sessions and quick book.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },

  // ─── Admin Hub ("/admin") ─────────────────────────────────────────────
  // Five widget snapshots of the admin surfaces: Assign, Flywheel,
  // Notifications (admin tools), Team directory, Approvals.
  //
  // Visual order in the 3-col grid with mixed row spans:
  //   Row 1: admin_assign (col 2, row 2) + admin_notifications (col 1)
  //   Row 2: admin_assign continues       + admin_team         (col 1)
  //   Row 3: admin_flywheel (col 2, row 2)+ admin_approvals    (col 1, row 2)
  //   Row 4: admin_flywheel continues     + admin_approvals continues
  //
  // Two big rectangles on the left (Assign + Flywheel) and three
  // stacked widgets on the right (Notifications + Team + Approvals),
  // where Approvals is intentionally taller to balance the grid.
  {
    id: 'admin_assign',
    title: 'Assign',
    description: 'Send out sessions, tasks, or task groups.',
    defaultSpan: 2,
    defaultRowSpan: 2,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },
  {
    id: 'admin_notifications',
    title: 'Notifications',
    description: 'Unread channels + quick post as admin.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },
  {
    id: 'admin_team',
    title: 'Team',
    description: 'Your crew at a glance.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },
  {
    id: 'admin_flywheel',
    title: 'Flywheel',
    description: 'KPIs across the five flywheel stages.',
    defaultSpan: 2,
    defaultRowSpan: 2,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },
  {
    id: 'admin_approvals',
    title: 'Approvals',
    description: 'Pending requests from the team.',
    defaultSpan: 1,
    defaultRowSpan: 2,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },

  // ─── Registered but not scoped anywhere (widget bank) ────────────────
  // The widget components still exist in src/components/dashboard/ and
  // remain mapped in widgetRegistry.tsx. They're available for a future
  // "widget bank" feature where users opt-in to extra widgets. Keeping
  // them registered (with empty scopes) means saved layouts resolve and
  // we can re-enable any of them by changing scopes back without
  // touching the type union or the widget map.
  {
    id: 'team_snapshot',
    title: 'Daily Snapshot',
    description: 'Progress, streak, and must-do.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: [],
  },
  {
    id: 'team_directory',
    title: 'Team',
    description: 'Quick-reference row of teammates.',
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: [],
  },
  {
    id: 'team_activity',
    title: 'Team activity',
    description: 'Recent team actions tagged by flywheel stage.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: [],
  },
  {
    id: 'team_focus',
    title: 'Team Focus',
    description: 'Live team completion, submissions, and member momentum.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
    scopes: [],
  },
  {
    id: 'approval_queue',
    title: 'Approval Queue',
    description: 'Pending edits and submissions that need admin attention.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
    scopes: [],
  },
  {
    id: 'admin_schedule',
    title: 'Today Schedule',
    description: 'The studio schedule for today across the team.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
    scopes: [],
  },
  {
    id: 'admin_shortcuts',
    title: 'Admin Shortcuts',
    description: 'Jump directly into the key admin workspaces.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
    scopes: [],
  },
]

function buildDefaultWidgetState(
  defs: Pick<WorkspaceWidgetRegistration, 'id' | 'defaultSpan' | 'defaultRowSpan'>[],
): WorkspaceWidgetState[] {
  return defs.map((widget, index) => ({
    id: widget.id,
    order: index,
    visible: true,
    span: widget.defaultSpan,
    rowSpan: widget.defaultRowSpan ?? 1,
  }))
}

export function getWorkspaceScopeForRole(role: AppRole): WorkspaceScope {
  return role === 'owner' || role === 'admin' ? 'admin_overview' : 'member_overview'
}

export function getWidgetRegistrationsForScope(
  scope: WorkspaceScope,
  role: AppRole,
): WorkspaceWidgetRegistration[] {
  return WORKSPACE_WIDGET_REGISTRATIONS.filter(
    (widget) => widget.scopes.includes(scope) && widget.allowedRoles.includes(role),
  )
}

// Bump whenever the default widget order / span changes. Saved layouts
// whose `version` does not match are discarded (see storage.ts) so the
// new default ordering takes effect for everyone, not just fresh users.
export const WORKSPACE_LAYOUT_VERSION = 4

export function getDefaultWorkspaceLayout(
  scope: WorkspaceScope,
  role: AppRole,
): WorkspaceLayout {
  return {
    scope,
    version: WORKSPACE_LAYOUT_VERSION,
    widgets: buildDefaultWidgetState(getWidgetRegistrationsForScope(scope, role)),
  }
}
