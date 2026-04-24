import type { ComponentType } from 'react'
import type {
  AdminWidgetId,
  AdminWidgetRegistration,
  MemberWidgetId,
  MemberWidgetRegistration,
  WorkspaceWidgetDefinition,
} from '../../domain/workspaces/types'
import {
  ADMIN_BANK_REGISTRATIONS,
  ADMIN_WIDGET_REGISTRATIONS,
  MEMBER_BANK_REGISTRATIONS,
  MEMBER_WIDGET_REGISTRATIONS,
} from '../../domain/workspaces/registry'
import {
  BookingSnapshotWidget,
  FlywheelSummaryWidget,
  ForumNotificationsWidget,
  TeamActivityWidget,
  TeamDirectoryWidget,
  TeamSnapshotWidget,
  TeamTasksWidget,
  TodayCalendarWidget,
} from './memberOverviewWidgets'
import {
  AdminScheduleWidget,
  AdminShortcutsWidget,
  ApprovalQueueWidget,
  TeamFocusWidget,
} from './adminOverviewWidgets'
import {
  AdminApprovalsWidget,
  AdminAssignWidget,
  AdminFlywheelWidget,
  AdminNotificationsWidget,
  AdminTeamWidget,
} from './adminHubWidgets'
import PendingTaskRequestsWidget from '../admin/assign/PendingTaskRequestsWidget'
import AdminQuickAssignWidget from '../admin/assign/AdminQuickAssignWidget'
import {
  StudioAssignedTasksCard,
  TeamAssignedTasksCard,
} from '../tasks/AssignedTaskBoards'
import AdminTemplatesWidget from '../admin/templates/AdminTemplatesWidget'
import AdminEditTasksWidget from '../admin/tasks/AdminEditTasksWidget'

// ═════════════════════════════════════════════════════════════════════
// Component maps — ONE per side.
//
// Keyed strictly by `MemberWidgetId` / `AdminWidgetId`. TypeScript will
// emit a compile error if you try to wire an admin widget into the
// member map or vice versa. This is the second layer of lockdown
// (the first is the two typed registration arrays in registry.ts).
// ═════════════════════════════════════════════════════════════════════

const memberWidgetComponents: Record<MemberWidgetId, ComponentType> = {
  team_tasks: TeamTasksWidget,
  forum_notifications: ForumNotificationsWidget,
  today_calendar: TodayCalendarWidget,
  booking_snapshot: BookingSnapshotWidget,
  team_snapshot: TeamSnapshotWidget,
  team_directory: TeamDirectoryWidget,
  team_activity: TeamActivityWidget,
  flywheel_summary: FlywheelSummaryWidget,
  // PR #29 — Tasks page board widgets. Shared / team-scope reads
  // alongside the personal team_tasks (MyTasksCard).
  studio_tasks: StudioAssignedTasksCard,
  team_board: TeamAssignedTasksCard,
}

const adminWidgetComponents: Record<AdminWidgetId, ComponentType> = {
  admin_assign: AdminAssignWidget,
  admin_quick_assign: AdminQuickAssignWidget,
  admin_notifications: AdminNotificationsWidget,
  admin_team: AdminTeamWidget,
  admin_flywheel: AdminFlywheelWidget,
  admin_approvals: AdminApprovalsWidget,
  admin_task_requests: PendingTaskRequestsWidget,
  // PR #29 — Templates library as a widget so the Assign page runs
  // on WorkspacePanel like the other surfaces.
  admin_templates: AdminTemplatesWidget,
  // PR #40 — admin Edit Tasks library. Opens a modal listing every
  // in-flight task with click-to-edit rows.
  admin_edit_tasks: AdminEditTasksWidget,
  team_focus: TeamFocusWidget,
  approval_queue: ApprovalQueueWidget,
  admin_schedule: AdminScheduleWidget,
  admin_shortcuts: AdminShortcutsWidget,
}

function resolveMember(
  registration: MemberWidgetRegistration,
): WorkspaceWidgetDefinition<MemberWidgetId> {
  return { ...registration, component: memberWidgetComponents[registration.id] }
}

function resolveAdmin(
  registration: AdminWidgetRegistration,
): WorkspaceWidgetDefinition<AdminWidgetId> {
  return { ...registration, component: adminWidgetComponents[registration.id] }
}

// ═════════════════════════════════════════════════════════════════════
// Exported definitions, segregated per page.
//
// Dashboard.tsx (/)        imports MEMBER_WIDGET_DEFINITIONS.
// Hub.tsx (/admin)         imports ADMIN_WIDGET_DEFINITIONS.
// Tasks.tsx (/daily) (PR #7) imports TASKS_WIDGET_DEFINITIONS.
//
// All three draw from the same pool of typed components but filter
// by `defaultPlacements` so each page only renders widgets that
// declared a placement there. Admin never leaks to member pages.
// ═════════════════════════════════════════════════════════════════════

// All member widgets — resolved once; each page filters by placement.
const ALL_MEMBER_DEFINITIONS: WorkspaceWidgetDefinition<MemberWidgetId>[] = [
  ...MEMBER_WIDGET_REGISTRATIONS.map(resolveMember),
  ...MEMBER_BANK_REGISTRATIONS.map(resolveMember),
]

// Overview page — widgets whose defaultPlacements target 'member_overview'.
export const MEMBER_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition<MemberWidgetId>[] =
  ALL_MEMBER_DEFINITIONS.filter(
    (widget) => widget.defaultPlacements.some((p) => p.scope === 'member_overview'),
  )

// Export the full set so pages that render a member scope other than
// Overview (e.g. Tasks) can pass the right subset to WorkspacePanel.
export const ALL_MEMBER_WIDGET_DEFINITIONS = ALL_MEMBER_DEFINITIONS

// Tasks page — widgets whose defaultPlacements target 'member_tasks'.
// After PR #7 this is `team_tasks` (My Tasks/Checklist) + `assigned_tasks`.
export const TASKS_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition<MemberWidgetId>[] =
  ALL_MEMBER_DEFINITIONS.filter(
    (widget) => widget.defaultPlacements.some((p) => p.scope === 'member_tasks'),
  )

// Admin — single pool. Pages filter by scope via WorkspacePanel (not
// pre-filtered here) so a widget registered for BOTH 'admin_overview'
// and 'admin_assign' can render on either page without two exports.
const ALL_ADMIN_DEFINITIONS: WorkspaceWidgetDefinition<AdminWidgetId>[] = [
  ...ADMIN_WIDGET_REGISTRATIONS.map(resolveAdmin),
  ...ADMIN_BANK_REGISTRATIONS.map(resolveAdmin),
]

// Admin Hub — widgets whose defaultPlacements target 'admin_overview'.
export const ADMIN_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition<AdminWidgetId>[] =
  ALL_ADMIN_DEFINITIONS.filter(
    (widget) => widget.defaultPlacements.some((p) => p.scope === 'admin_overview'),
  )

// Assign page — widgets whose defaultPlacements target 'admin_assign'.
// PR #29 introduced this scope; PR #30 exports its definitions so the
// page can actually find its widgets (Assign, Task Requests, Templates).
export const ASSIGN_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition<AdminWidgetId>[] =
  ALL_ADMIN_DEFINITIONS.filter(
    (widget) => widget.defaultPlacements.some((p) => p.scope === 'admin_assign'),
  )

// Exposed for layout sanitization ("is this saved widget id still a
// real widget?"). Do NOT iterate this for rendering — the page-specific
// arrays above are the render source of truth.
export const ALL_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition[] = [
  ...ALL_MEMBER_DEFINITIONS,
  ...ADMIN_WIDGET_REGISTRATIONS.map(resolveAdmin),
  ...ADMIN_BANK_REGISTRATIONS.map(resolveAdmin),
]
