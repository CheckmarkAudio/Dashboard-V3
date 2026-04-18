import type { AppRole } from '../permissions'
import type {
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetRegistration,
  WorkspaceWidgetState,
} from './types'

export const WORKSPACE_WIDGET_REGISTRATIONS: WorkspaceWidgetRegistration[] = [
  // Member Overview — ADHD-friendly layout.
  //
  // Ordering here = default render order. Tasks lead as the hero
  // because it's the ONE thing a member needs to act on every day;
  // Snapshot and Calendar follow as quick-glance context; Team
  // Directory sits as reference material below the fold.
  //
  // Flywheel Summary was removed from the member Overview in April
  // 2026 as part of the ADHD-friendly default. The full flywheel
  // chart still lives under /admin/health. The `flywheel_summary`
  // ID is kept in the type union so any saved layouts that still
  // reference it resolve gracefully (WorkspacePanel no-ops missing
  // definitions).
  // ADHD-friendly Overview: 4 compact widgets in a single viewport row.
  // No scrolling required at desktop widths. Each widget is a quick-glance
  // snapshot — the deeper data lives on its dedicated nav page.
  //
  // Order = render order. Calendar first (what's now), Tasks second (what
  // to do), Booking third (what's next), Progress last (how am I doing).
  // Mixed-size grid (3 cols at desktop): hero widgets take 2 cols, KPI
  // widgets take 1. Pattern matches the v1.0 design system reference —
  // wide chart on left, smaller KPIs on right, all clean rectangles.
  // Render order: hero rows on top, KPI rows on bottom.
  {
    id: 'today_calendar',
    title: 'Today Schedule',
    description: "Today's sessions with live status pills.",
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  {
    id: 'team_snapshot',
    title: 'Daily Snapshot',
    description: 'Progress, streak, and must-do.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  {
    id: 'team_tasks',
    title: 'My tasks',
    description: 'Today by flywheel stage.',
    defaultSpan: 2,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  {
    id: 'booking_snapshot',
    title: 'Booking',
    description: 'Upcoming sessions and the next slot.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview', 'admin_overview'],
  },
  // Removed from Overview as part of the ADHD-friendly refresh:
  //   - team_directory (Members) — redundant with the full /admin/my-team page
  //   - team_activity — too long for a glance + currently mock data
  // Kept as a registered ID in types.ts so older saved layouts still resolve.
  {
    id: 'team_focus',
    title: 'Team Focus',
    description: 'Live team completion, submissions, and member momentum.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },
  {
    id: 'approval_queue',
    title: 'Approval Queue',
    description: 'Pending edits and submissions that need admin attention.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },
  {
    id: 'admin_schedule',
    title: 'Today Schedule',
    description: 'The studio schedule for today across the team.',
    defaultSpan: 2,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
  },
  {
    id: 'admin_shortcuts',
    title: 'Admin Shortcuts',
    description: 'Jump directly into the key admin workspaces.',
    defaultSpan: 1,
    allowedRoles: ['admin', 'owner'],
    scopes: ['admin_overview'],
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
