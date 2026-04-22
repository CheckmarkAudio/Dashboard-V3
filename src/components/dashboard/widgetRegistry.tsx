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
}

const adminWidgetComponents: Record<AdminWidgetId, ComponentType> = {
  admin_assign: AdminAssignWidget,
  admin_notifications: AdminNotificationsWidget,
  admin_team: AdminTeamWidget,
  admin_flywheel: AdminFlywheelWidget,
  admin_approvals: AdminApprovalsWidget,
  admin_task_requests: PendingTaskRequestsWidget,
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

// Tasks page — widgets whose defaultPlacements target 'member_tasks'.
// After PR #7 this is `team_tasks` (My Tasks/Checklist) + `assigned_tasks`.
export const TASKS_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition<MemberWidgetId>[] =
  ALL_MEMBER_DEFINITIONS.filter(
    (widget) => widget.defaultPlacements.some((p) => p.scope === 'member_tasks'),
  )

// Admin Hub — widgets whose defaultPlacements target 'admin_overview'.
export const ADMIN_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition<AdminWidgetId>[] =
  [
    ...ADMIN_WIDGET_REGISTRATIONS.map(resolveAdmin),
    ...ADMIN_BANK_REGISTRATIONS.map(resolveAdmin),
  ].filter(
    (widget) => widget.defaultPlacements.some((p) => p.scope === 'admin_overview'),
  )

// Exposed for layout sanitization ("is this saved widget id still a
// real widget?"). Do NOT iterate this for rendering — the page-specific
// arrays above are the render source of truth.
export const ALL_WIDGET_DEFINITIONS: WorkspaceWidgetDefinition[] = [
  ...ALL_MEMBER_DEFINITIONS,
  ...ADMIN_WIDGET_REGISTRATIONS.map(resolveAdmin),
  ...ADMIN_BANK_REGISTRATIONS.map(resolveAdmin),
]
