import type { AppRole } from '../permissions'
import type {
  WorkspaceLayout,
  WorkspaceScope,
  WorkspaceWidgetRegistration,
  WorkspaceWidgetState,
} from './types'

export const WORKSPACE_WIDGET_REGISTRATIONS: WorkspaceWidgetRegistration[] = [
  {
    id: 'team_snapshot',
    title: 'Today Focus',
    description: 'The core daily progress markers your team member needs right now.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },
  {
    id: 'today_calendar',
    title: 'Today Schedule',
    description: 'Sessions and time blocks that matter today.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },
  {
    id: 'team_tasks',
    title: 'Today Tasks',
    description: 'Your checklist for the day, built from live task data.',
    defaultSpan: 1,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },
  {
    id: 'flywheel_summary',
    title: 'Flywheel Today',
    description: 'Deliver · Capture · Share · Attract · Book — your daily snapshot on the business loop.',
    defaultSpan: 3,
    allowedRoles: ['member', 'admin', 'owner'],
    scopes: ['member_overview'],
  },
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
