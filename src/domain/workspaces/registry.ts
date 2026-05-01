import type {
  AdminWidgetRegistration,
  MemberWidgetRegistration,
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetRegistration,
  WorkspaceWidgetState,
} from './types'

// ═════════════════════════════════════════════════════════════════════
// MEMBER — widgets on the member Overview page ("/").
//
// The array type (`MemberWidgetRegistration[]`) makes TypeScript refuse
// any entry whose `id` is not a `MemberWidgetId`. If you try to add
// 'admin_assign' here you will get a compile error — the admin Hub is
// an entirely different list below.
// ═════════════════════════════════════════════════════════════════════
//
// Render order top to bottom:
//   Row 1: team_tasks (col 2)     + forum_notifications (col 1)
//   Row 2: today_calendar (col 2) + booking_snapshot    (col 1)
export const MEMBER_WIDGET_REGISTRATIONS: MemberWidgetRegistration[] = [
  // Layout follows the Workspace-UI-Draft mockup: a 2-column grid
  // (left column wider, right narrower) where the four primary widgets
  // all fit on one screen so the page reads as a true "overview".
  //
  //   Left  col:  My Tasks (rowSpan 2) → Calendar (rowSpan 1)
  //   Right col:  Notifications (rowSpan 2) → Booking (rowSpan 1)
  //
  // Each widget owns one column (defaultSpan: 1); the asymmetric
  // column ratio is set in WorkspacePanel.tsx on the lg breakpoint.
  {
    // Widget id stays `team_tasks` so saved layouts keep resolving;
    // the rendered component is now `MyTasksCard` (the same card that
    // lives on the /daily Tasks page) sharing state via MyTasksContext.
    id: 'team_tasks',
    title: 'My Tasks',
    description: 'Personal queue — synched with the Tasks page.',
    defaultSpan: 1,
    defaultRowSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'forum_notifications',
    title: 'Notifications',
    description: 'Unread messages across channels.',
    defaultSpan: 1,
    defaultRowSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'today_calendar',
    title: 'Calendar',
    description: "Today's schedule.",
    defaultSpan: 1,
    defaultRowSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'booking_snapshot',
    title: 'Booking',
    description: 'Upcoming sessions and quick book.',
    defaultSpan: 1,
    defaultRowSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
  },
]

// Member-side widget bank — registered but NOT on the Overview grid.
// Kept so saved layouts from earlier versions still resolve to valid
// component refs. Move one into MEMBER_WIDGET_REGISTRATIONS to show it.
export const MEMBER_BANK_REGISTRATIONS: MemberWidgetRegistration[] = [
  {
    id: 'team_snapshot',
    title: 'Daily Snapshot',
    description: 'Progress, streak, and must-do.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_directory',
    title: 'Team',
    description: 'Quick-reference row of teammates.',
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'team_activity',
    title: 'Team activity',
    description: 'Recent team actions tagged by flywheel stage.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
  },
  {
    id: 'flywheel_summary',
    title: 'Flywheel Summary',
    description: 'Five-stage snapshot on the member surface.',
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
  },
]

// ═════════════════════════════════════════════════════════════════════
// ADMIN — widgets on the admin Hub page ("/admin").
//
// Never mix with MEMBER above. TypeScript enforces it via the array's
// type (`AdminWidgetRegistration[]` only accepts `AdminWidgetId`).
// ═════════════════════════════════════════════════════════════════════
//
// Render order — matches the member Overview rhythm so both pages
// feel uniform. Every widget is one row tall (~340px) like the
// member side; no more tall hero widgets.
//
//   Row 1: admin_assign    (col 2) + admin_notifications (col 1)
//   Row 2: admin_flywheel  (col 2) + admin_team          (col 1)
//   Row 3: admin_approvals (col 3 — full width)
export const ADMIN_WIDGET_REGISTRATIONS: AdminWidgetRegistration[] = [
  {
    id: 'admin_assign',
    title: 'Assign',
    description: 'Send out sessions, tasks, or task groups.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_notifications',
    title: 'Notifications',
    description: 'Unread channels + quick post as admin.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_flywheel',
    title: 'Flywheel',
    description: 'KPIs across the five flywheel stages.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_team',
    title: 'Team',
    description: 'Your crew at a glance.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_approvals',
    title: 'Approvals',
    description: 'Pending requests from the team.',
    defaultSpan: 3,
    allowedRoles: ['admin', 'owner'],
  },
]

// Admin-side widget bank — registered but NOT on the Hub grid today.
export const ADMIN_BANK_REGISTRATIONS: AdminWidgetRegistration[] = [
  {
    id: 'team_focus',
    title: 'Team Focus',
    description: 'Live team completion, submissions, and member momentum.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'approval_queue',
    title: 'Approval Queue',
    description: 'Pending edits and submissions that need admin attention.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_schedule',
    title: 'Today Schedule',
    description: 'The studio schedule for today across the team.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
  },
  {
    id: 'admin_shortcuts',
    title: 'Admin Shortcuts',
    description: 'Jump directly into the key admin workspaces.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
  },
]

// Convenience aggregation — every registered widget on either side.
// Useful for layout sanitization (e.g. "is this id still valid?") and
// for the component-map lookup in widgetRegistry.tsx. Do NOT iterate
// this for rendering — iterate the page-specific array above.
export const WORKSPACE_WIDGET_REGISTRATIONS: WorkspaceWidgetRegistration[] = [
  ...MEMBER_WIDGET_REGISTRATIONS,
  ...MEMBER_BANK_REGISTRATIONS,
  ...ADMIN_WIDGET_REGISTRATIONS,
  ...ADMIN_BANK_REGISTRATIONS,
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

// Bump whenever the default widget order / span / scope assignment
// changes. Saved layouts whose `version` does not match are discarded
// in storage.ts so the new default ordering takes effect for everyone.
//
// v7 (Apr 2026): team_tasks bumped to defaultRowSpan: 3 so the My Tasks
// widget has room for ~10 task rows above the Submit Completed bar.
// Bumping the version is the migration — saved v6 layouts get wiped
// from localStorage on next load and rebuild from the new defaults.
//
// v8 (Apr 2026): pulled the Workspace-UI-Draft mockup proportions in
// — all four primary member widgets are now defaultSpan: 1 with
// rowSpans tuned to a 2x3 grid (Tasks/Notifications rowSpan 2 +
// Calendar/Booking rowSpan 1). Combined with the asymmetric 1.4fr/1fr
// columns set in WorkspacePanel.tsx, this fits the entire Overview on
// one page so the word "overview" actually applies.
export const WORKSPACE_LAYOUT_VERSION = 8

// Default layouts per scope. The page passes its scope in, picks the
// matching array, and produces widget state. Scope is used only for
// localStorage key differentiation — it never determines which
// widgets render (the page already imported its own array for that).
export function getDefaultWorkspaceLayout(scope: WorkspaceScope): WorkspaceLayout {
  const registrations =
    scope === 'admin_overview' ? ADMIN_WIDGET_REGISTRATIONS : MEMBER_WIDGET_REGISTRATIONS
  return {
    scope,
    version: WORKSPACE_LAYOUT_VERSION,
    widgets: buildDefaultWidgetState(registrations),
  }
}
