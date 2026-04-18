import type { AppRole } from '../permissions'
import type {
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetRegistration,
  WorkspaceWidgetState,
} from './types'

export const WORKSPACE_WIDGET_REGISTRATIONS: WorkspaceWidgetRegistration[] = [
  // Overview = launchpad to the 4 main user-facing nav items
  // (Tasks · Calendar · Booking · Forum). Each widget previews one of
  // those pages. Same layout for member AND admin scope so the Overview
  // is consistent across roles. Admin-specific widgets (TeamFocus,
  // ApprovalQueue, AdminShortcuts, AdminSchedule) live in the admin Hub
  // page, NOT on Overview — Overview is a daily-status surface, not an
  // admin console.
  //
  // Visual order in the 3-col mixed-size grid:
  //   Row 1: today_calendar (span 2) + booking_snapshot (span 1)
  //   Row 2: team_tasks      (span 2) + [forum_notifications coming Piece 5]
  //
  // Component IDs intentionally kept short and stable so saved layouts
  // in localStorage resolve cleanly across renames.
  {
    id: 'today_calendar',
    title: 'Calendar',
    description: "Today's schedule.",
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  {
    id: 'booking_snapshot',
    title: 'Booking',
    description: 'Upcoming sessions and quick book.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  {
    id: 'team_tasks',
    title: 'Tasks',
    description: 'Today by flywheel stage.',
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  {
    id: 'forum_notifications',
    title: 'Forum',
    description: 'Recent messages across channels.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  // ─── Registered but NOT scoped to Overview anymore ────────────────────
  // The widget components still exist in src/components/dashboard/ and
  // remain mapped in widgetRegistry.tsx. They're available for a future
  // "widget bank" feature where users opt-in to extra widgets. Keeping
  // them registered (with empty scopes) means saved layouts resolve and
  // we can re-enable any of them by changing scopes back without touching
  // the type union or the widget map.
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
  defs: Pick<WorkspaceWidgetRegistration, 'id' | 'defaultSpan'>[],
): WorkspaceWidgetState[] {
  return defs.map((widget, index) => ({
    id: widget.id,
    order: index,
    visible: true,
    span: widget.defaultSpan,
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

export function getDefaultWorkspaceLayout(
  scope: WorkspaceScope,
  role: AppRole,
): WorkspaceLayout {
  return {
    scope,
    version: 2,
    widgets: buildDefaultWidgetState(getWidgetRegistrationsForScope(scope, role)),
  }
}
